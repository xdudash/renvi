-- Access rules, guarded writes and the RPC surface used by the app.

create table public.photo_consents (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

insert into public.app_config (key, value) values ('banned_words', '[]');

-- ---------- helpers ----------
create or replace function public.my_tier() returns text
language sql stable security definer set search_path = public as $$
  select case when s.expires_at is null or s.expires_at > now() then s.tier else 'free' end
  from (select coalesce((select tier from public.subscriptions where user_id = auth.uid()), 'free') as tier,
               (select expires_at from public.subscriptions where user_id = auth.uid()) as expires_at) s
$$;

create or replace function public.tier_flag(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((c.value -> public.my_tier() ->> p_key)::boolean, false)
  from public.app_config c where c.key = 'tier_limits'
$$;

create or replace function public.daily_like_limit() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((c.value -> public.my_tier() ->> 'daily_likes')::int, 20)
  from public.app_config c where c.key = 'tier_limits'
$$;

create or replace function public.is_blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.profile_is_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_id and p.onboarding_done and not p.paused
      and (p.suspended_until is null or p.suspended_until < now())
      and p.country = (select country from public.profiles where id = auth.uid())
  )
$$;

create or replace function public.match_partner(p_match uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case when m.user_a = auth.uid() then m.user_b else m.user_a end
  from public.matches m
  where m.id = p_match and (m.user_a = auth.uid() or m.user_b = auth.uid()) and m.ended_at is null
$$;

-- Distance is shown rounded to whole kilometres and never exact; no GPS means city-level label.
create or replace function public.distance_label(a uuid, b uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare pa record; pb record; km double precision;
begin
  select * into pa from public.private_profile where user_id = a;
  select * into pb from public.private_profile where user_id = b;
  if pa.location_enabled is not true or pb.location_enabled is not true or pa.lat is null or pb.lat is null then
    return 'в вашем городе';
  end if;
  km := 6371 * 2 * asin(sqrt(
          power(sin(radians(pb.lat - pa.lat) / 2), 2) +
          cos(radians(pa.lat)) * cos(radians(pb.lat)) * power(sin(radians(pb.lng - pa.lng) / 2), 2)));
  return '≈ ' || greatest(1, round(km))::int || ' км';
end $$;

-- ---------- guards: clients may not change safety/billing/moderation columns ----------
create or replace function public.guard_profile_update() returns trigger language plpgsql as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') or public.is_admin() then
    return new;
  end if;
  if new.blocked_until is distinct from old.blocked_until
     or new.suspended_until is distinct from old.suspended_until
     or new.verification_status is distinct from old.verification_status
     or new.onboarding_done is distinct from old.onboarding_done
     or new.terms_accepted_at is distinct from old.terms_accepted_at
     or new.adult_confirmed_at is distinct from old.adult_confirmed_at then
    raise exception 'protected field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.guard_subscription_write() returns trigger language plpgsql as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') then return new; end if;
  raise exception 'subscriptions are written only by the server' using errcode = '42501';
end $$;
create trigger subscriptions_guard before insert or update or delete on public.subscriptions
  for each row execute function public.guard_subscription_write();

-- ---------- row level security ----------
alter table public.app_config enable row level security;
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.private_profile enable row level security;
alter table public.profile_photos enable row level security;
alter table public.profile_prompts enable row level security;
alter table public.passes enable row level security;
alter table public.sparks enable row level security;
alter table public.matches enable row level security;
alter table public.blocks enable row level security;
alter table public.messages enable row level security;
alter table public.match_settings enable row level security;
alter table public.match_reads enable row level security;
alter table public.photo_consents enable row level security;
alter table public.dates enable row level security;
alter table public.reports enable row level security;
alter table public.appeals enable row level security;
alter table public.support_requests enable row level security;
alter table public.account_sanctions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.push_tokens enable row level security;
alter table public.error_events enable row level security;

create policy config_read on public.app_config for select to anon, authenticated using (true);
create policy config_admin on public.app_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy admins_self on public.admins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin()
         or (public.profile_is_visible(id) and not public.is_blocked_pair(id, auth.uid())));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (id = auth.uid() or public.is_admin());

create policy private_own on public.private_profile for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy photos_read on public.profile_photos for select to authenticated
  using (profile_id = auth.uid() or public.is_admin()
         or (public.profile_is_visible(profile_id) and not public.is_blocked_pair(profile_id, auth.uid())));
create policy photos_own on public.profile_photos for all to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

create policy prompts_read on public.profile_prompts for select to authenticated
  using (profile_id = auth.uid() or public.is_admin()
         or (public.profile_is_visible(profile_id) and not public.is_blocked_pair(profile_id, auth.uid())));
create policy prompts_own on public.profile_prompts for all to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- Interactions are created only through the RPCs below; direct reads are limited to the owner.
create policy passes_own on public.passes for select to authenticated using (from_id = auth.uid());
create policy sparks_read on public.sparks for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid() or public.is_admin());
create policy matches_read on public.matches for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid() or public.is_admin());
create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy messages_read on public.messages for select to authenticated
  using (public.match_partner(match_id) is not null or public.is_admin());
create policy match_settings_own on public.match_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy match_reads_own on public.match_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy consents_read on public.photo_consents for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy dates_read on public.dates for select to authenticated
  using (public.match_partner(match_id) is not null or public.is_admin());
create policy reports_own on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy appeals_own on public.appeals for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy support_own on public.support_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy sanctions_own on public.account_sanctions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy subs_own on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy push_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy errors_admin on public.error_events for select to authenticated
  using (public.is_admin());
create policy errors_insert on public.error_events for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- ---------- onboarding ----------
create or replace function public.save_onboarding(p_patch jsonb) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bd date; prof public.profiles;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.profiles (id) values (me) on conflict (id) do nothing;
  if p_patch ? 'birthdate' then
    bd := (p_patch ->> 'birthdate')::date;
    if bd > current_date - interval '18 years' then
      raise exception 'must be 18+' using errcode = '22023';
    end if;
    insert into public.private_profile (user_id, birthdate) values (me, bd)
      on conflict (user_id) do update set birthdate = excluded.birthdate;
    update public.profiles set age = extract(year from age(bd))::smallint where id = me;
  end if;
  if p_patch ? 'lat' then
    insert into public.private_profile (user_id, lat, lng, location_enabled)
      values (me, (p_patch->>'lat')::double precision, (p_patch->>'lng')::double precision, true)
      on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, location_enabled = true;
  end if;
  if p_patch ? 'location_enabled' and (p_patch->>'location_enabled')::boolean = false then
    update public.private_profile set lat = null, lng = null, location_enabled = false where user_id = me;
  end if;
  update public.profiles set
    display_name = coalesce(p_patch->>'display_name', display_name),
    gender = coalesce(p_patch->>'gender', gender),
    seeking = coalesce(p_patch->>'seeking', seeking),
    intent = coalesce(p_patch->>'intent', intent),
    country = coalesce(p_patch->>'country', country),
    city = coalesce(p_patch->>'city', city),
    bio = coalesce(p_patch->>'bio', bio),
    interests = case when p_patch ? 'interests'
                     then array(select jsonb_array_elements_text(p_patch->'interests')) else interests end,
    music_title = coalesce(p_patch->>'music_title', music_title),
    music_url = coalesce(p_patch->>'music_url', music_url),
    language = coalesce(p_patch->>'language', language),
    onboarding_step = coalesce((p_patch->>'onboarding_step')::smallint, onboarding_step),
    paused = coalesce((p_patch->>'paused')::boolean, paused),
    show_active = coalesce((p_patch->>'show_active')::boolean, show_active),
    incognito = case when public.tier_flag('incognito') then coalesce((p_patch->>'incognito')::boolean, incognito) else incognito end
  where id = me
  returning * into prof;
  if p_patch ? 'terms_accepted' and (p_patch->>'terms_accepted')::boolean then
    update public.profiles set terms_accepted_at = now() where id = me and terms_accepted_at is null;
  end if;
  if p_patch ? 'adult_confirmed' and (p_patch->>'adult_confirmed')::boolean then
    update public.profiles set adult_confirmed_at = now() where id = me and adult_confirmed_at is null;
  end if;
  if p_patch ? 'sensitive_consent' and (p_patch->>'sensitive_consent')::boolean then
    update public.profiles set sensitive_consent_at = now() where id = me and sensitive_consent_at is null;
  end if;
  select * into prof from public.profiles where id = me;
  return prof;
end $$;

create or replace function public.publish_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); prof public.profiles; photos int; banned jsonb;
begin
  select * into prof from public.profiles where id = me;
  if prof.id is null then raise exception 'no profile' using errcode = 'P0002'; end if;
  if prof.terms_accepted_at is null or prof.adult_confirmed_at is null or prof.sensitive_consent_at is null then
    raise exception 'consents missing' using errcode = 'P0001';
  end if;
  select count(*) into photos from public.profile_photos where profile_id = me;
  if photos < 2 then raise exception 'at least 2 photos' using errcode = 'P0001'; end if;
  if prof.display_name is null or prof.age is null or prof.city is null then
    raise exception 'profile incomplete' using errcode = 'P0001';
  end if;
  select value into banned from public.app_config where key = 'banned_words';
  if exists (select 1 from jsonb_array_elements_text(banned) w
             where lower(coalesce(prof.bio,'')) like '%' || lower(w) || '%') then
    raise exception 'content rejected' using errcode = 'P0001';
  end if;
  update public.profiles set onboarding_done = true, onboarding_step = 99 where id = me returning * into prof;
  return prof;
end $$;

-- ---------- discovery ----------
create or replace function public.discover(p_limit int default 20) returns table (
  profile_id uuid, display_name text, age smallint, city text, intent text, interests text[],
  verified boolean, distance text, music_title text, prompts jsonb, photos jsonb)
language sql stable security definer set search_path = public as $$
  with me as (select * from public.profiles where id = auth.uid())
  select p.id, p.display_name, p.age, p.city, p.intent, p.interests,
         (p.verification_status = 'approved'),
         public.distance_label(auth.uid(), p.id),
         p.music_title,
         coalesce((select jsonb_agg(jsonb_build_object('question', q.question_key, 'answer', q.answer) order by q.position)
                   from public.profile_prompts q where q.profile_id = p.id), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'kind', ph.kind, 'path', ph.storage_path) order by ph.position)
                   from public.profile_photos ph where ph.profile_id = p.id), '[]'::jsonb)
  from public.profiles p, me
  where p.id <> me.id
    and p.onboarding_done and not p.paused
    and p.country = me.country
    and (p.suspended_until is null or p.suspended_until < now())
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

create or replace function public.likes_today() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.sparks
  where from_id = auth.uid() and created_at >= date_trunc('day', now())
$$;

create or replace function public.pass_profile(p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.profile_is_visible(p_to) then raise exception 'not available' using errcode = 'P0002'; end if;
  insert into public.passes (from_id, to_id) values (auth.uid(), p_to) on conflict do nothing;
end $$;

create or replace function public.undo_last_pass() returns uuid
language plpgsql security definer set search_path = public as $$
declare last_to uuid;
begin
  if not public.tier_flag('undo_pass') then raise exception 'plan required' using errcode = '42501'; end if;
  select to_id into last_to from public.passes where from_id = auth.uid() order by created_at desc limit 1;
  if last_to is null then return null; end if;
  delete from public.passes where from_id = auth.uid() and to_id = last_to;
  return last_to;
end $$;

create or replace function public.filter_words(p_text text) returns text
language plpgsql stable security definer set search_path = public as $$
declare w text; out text := coalesce(p_text, ''); banned jsonb;
begin
  select value into banned from public.app_config where key = 'banned_words';
  for w in select jsonb_array_elements_text(banned) loop
    out := regexp_replace(out, '\m' || regexp_replace(w, '([^[:alnum:]])', '\\\1', 'g') || '\M', '***', 'gi');
  end loop;
  return out;
end $$;

-- A spark is sent to a whole profile, to one photo, or to one prompt answer; a mutual spark makes a match.
create or replace function public.send_spark(p_to uuid, p_kind text, p_ref uuid, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid; reverse_exists boolean; a uuid; b uuid;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_kind not in ('profile','photo','prompt') then raise exception 'bad target' using errcode = '22023'; end if;
  if not public.profile_is_visible(p_to) or public.is_blocked_pair(me, p_to) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  if (select count(*) from public.sparks where from_id = me and created_at >= date_trunc('day', now())) >= public.daily_like_limit() then
    raise exception 'daily limit' using errcode = 'P0003';
  end if;
  insert into public.sparks (from_id, to_id, target_kind, target_ref, comment)
    values (me, p_to, p_kind, p_ref, public.filter_words(nullif(trim(p_comment), '')))
    on conflict (from_id, to_id) do nothing;
  select exists (select 1 from public.sparks where from_id = p_to and to_id = me) into reverse_exists;
  if not reverse_exists then return jsonb_build_object('status', 'sent'); end if;
  a := least(me, p_to); b := greatest(me, p_to);
  insert into public.matches (user_a, user_b) values (a, b) on conflict (user_a, user_b) do update set ended_at = null
    returning id into mid;
  return jsonb_build_object('status', 'match', 'match_id', mid);
end $$;

-- Incoming sparks: Free sees only the count; Plus and Premium see the list.
create or replace function public.incoming_sparks() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); total int; items jsonb;
begin
  select count(*) into total from public.sparks s
  where s.to_id = me and not public.is_blocked_pair(s.from_id, me)
    and not exists (select 1 from public.passes x where x.from_id = me and x.to_id = s.from_id)
    and not exists (select 1 from public.sparks mine where mine.from_id = me and mine.to_id = s.from_id)
    and not exists (select 1 from public.matches m where m.ended_at is null
                    and ((m.user_a = me and m.user_b = s.from_id) or (m.user_b = me and m.user_a = s.from_id)));
  if not public.tier_flag('see_incoming') then
    return jsonb_build_object('count', total, 'items', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', x.from_id, 'name', x.display_name, 'age', x.age, 'city', x.city,
           'comment', x.comment, 'target_kind', x.target_kind, 'target_ref', x.target_ref,
           'created_at', x.created_at) order by x.created_at desc), '[]'::jsonb)
    into items
  from (select s.*, p.display_name, p.age, p.city from public.sparks s
        join public.profiles p on p.id = s.from_id
        where s.to_id = me and not public.is_blocked_pair(s.from_id, me)
          and not exists (select 1 from public.passes x where x.from_id = me and x.to_id = s.from_id)
          and not exists (select 1 from public.sparks mine where mine.from_id = me and mine.to_id = s.from_id)
          and not exists (select 1 from public.matches m where m.ended_at is null
                          and ((m.user_a = me and m.user_b = s.from_id) or (m.user_b = me and m.user_a = s.from_id)))
        limit 100) x;
  return jsonb_build_object('count', total, 'items', items);
end $$;

-- ---------- chat ----------
create or replace function public.send_message(p_match uuid, p_client_id uuid, p_body text, p_photo_path text)
returns public.messages language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); msg public.messages; partner uuid;
begin
  partner := public.match_partner(p_match);
  if partner is null then raise exception 'no match' using errcode = '42501'; end if;
  if public.is_blocked_pair(me, partner) then raise exception 'blocked' using errcode = '42501'; end if;
  if p_photo_path is not null then
    if not exists (select 1 from public.photo_consents c1 join public.photo_consents c2 on c2.match_id = c1.match_id
                   where c1.match_id = p_match and c1.user_id = me and c1.allowed
                     and c2.user_id = partner and c2.allowed) then
      raise exception 'photo consent missing' using errcode = '42501';
    end if;
  end if;
  if p_body is not null and char_length(trim(p_body)) = 0 and p_photo_path is null then
    raise exception 'empty' using errcode = '22023';
  end if;
  insert into public.messages (client_id, match_id, sender_id, body, photo_path)
    values (p_client_id, p_match, me, public.filter_words(p_body), p_photo_path)
    on conflict (sender_id, client_id) do nothing;
  select * into msg from public.messages where sender_id = me and client_id = p_client_id;
  return msg;
end $$;

create or replace function public.list_messages(p_match uuid, p_before timestamptz default null, p_limit int default 50)
returns setof public.messages language sql stable security definer set search_path = public as $$
  select m.* from public.messages m
  where m.match_id = p_match and public.match_partner(p_match) is not null
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc limit least(p_limit, 100)
$$;

create or replace function public.delete_own_message(p_message uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set body = null, photo_path = null, deleted_at = now()
  where id = p_message and sender_id = auth.uid()
$$;

create or replace function public.set_photo_consent(p_match uuid, p_allowed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  insert into public.photo_consents (match_id, user_id, allowed) values (p_match, auth.uid(), p_allowed)
    on conflict (match_id, user_id) do update set allowed = excluded.allowed, updated_at = now();
end $$;

create or replace function public.set_match_settings(p_match uuid, p_muted boolean, p_archived boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  insert into public.match_settings (user_id, match_id, muted, archived) values (auth.uid(), p_match, coalesce(p_muted,false), coalesce(p_archived,false))
    on conflict (user_id, match_id) do update set
      muted = coalesce(p_muted, public.match_settings.muted),
      archived = coalesce(p_archived, public.match_settings.archived);
end $$;

create or replace function public.mark_match_read(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  insert into public.match_reads (user_id, match_id) values (auth.uid(), p_match)
    on conflict (user_id, match_id) do update set read_at = now();
end $$;

create or replace function public.list_matches() returns table (
  match_id uuid, partner_id uuid, partner_name text, partner_age smallint, last_body text, last_at timestamptz,
  unread int, muted boolean, archived boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, public.match_partner(m.id), p.display_name, p.age,
         (select x.body from public.messages x where x.match_id = m.id order by x.created_at desc limit 1),
         (select x.created_at from public.messages x where x.match_id = m.id order by x.created_at desc limit 1),
         (select count(*)::int from public.messages x where x.match_id = m.id and x.sender_id <> auth.uid()
            and x.created_at > coalesce((select r.read_at from public.match_reads r where r.match_id = m.id and r.user_id = auth.uid()), 'epoch')),
         coalesce(s.muted, false), coalesce(s.archived, false), m.created_at
  from public.matches m
  join public.profiles p on p.id = public.match_partner(m.id)
  left join public.match_settings s on s.match_id = m.id and s.user_id = auth.uid()
  where m.ended_at is null and (m.user_a = auth.uid() or m.user_b = auth.uid())
    and not public.is_blocked_pair(m.user_a, m.user_b)
$$;

create or replace function public.end_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  update public.matches set ended_at = now(), ended_by = auth.uid() where id = p_match;
end $$;

-- ---------- dates ----------
create or replace function public.propose_date(p_match uuid, p_place text, p_custom text, p_day date, p_time time, p_note text)
returns public.dates language plpgsql security definer set search_path = public as $$
declare d public.dates;
begin
  if public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  if p_day < current_date then raise exception 'past date' using errcode = '22023'; end if;
  insert into public.dates (match_id, proposer_id, place_key, place_custom, day, starts_at, note)
    values (p_match, auth.uid(), p_place, nullif(trim(p_custom), ''), p_day, p_time, public.filter_words(nullif(trim(p_note), '')))
    returning * into d;
  return d;
end $$;

create or replace function public.respond_date(p_date uuid, p_action text) returns public.dates
language plpgsql security definer set search_path = public as $$
declare d public.dates;
begin
  select * into d from public.dates where id = p_date;
  if d.id is null or d.status <> 'pending' or d.proposer_id = auth.uid() or public.match_partner(d.match_id) is null then
    raise exception 'cannot respond' using errcode = '42501';
  end if;
  if p_action not in ('accept','decline') then raise exception 'bad action' using errcode = '22023'; end if;
  update public.dates set status = case p_action when 'accept' then 'accepted' else 'declined' end
    where id = p_date returning * into d;
  return d;
end $$;

create or replace function public.cancel_date(p_date uuid) returns public.dates
language plpgsql security definer set search_path = public as $$
declare d public.dates;
begin
  update public.dates set status = 'cancelled'
    where id = p_date and status in ('pending','accepted') and public.match_partner(match_id) is not null
    returning * into d;
  if d.id is null then raise exception 'cannot cancel' using errcode = '42501'; end if;
  return d;
end $$;

-- ---------- blocks, reports, appeals, support ----------
create or replace function public.block_user(p_user uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing
$$;

create or replace function public.unblock_user(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user
$$;

create or replace function public.report(p_target_profile uuid, p_target_message uuid, p_reason text, p_details text)
returns public.reports language plpgsql security definer set search_path = public as $$
declare r public.reports; snap text;
begin
  if p_reason not in ('fake','photos','harassment','scam','underage','illegal','other') then
    raise exception 'bad reason' using errcode = '22023';
  end if;
  if p_target_message is not null then
    select body into snap from public.messages where id = p_target_message;
  end if;
  insert into public.reports (reporter_id, target_profile_id, target_message_id, reason, details, message_snapshot)
    values (auth.uid(), p_target_profile, p_target_message, p_reason, nullif(trim(p_details), ''), snap)
    returning * into r;
  return r;
end $$;

create or replace function public.submit_appeal(p_report uuid, p_details text) returns public.appeals
language plpgsql security definer set search_path = public as $$
declare a public.appeals;
begin
  if not exists (select 1 from public.reports where id = p_report and reporter_id = auth.uid())
     and not exists (select 1 from public.reports r join public.profiles p on p.id = r.target_profile_id
                     where r.id = p_report and p.id = auth.uid()) then
    raise exception 'not your report' using errcode = '42501';
  end if;
  insert into public.appeals (report_id, user_id, details) values (p_report, auth.uid(), p_details) returning * into a;
  return a;
end $$;

create or replace function public.submit_support(p_topic text, p_body text, p_include_history boolean)
returns public.support_requests language sql security definer set search_path = public as $$
  insert into public.support_requests (user_id, topic, body, include_history)
  values (auth.uid(), p_topic, p_body, coalesce(p_include_history, false))
  returning *
$$;

create or replace function public.delete_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid()
$$;

-- ---------- push tokens ----------
create or replace function public.register_push_token(p_token text, p_platform text) returns void
language sql security definer set search_path = public as $$
  insert into public.push_tokens (token, user_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform
$$;

-- ---------- grants ----------
revoke all on function public.send_spark, public.pass_profile, public.undo_last_pass, public.discover,
  public.incoming_sparks, public.send_message, public.list_messages, public.list_matches,
  public.propose_date, public.respond_date, public.cancel_date, public.report, public.submit_appeal,
  public.submit_support, public.save_onboarding, public.publish_profile, public.block_user, public.unblock_user,
  public.delete_own_message, public.set_photo_consent, public.set_match_settings, public.mark_match_read,
  public.end_match, public.likes_today, public.delete_account, public.register_push_token from public;
grant execute on function public.send_spark, public.pass_profile, public.undo_last_pass, public.discover,
  public.incoming_sparks, public.send_message, public.list_messages, public.list_matches,
  public.propose_date, public.respond_date, public.cancel_date, public.report, public.submit_appeal,
  public.submit_support, public.save_onboarding, public.publish_profile, public.block_user, public.unblock_user,
  public.delete_own_message, public.set_photo_consent, public.set_match_settings, public.mark_match_read,
  public.end_match, public.likes_today, public.delete_account, public.register_push_token to authenticated;

-- ---------- table and function privileges (RLS does the row filtering) ----------
grant usage on schema public to anon, authenticated, service_role;
grant select on public.app_config to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.admins, public.subscriptions to authenticated;
revoke insert, update, delete on public.admins, public.subscriptions from authenticated;
revoke insert, update, delete on public.passes, public.sparks, public.matches, public.messages,
  public.dates, public.reports, public.appeals, public.account_sanctions, public.error_events from authenticated;
grant select on public.passes, public.sparks, public.matches, public.messages, public.dates,
  public.reports, public.appeals, public.account_sanctions, public.error_events, public.photo_consents to authenticated;
grant all on all tables in schema public to service_role;
