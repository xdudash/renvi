-- Security audit fixes (see docs/SECURITY_AUDIT.md). Behaviour the app relies on is unchanged.

-- ---------- 1. Function execute privileges ----------
-- Postgres grants EXECUTE to PUBLIC by default, and Supabase additionally grants it to anon on every new
-- function. Nothing in the app is called anonymously except the invite landing (referral_lookup).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;
alter default privileges in schema public revoke execute on functions from anon;

-- Helpers used inside RLS policies / by the app keep working for signed-in users.
grant execute on function public.is_admin, public.my_tier, public.tier_flag, public.daily_like_limit,
  public.is_blocked_pair, public.profile_is_visible, public.match_partner, public.filter_words,
  public.can_read_media, public.leave_deletion_feedback, public.distance_label to authenticated;
grant execute on function public.referral_lookup to anon, authenticated;
-- Edge Functions (service role) keep full access.
grant execute on all functions in schema public to service_role;

-- Distance helpers take two arbitrary user ids; distance_km returns the exact distance, which lets a caller
-- who moves their own coordinates trilaterate anyone. Only discover()/profile_card() (definer) use them.
-- (distance_label stays callable: it only ever returns whole kilometres.)
revoke execute on function public.distance_km(uuid, uuid) from authenticated;

-- ---------- 2. Table privileges ----------
-- Anonymous visitors read only app_config (legal links, prices); everything else stays closed even if RLS slips.
revoke all on all tables in schema public from anon;
grant select on public.app_config to anon;
-- demo_bots is maintained only by the database owner / service role.
revoke insert, update, delete, truncate, references, trigger on public.demo_bots from authenticated;

-- ---------- 3. Profile columns the client may not set directly ----------
-- Age is derived from the birth date (18+ check) inside save_onboarding(); the sensitive-data consent is a
-- timestamp set only by the server; incognito and verified-only are paid features.
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
     or new.adult_confirmed_at is distinct from old.adult_confirmed_at
     or new.sensitive_consent_at is distinct from old.sensitive_consent_at
     or new.age is distinct from old.age
     or (new.incognito and not old.incognito and not public.tier_flag('incognito'))
     or (new.filter_verified_only and not old.filter_verified_only and not public.tier_flag('advanced_filters')) then
    raise exception 'protected field' using errcode = '42501';
  end if;
  return new;
end $$;

-- The UPDATE guard was bypassable by inserting the row with protected values already set
-- (profiles_insert lets a client insert its own row). save_onboarding() inserts as the owner role.
create or replace function public.guard_profile_insert() returns trigger language plpgsql as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') or public.is_admin() then
    return new;
  end if;
  if new.blocked_until is not null or new.suspended_until is not null
     or new.verification_status <> 'none' or new.onboarding_done
     or new.terms_accepted_at is not null or new.adult_confirmed_at is not null
     or new.sensitive_consent_at is not null or new.age is not null
     or new.incognito or new.filter_verified_only then
    raise exception 'protected field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_insert before insert on public.profiles
  for each row execute function public.guard_profile_insert();

create or replace function public.guard_photo_update() returns trigger language plpgsql as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') or public.is_admin() then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.verified) or (tg_op = 'UPDATE' and new.verified is distinct from old.verified) then
    raise exception 'protected field' using errcode = '42501';
  end if;
  -- A profile photo must live in the owner's own profile folder (never someone else's file or a selfie).
  if new.storage_path not like new.profile_id::text || '/profile/%' or new.storage_path like '%..%' then
    raise exception 'bad photo path' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profile_photos_guard before insert or update on public.profile_photos
  for each row execute function public.guard_photo_update();

-- Trigger functions created above are not covered by the loop at the top: close EXECUTE for clients.
revoke execute on function public.guard_profile_insert(), public.guard_photo_update() from public, anon, authenticated;

-- Banned words are checked at publish time; keep them out of the bio after publishing too.
create or replace function public.check_bio_banned_words() returns trigger
language plpgsql security definer set search_path = public as $$
declare banned jsonb;
begin
  if not new.onboarding_done or new.bio is not distinct from old.bio then return new; end if;
  select value into banned from public.app_config where key = 'banned_words';
  if exists (select 1 from jsonb_array_elements_text(coalesce(banned, '[]')) w
             where lower(coalesce(new.bio, '')) like '%' || lower(w) || '%') then
    raise exception 'content rejected' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.check_bio_banned_words() from public, anon, authenticated;
create trigger profiles_bio_words before update on public.profiles
  for each row execute function public.check_bio_banned_words();

-- ---------- 4. Incoming sparks: own country (and only profiles that are visible right now) ----------
create or replace function public.incoming_sparks() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); total int; items jsonb;
begin
  select count(*) into total from public.sparks s
  where s.to_id = me and public.profile_is_visible(s.from_id) and not public.is_blocked_pair(s.from_id, me)
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
        where s.to_id = me and public.profile_is_visible(s.from_id) and not public.is_blocked_pair(s.from_id, me)
          and not exists (select 1 from public.passes x where x.from_id = me and x.to_id = s.from_id)
          and not exists (select 1 from public.sparks mine where mine.from_id = me and mine.to_id = s.from_id)
          and not exists (select 1 from public.matches m where m.ended_at is null
                          and ((m.user_a = me and m.user_b = s.from_id) or (m.user_b = me and m.user_a = s.from_id)))
        limit 100) x;
  return jsonb_build_object('count', total, 'items', items);
end $$;

-- ---------- 5. Chat photos: only files the sender uploaded to their own chat folder ----------
create or replace function public.send_message(p_match uuid, p_client_id uuid, p_body text, p_photo_path text)
returns public.messages language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); msg public.messages; partner uuid;
begin
  partner := public.match_partner(p_match);
  if partner is null then raise exception 'no match' using errcode = '42501'; end if;
  if public.is_blocked_pair(me, partner) then raise exception 'blocked' using errcode = '42501'; end if;
  if p_photo_path is not null then
    if p_photo_path not like me::text || '/chat/%' or p_photo_path like '%..%' then
      raise exception 'bad photo path' using errcode = '42501';
    end if;
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

-- ---------- 6. Reports may quote only messages from the reporter's own conversations ----------
create or replace function public.report(p_target_profile uuid, p_target_message uuid, p_reason text, p_details text)
returns public.reports language plpgsql security definer set search_path = public as $$
declare r public.reports; snap text;
begin
  if p_reason not in ('fake','photos','harassment','scam','underage','illegal','other') then
    raise exception 'bad reason' using errcode = '22023';
  end if;
  if p_target_message is not null then
    select m.body into snap from public.messages m
    where m.id = p_target_message
      and exists (select 1 from public.matches x where x.id = m.match_id and auth.uid() in (x.user_a, x.user_b));
    if not found then raise exception 'not your conversation' using errcode = '42501'; end if;
  end if;
  insert into public.reports (reporter_id, target_profile_id, target_message_id, reason, details, message_snapshot)
    values (auth.uid(), p_target_profile, p_target_message, p_reason, nullif(trim(p_details), ''), snap)
    returning * into r;
  return r;
end $$;
