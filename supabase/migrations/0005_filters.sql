-- Matching filters stored on the profile and applied by discover(). Verified-only is a paid filter.
alter table public.profiles
  add column filter_age_min smallint not null default 18 check (filter_age_min >= 18),
  add column filter_age_max smallint not null default 99 check (filter_age_max <= 99),
  add column filter_distance_km smallint not null default 100 check (filter_distance_km between 5 and 100),
  add column filter_verified_only boolean not null default false,
  add column filter_intents text[] not null default '{serious,casual,friends,unsure}';

create or replace function public.save_filters(p_age_min int, p_age_max int, p_distance int, p_verified boolean, p_intents text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_age_min < 18 or p_age_max > 99 or p_age_min > p_age_max then raise exception 'bad age range' using errcode = '22023'; end if;
  update public.profiles set
    filter_age_min = p_age_min, filter_age_max = p_age_max,
    filter_distance_km = greatest(5, least(100, p_distance)),
    filter_verified_only = case when public.tier_flag('advanced_filters') then coalesce(p_verified, false) else false end,
    filter_intents = coalesce(p_intents, '{serious,casual,friends,unsure}')
  where id = auth.uid();
end $$;
revoke all on function public.save_filters from public;
grant execute on function public.save_filters to authenticated;

create or replace function public.distance_km(a uuid, b uuid) returns double precision
language sql stable security definer set search_path = public as $$
  select case when pa.location_enabled and pb.location_enabled and pa.lat is not null and pb.lat is not null then
    6371 * 2 * asin(sqrt(power(sin(radians(pb.lat - pa.lat) / 2), 2) +
      cos(radians(pa.lat)) * cos(radians(pb.lat)) * power(sin(radians(pb.lng - pa.lng) / 2), 2)))
  end
  from public.private_profile pa, public.private_profile pb where pa.user_id = a and pb.user_id = b
$$;

drop function public.discover(int);
create or replace function public.discover(p_limit int default 20) returns table (
  profile_id uuid, display_name text, age smallint, city text, intent text, interests text[],
  verified boolean, distance text, music_title text, prompts jsonb, photos jsonb)
language sql stable security definer set search_path = public as $$
  with me as (select * from public.profiles where id = auth.uid())
  select p.id, p.display_name, p.age, p.city, p.intent, p.interests,
         (p.verification_status = 'approved'),
         public.distance_label(auth.uid(), p.id),
         p.music_title,
         coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question_key, 'answer', q.answer) order by q.position)
                   from public.profile_prompts q where q.profile_id = p.id), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'kind', ph.kind, 'path', ph.storage_path) order by ph.position)
                   from public.profile_photos ph where ph.profile_id = p.id), '[]'::jsonb)
  from public.profiles p, me
  where p.id <> me.id
    and p.onboarding_done and not p.paused
    and p.country = me.country
    and (p.suspended_until is null or p.suspended_until < now())
    and (not p.incognito or exists (select 1 from public.sparks s where s.from_id = p.id and s.to_id = me.id))
    and p.age between me.filter_age_min and me.filter_age_max
    and p.intent = any (me.filter_intents)
    and (not me.filter_verified_only or p.verification_status = 'approved')
    and coalesce(public.distance_km(me.id, p.id), 0) <= me.filter_distance_km
    and (me.seeking = 'everyone' or (me.seeking = 'men' and p.gender = 'man') or (me.seeking = 'women' and p.gender = 'woman'))
    and (p.seeking = 'everyone' or (p.seeking = 'men' and me.gender = 'man') or (p.seeking = 'women' and me.gender = 'woman'))
    and not public.is_blocked_pair(p.id, me.id)
    and not exists (select 1 from public.passes x where x.from_id = me.id and x.to_id = p.id)
    and not exists (select 1 from public.sparks s where s.from_id = me.id and s.to_id = p.id)
    and not exists (select 1 from public.matches m where m.ended_at is null
                    and ((m.user_a = me.id and m.user_b = p.id) or (m.user_b = me.id and m.user_a = p.id)))
  order by random()
  limit least(p_limit, 50)
$$;
revoke all on function public.discover from public;
grant execute on function public.discover to authenticated;

-- Single profile view (opened from incoming sparks, chats and blocked list) with the same visibility rules.
create or replace function public.profile_card(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile_id', p.id, 'display_name', p.display_name, 'age', p.age, 'city', p.city, 'intent', p.intent,
    'interests', p.interests, 'bio', p.bio, 'verified', p.verification_status = 'approved',
    'distance', public.distance_label(auth.uid(), p.id), 'music_title', p.music_title, 'music_url', p.music_url,
    'prompts', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question_key, 'answer', q.answer) order by q.position)
                         from public.profile_prompts q where q.profile_id = p.id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'kind', ph.kind, 'path', ph.storage_path) order by ph.position)
                        from public.profile_photos ph where ph.profile_id = p.id), '[]'::jsonb))
  from public.profiles p
  where p.id = p_id and (p.id = auth.uid() or public.is_admin()
        or exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.id)
        or (public.profile_is_visible(p.id) and not public.is_blocked_pair(p.id, auth.uid())))
$$;
revoke all on function public.profile_card from public;
grant execute on function public.profile_card to authenticated;
