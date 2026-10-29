-- "Подробнее обо мне": optional profile details (height, languages, kids, smoking, drinking, sport, education, pets,
-- zodiac). Every value is optional and chosen from a fixed list, so nothing free-form needs moderation.
alter table public.profiles
  add column if not exists height_cm smallint check (height_cm between 120 and 230),
  add column if not exists languages text[] not null default '{}'
    check (cardinality(languages) <= 6 and languages <@ array['ru','uk','sk','cs','en','de','hu','pl','es','fr','it']),
  add column if not exists kids text check (kids in ('have','want','dont_want','open')),
  add column if not exists smoking text check (smoking in ('no','sometimes','yes')),
  add column if not exists drinking text check (drinking in ('no','socially','often')),
  add column if not exists workout text check (workout in ('never','sometimes','often')),
  add column if not exists education text check (education in ('school','college','bachelor','master','phd')),
  add column if not exists pets text check (pets in ('none','dog','cat','other')),
  add column if not exists zodiac text check (zodiac in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'));

-- Public part of the card: only the details the owner filled in.
create or replace function public.profile_details_json(p public.profiles) returns jsonb
language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'height_cm', p.height_cm, 'languages', case when cardinality(p.languages) > 0 then to_jsonb(p.languages) end,
    'kids', p.kids, 'smoking', p.smoking, 'drinking', p.drinking, 'workout', p.workout,
    'education', p.education, 'pets', p.pets, 'zodiac', p.zodiac))
$$;
revoke all on function public.profile_details_json(public.profiles) from public;

-- Owner saves details; a key present with null / '' clears it. Unknown values fail on the column checks.
create or replace function public.save_profile_details(p_details jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); prof public.profiles;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  update public.profiles set
    height_cm = case when p_details ? 'height_cm' then nullif(p_details->>'height_cm', '')::smallint else height_cm end,
    languages = case when p_details ? 'languages'
                     then coalesce(array(select jsonb_array_elements_text(coalesce(p_details->'languages', '[]'::jsonb))), '{}')
                     else languages end,
    kids = case when p_details ? 'kids' then nullif(p_details->>'kids', '') else kids end,
    smoking = case when p_details ? 'smoking' then nullif(p_details->>'smoking', '') else smoking end,
    drinking = case when p_details ? 'drinking' then nullif(p_details->>'drinking', '') else drinking end,
    workout = case when p_details ? 'workout' then nullif(p_details->>'workout', '') else workout end,
    education = case when p_details ? 'education' then nullif(p_details->>'education', '') else education end,
    pets = case when p_details ? 'pets' then nullif(p_details->>'pets', '') else pets end,
    zodiac = case when p_details ? 'zodiac' then nullif(p_details->>'zodiac', '') else zodiac end
  where id = me
  returning * into prof;
  if prof.id is null then raise exception 'profile not found' using errcode = 'P0002'; end if;
  return public.profile_details_json(prof);
end $$;
revoke all on function public.save_profile_details(jsonb) from public;
grant execute on function public.save_profile_details(jsonb) to authenticated;

-- profile_card (latest: 0020) + 'details'.
create or replace function public.profile_card(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case
    when p.id = auth.uid() or public.is_admin()
         or (public.profile_is_visible(p.id) and not public.is_blocked_pair(p.id, auth.uid())) then
      jsonb_build_object(
        'profile_id', p.id, 'display_name', p.display_name, 'age', p.age, 'city', p.city, 'intent', p.intent,
        'interests', p.interests, 'bio', p.bio, 'verified', p.verification_status = 'approved',
        'distance', public.distance_label(auth.uid(), p.id), 'music_title', p.music_title, 'music_url', p.music_url,
        'details', public.profile_details_json(p),
        'prompts', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question_key, 'answer', q.answer) order by q.position)
                             from public.profile_prompts q where q.profile_id = p.id), '[]'::jsonb),
        'photos', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'kind', ph.kind, 'path', ph.storage_path) order by ph.position)
                            from public.profile_photos ph where ph.profile_id = p.id), '[]'::jsonb))
    when exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.id) then
      jsonb_build_object('profile_id', p.id, 'display_name', p.display_name, 'blocked', true,
                         'interests', '[]'::jsonb, 'prompts', '[]'::jsonb, 'photos', '[]'::jsonb)
  end
  from public.profiles p
  where p.id = p_id
$$;

-- discover (latest: 0020) + 'details' column. The return type changes, so the function is recreated.
drop function if exists public.discover(int);
create function public.discover(p_limit int default 20) returns table (
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

-- Demo profiles get plausible details so the full card can be seen before launch.
update public.profiles p set
  height_cm = case when p.gender = 'woman' then 158 + (abs(hashtext(p.id::text)) % 20) else 172 + (abs(hashtext(p.id::text)) % 20) end,
  languages = string_to_array((array['sk,en', 'ru,sk,en', 'sk,cs,en', 'uk,sk,en', 'sk,de'])[1 + abs(hashtext(p.id::text || 'l')) % 5], ','),
  kids = (array['want','dont_want','open','have'])[1 + abs(hashtext(p.id::text || 'k')) % 4],
  smoking = (array['no','no','sometimes','yes'])[1 + abs(hashtext(p.id::text || 's')) % 4],
  drinking = (array['socially','no','socially','often'])[1 + abs(hashtext(p.id::text || 'd')) % 4],
  workout = (array['sometimes','often','never'])[1 + abs(hashtext(p.id::text || 'w')) % 3],
  education = (array['bachelor','master','college','school','phd'])[1 + abs(hashtext(p.id::text || 'e')) % 5],
  pets = (array['none','dog','cat','other'])[1 + abs(hashtext(p.id::text || 'p')) % 4],
  zodiac = (array['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'])[1 + abs(hashtext(p.id::text || 'z')) % 12]
where p.id in (select user_id from public.demo_bots);

-- Demo profiles with a single answer get two more, so the card shows several answers.
insert into public.profile_prompts (profile_id, question_key, answer, position)
select b.user_id, x.q, x.a, x.pos
from public.demo_bots b
cross join lateral (values
  ('Небольшая радость недели —', (array['нашёл(ла) книжный, который не хотел закрываться','кофе на набережной до работы','первый тёплый вечер на балконе'])[1 + abs(hashtext(b.user_id::text || 'a1')) % 3], 1),
  ('Хочу однажды —', (array['проехать поездом через всю Европу','научиться серфингу','увидеть северное сияние'])[1 + abs(hashtext(b.user_id::text || 'a2')) % 3], 2)
) as x(q, a, pos)
where (select count(*) from public.profile_prompts q where q.profile_id = b.user_id) = 1
  and not exists (select 1 from public.profile_prompts q where q.profile_id = b.user_id and q.question_key = x.q);
