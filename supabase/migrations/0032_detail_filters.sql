-- Filters by "Подробнее обо мне" (height, kids, smoking, languages) and self-cleaning analytics retention.
-- An empty filter means "any"; profiles that did not fill the field in are never hidden by it, so sparse data
-- cannot empty the feed.
alter table public.profiles
  add column if not exists filter_height_min smallint check (filter_height_min between 120 and 230),
  add column if not exists filter_height_max smallint check (filter_height_max between 120 and 230),
  add column if not exists filter_kids text[] not null default '{}'
    check (filter_kids <@ array['have','want','dont_want','open']),
  add column if not exists filter_smoking text[] not null default '{}'
    check (filter_smoking <@ array['no','sometimes','yes']),
  add column if not exists filter_languages text[] not null default '{}'
    check (cardinality(filter_languages) <= 6 and filter_languages <@ array['ru','uk','sk','cs','en','de','hu','pl','es','fr','it']);
alter table public.profiles drop constraint if exists profiles_filter_height_order;
alter table public.profiles add constraint profiles_filter_height_order
  check (filter_height_min is null or filter_height_max is null or filter_height_min <= filter_height_max);

-- Separate from save_filters() so older clients keep working. Null / empty = no restriction; unknown values are 22023.
create or replace function public.save_filter_details(p_height_min int, p_height_max int, p_kids text[], p_smoking text[], p_languages text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (p_height_min is not null and p_height_min not between 120 and 230)
     or (p_height_max is not null and p_height_max not between 120 and 230)
     or (p_height_min is not null and p_height_max is not null and p_height_min > p_height_max)
     or not (coalesce(p_kids, '{}') <@ array['have','want','dont_want','open'])
     or not (coalesce(p_smoking, '{}') <@ array['no','sometimes','yes'])
     or not (coalesce(p_languages, '{}') <@ array['ru','uk','sk','cs','en','de','hu','pl','es','fr','it'])
     or cardinality(coalesce(p_languages, '{}')) > 6 then
    raise exception 'bad filter values' using errcode = '22023';
  end if;
  update public.profiles set
    filter_height_min = p_height_min, filter_height_max = p_height_max,
    filter_kids = array(select distinct x from unnest(coalesce(p_kids, '{}')) x order by x),
    filter_smoking = array(select distinct x from unnest(coalesce(p_smoking, '{}')) x order by x),
    filter_languages = array(select distinct x from unnest(coalesce(p_languages, '{}')) x order by x)
  where id = auth.uid();
end $$;
revoke all on function public.save_filter_details(int, int, text[], text[], text[]) from public;
grant execute on function public.save_filter_details(int, int, text[], text[], text[]) to authenticated;

create or replace function public.discover(p_limit int default 20) returns table (
  profile_id uuid, display_name text, age smallint, city text, intent text, interests text[],
  verified boolean, distance text, music_title text, prompts jsonb, photos jsonb, details jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_account_active();
  return query
  with me as (select * from public.profiles where id = auth.uid())
  select p.id, p.display_name, p.age, p.city, p.intent, p.interests,
         (p.verification_status = 'approved'),
         public.distance_label(auth.uid(), p.id),
         p.music_title,
         coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question_key, 'answer', q.answer) order by q.position)
                   from public.profile_prompts q where q.profile_id = p.id), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'kind', ph.kind, 'path', ph.storage_path) order by ph.position)
                   from public.profile_photos ph where ph.profile_id = p.id), '[]'::jsonb),
         public.profile_details_json(p)
  from public.profiles p, me
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
    and not exists (select 1 from public.passes x where x.from_id = me.id and x.to_id = p.id)
    and not exists (select 1 from public.sparks s where s.from_id = me.id and s.to_id = p.id)
    and not exists (select 1 from public.matches m where m.ended_at is null
                    and ((m.user_a = me.id and m.user_b = p.id) or (m.user_b = me.id and m.user_a = p.id)))
  order by random()
  limit least(p_limit, 50);
end $$;
revoke all on function public.discover(int) from public;
grant execute on function public.discover(int) to authenticated;

-- Analytics retention without pg_cron (hosted free plans do not have it): a new session runs the 180-day purge when
-- an expired row exists (one indexed lookup). Reporting queries already ignore older rows.
create or replace function public.analytics_purge_sometimes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.analytics_sessions where last_seen_at < now() - interval '180 days')
     or exists (select 1 from public.analytics_events where created_at < now() - interval '180 days') then
    perform public.analytics_purge();
  end if;
  return null;
end $$;
revoke all on function public.analytics_purge_sometimes() from public, anon, authenticated;
drop trigger if exists analytics_purge_sometimes on public.analytics_sessions;
create trigger analytics_purge_sometimes after insert on public.analytics_sessions
  for each statement execute function public.analytics_purge_sometimes();
