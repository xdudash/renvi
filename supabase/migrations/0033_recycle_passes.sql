-- Passed profiles come back ("second chance"), so a small market never runs into an empty feed.
-- * A pass is remembered with a counter. After `max_passes` passes of the same person they never come back.
-- * After `cooldown_hours` a passed person is in the feed again (after everyone not seen yet).
-- * When nobody else is left, people passed more than `fallback_minutes` ago fill the feed (oldest pass first),
--   so the screen is not empty; the person you have just skipped never reappears straight away.
-- * Sparks, matches and blocks still exclude a person for good. The card says "seen" for people you passed before.
-- Settings: app_config.discover_recycle (defaults below), read through discover_recycle_settings().

alter table public.passes add column if not exists times smallint not null default 1 check (times >= 1);

insert into public.app_config (key, value)
values ('discover_recycle', '{"cooldown_hours": 24, "fallback_minutes": 10, "max_passes": 5}')
on conflict (key) do nothing;

create or replace function public.discover_recycle_settings()
returns table (cooldown_hours int, fallback_minutes int, max_passes int)
language sql stable security definer set search_path = public as $$
  select greatest(coalesce((v->>'cooldown_hours')::int, 24), 0),
         greatest(coalesce((v->>'fallback_minutes')::int, 10), 0),
         greatest(coalesce((v->>'max_passes')::int, 5), 1)
  from (select (select value from public.app_config where key = 'discover_recycle') as v) c
$$;
revoke all on function public.discover_recycle_settings() from public, anon, authenticated;

-- Passing again moves the pass to now and counts it.
create or replace function public.pass_profile(p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_account_active();
  if not public.profile_is_visible(p_to) then raise exception 'not available' using errcode = 'P0002'; end if;
  insert into public.passes (from_id, to_id) values (auth.uid(), p_to)
  on conflict (from_id, to_id) do update set created_at = now(), times = public.passes.times + 1;
end $$;

-- Undo takes back only the last pass: a first pass is deleted, a repeated one is counted back and treated as old.
create or replace function public.undo_last_pass() returns uuid
language plpgsql security definer set search_path = public as $$
declare last_to uuid; n smallint;
begin
  perform public.assert_account_active();
  select to_id, times into last_to, n from public.passes where from_id = auth.uid() order by created_at desc limit 1;
  if last_to is null then return null; end if;
  if n > 1 then
    update public.passes set times = times - 1, created_at = now() - interval '30 days'
    where from_id = auth.uid() and to_id = last_to;
  else
    delete from public.passes where from_id = auth.uid() and to_id = last_to;
  end if;
  return last_to;
end $$;

drop function if exists public.discover(int);
create or replace function public.discover(p_limit int default 20) returns table (
  profile_id uuid, display_name text, age smallint, city text, intent text, interests text[],
  verified boolean, distance text, music_title text, prompts jsonb, photos jsonb, details jsonb, seen boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_account_active();
  return query
  with me as (select * from public.profiles where id = auth.uid()),
       cfg as (select * from public.discover_recycle_settings())
  select p.id, p.display_name, p.age, p.city, p.intent, p.interests,
         (p.verification_status = 'approved'),
         public.distance_label(auth.uid(), p.id),
         p.music_title,
         coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question_key, 'answer', q.answer) order by q.position)
                   from public.profile_prompts q where q.profile_id = p.id), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'kind', ph.kind, 'path', ph.storage_path) order by ph.position)
                   from public.profile_photos ph where ph.profile_id = p.id), '[]'::jsonb),
         public.profile_details_json(p),
         (x.to_id is not null)
  from public.profiles p cross join me cross join cfg
  -- My earlier pass of this person, if any (0033).
  left join public.passes x on x.from_id = me.id and x.to_id = p.id
  where p.id <> me.id
    and p.onboarding_done and not p.paused
    and p.country = me.country
    and (p.suspended_until is null or p.suspended_until < now())
    and (not p.incognito or exists (select 1 from public.sparks s where s.from_id = p.id and s.to_id = me.id))
    and p.age between me.filter_age_min and me.filter_age_max
    and p.intent = any (me.filter_intents)
    and (not me.filter_verified_only or p.verification_status = 'approved')
    -- "Подробнее обо мне" filters (0032). People who left a field empty stay in the pool.
    and (me.filter_height_min is null or p.height_cm is null or p.height_cm >= me.filter_height_min)
    and (me.filter_height_max is null or p.height_cm is null or p.height_cm <= me.filter_height_max)
    and (cardinality(me.filter_kids) = 0 or p.kids is null or p.kids = any (me.filter_kids))
    and (cardinality(me.filter_smoking) = 0 or p.smoking is null or p.smoking = any (me.filter_smoking))
    and (cardinality(me.filter_languages) = 0 or cardinality(p.languages) = 0 or p.languages && me.filter_languages)
    and coalesce(public.distance_km(me.id, p.id), 0) <= me.filter_distance_km
    and (me.seeking = 'everyone' or (me.seeking = 'men' and p.gender = 'man') or (me.seeking = 'women' and p.gender = 'woman'))
    and (p.seeking = 'everyone' or (p.seeking = 'men' and me.gender = 'man') or (p.seeking = 'women' and me.gender = 'woman'))
    and not public.is_blocked_pair(p.id, me.id)
    -- Passed people come back (0033): never after max_passes passes, never within fallback_minutes of the last
    -- pass; between fallback and cooldown only when nobody fresher is left (see the order below).
    and (x.to_id is null or (x.times < cfg.max_passes and x.created_at < now() - make_interval(mins => cfg.fallback_minutes)))
    and not exists (select 1 from public.sparks s where s.from_id = me.id and s.to_id = p.id)
    and not exists (select 1 from public.matches m where m.ended_at is null
                    and ((m.user_a = me.id and m.user_b = p.id) or (m.user_b = me.id and m.user_a = p.id)))
  -- 1) never passed, random; 2) passed longer ago than the cooldown, oldest pass first;
  -- 3) passed recently (still in the cooldown): only fills the page when 1 and 2 ran out.
  order by case when x.to_id is null then 0
                when x.created_at < now() - make_interval(hours => cfg.cooldown_hours) then 1
                else 2 end,
           x.created_at nulls first,
           random()
  limit least(p_limit, 50);
end $$;
revoke all on function public.discover(int) from public;
grant execute on function public.discover(int) to authenticated;
