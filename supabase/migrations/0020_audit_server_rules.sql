-- External audit 2026-10-28 (server rules S1–S7). See docs/SECURITY_AUDIT.md, section "Внешний аудит серверных правил".
-- Tests: supabase/tests/audit_server.sql.

-- ============================================================================================================
-- S1. Incognito is one server rule for RPCs, tables (profiles/photos/prompts) and media.
-- App copy (privacyVisibility.incognitoSub): "Only people you liked" can see the profile. Exceptions:
--   * the owner and admins (already in the RLS policies / profile_card / can_read_media);
--   * people the incognito user sent a spark to (that is "people you liked");
--   * the partner of an ACTIVE match (a match always followed a spark from the owner, but the partner
--     keeps the view even if that spark is later refreshed/removed; an ended match gives no access).
-- Every other condition (same country, published, not paused, not suspended, blocks) is unchanged.
-- profiles_read, photos_read, prompts_read, profile_card, can_read_media, send_spark, pass_profile and
-- incoming_sparks all call profile_is_visible(), so they follow automatically.
-- ============================================================================================================
create or replace function public.profile_is_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_id and p.onboarding_done and not p.paused
      and (p.suspended_until is null or p.suspended_until < now())
      and p.country = (select country from public.profiles where id = auth.uid())
      and (not p.incognito
           or p.id = auth.uid()
           or exists (select 1 from public.sparks s where s.from_id = p.id and s.to_id = auth.uid())
           or exists (select 1 from public.matches m
                      where m.ended_at is null
                        and m.user_a = least(p.id, auth.uid()) and m.user_b = greatest(p.id, auth.uid())))
  )
$$;

-- ============================================================================================================
-- S2. Sanctioned accounts cannot act on other people.
-- "Restricted" = profiles.suspended_until / blocked_until in the future (what the app and admin tools set),
-- OR an unlifted account_sanctions row: a ban (no end or end in the future) or a suspension that has not ended.
-- Lifting (admin_sanction 'lift', accepted appeal) now also marks the rows as lifted, so both sources agree.
-- ============================================================================================================
alter table public.account_sanctions add column if not exists lifted_at timestamptz;

-- Rows that were already lifted before this migration (profile is no longer suspended) are marked lifted,
-- so nobody becomes restricted only because this migration started reading the table.
update public.account_sanctions s set lifted_at = now()
where s.lifted_at is null and s.kind in ('suspension','ban')
  and not exists (select 1 from public.profiles p where p.id = s.user_id
                  and p.suspended_until is not null and p.suspended_until > now());

create or replace function public.account_restricted(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = p_user
                 and ((p.suspended_until is not null and p.suspended_until > now())
                      or (p.blocked_until is not null and p.blocked_until > now())))
      or exists (select 1 from public.account_sanctions s where s.user_id = p_user and s.lifted_at is null
                 and ((s.kind = 'ban' and (s.until is null or s.until > now()))
                      or (s.kind = 'suspension' and s.until > now())))
$$;

create or replace function public.assert_account_active() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if public.account_restricted(auth.uid()) then
    raise exception 'account restricted' using errcode = '42501', detail = 'sanction';
  end if;
end $$;
revoke execute on function public.account_restricted(uuid), public.assert_account_active() from public, anon, authenticated;
grant execute on function public.account_restricted(uuid), public.assert_account_active() to service_role;

create or replace function public.admin_sanction(p_user uuid, p_kind text, p_reason text, p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_kind not in ('warning','suspension','ban','lift') then raise exception 'bad kind' using errcode = '22023'; end if;
  if p_kind = 'lift' then
    update public.profiles set suspended_until = null where id = p_user;
    update public.account_sanctions set lifted_at = now()
      where user_id = p_user and lifted_at is null and kind in ('suspension','ban');
    return;
  end if;
  insert into public.account_sanctions (user_id, kind, reason, until) values (p_user, p_kind, coalesce(p_reason, 'admin'), p_until);
  if p_kind = 'suspension' then update public.profiles set suspended_until = p_until where id = p_user;
  elsif p_kind = 'ban' then update public.profiles set suspended_until = 'infinity' where id = p_user; end if;
end $$;

create or replace function public.admin_decide_appeal(p_appeal uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.appeals set status = case when p_accept then 'accepted' else 'rejected' end
    where id = p_appeal returning user_id into uid;
  if p_accept and uid is not null then
    update public.profiles set suspended_until = null where id = uid;
    update public.account_sanctions set lifted_at = now()
      where user_id = uid and lifted_at is null and kind in ('suspension','ban');
  end if;
end $$;

-- ---------- user actions: same bodies as their latest versions, plus assert_account_active() first ----------

-- discover (0005): now plpgsql so the check can run first; the query is unchanged.
create or replace function public.discover(p_limit int default 20) returns table (
  profile_id uuid, display_name text, age smallint, city text, intent text, interests text[],
  verified boolean, distance text, music_title text, prompts jsonb, photos jsonb)
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
  limit least(p_limit, 50);
end $$;

create or replace function public.pass_profile(p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_account_active();
  if not public.profile_is_visible(p_to) then raise exception 'not available' using errcode = 'P0002'; end if;
  insert into public.passes (from_id, to_id) values (auth.uid(), p_to) on conflict do nothing;
end $$;

create or replace function public.undo_last_pass() returns uuid
language plpgsql security definer set search_path = public as $$
declare last_to uuid;
begin
  perform public.assert_account_active();
  if not public.tier_flag('undo_pass') then raise exception 'plan required' using errcode = '42501'; end if;
  select to_id into last_to from public.passes where from_id = auth.uid() order by created_at desc limit 1;
  if last_to is null then return null; end if;
  delete from public.passes where from_id = auth.uid() and to_id = last_to;
  return last_to;
end $$;

-- ============================================================================================================
-- S4 (+S2). An ended match reopens only after NEW mutual consent: both sparks must be newer than ended_at.
-- A repeated send_spark after the end refreshes the caller's own spark (new consent, counts as a like today);
-- the partner's old spark does not count until the partner sparks again. Without an ended match send_spark
-- stays idempotent (the existing spark is kept as is). Timestamps use clock_timestamp() so that an end and a
-- new spark inside one transaction are still ordered.
-- ============================================================================================================
create or replace function public.send_spark(p_to uuid, p_kind text, p_ref uuid, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid; a uuid; b uuid; prev_end timestamptz;
begin
  perform public.assert_account_active();
  if p_kind not in ('profile','photo','prompt') then raise exception 'bad target' using errcode = '22023'; end if;
  if not public.profile_is_visible(p_to) or public.is_blocked_pair(me, p_to) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  if (select count(*) from public.sparks where from_id = me and created_at >= date_trunc('day', now())) >= public.daily_like_limit() then
    raise exception 'daily limit' using errcode = 'P0003';
  end if;
  a := least(me, p_to); b := greatest(me, p_to);
  select ended_at into prev_end from public.matches where user_a = a and user_b = b;
  insert into public.sparks (from_id, to_id, target_kind, target_ref, comment, created_at)
    values (me, p_to, p_kind, p_ref, public.filter_words(nullif(trim(p_comment), '')), clock_timestamp())
    on conflict (from_id, to_id) do update
      set target_kind = excluded.target_kind, target_ref = excluded.target_ref,
          comment = excluded.comment, created_at = clock_timestamp()
      where prev_end is not null and public.sparks.created_at <= prev_end;
  if not exists (select 1 from public.sparks
                 where from_id = p_to and to_id = me and (prev_end is null or created_at > prev_end)) then
    return jsonb_build_object('status', 'sent');
  end if;
  insert into public.matches (user_a, user_b) values (a, b)
    on conflict (user_a, user_b) do update set ended_at = null, ended_by = null
    returning id into mid;
  return jsonb_build_object('status', 'match', 'match_id', mid);
end $$;

create or replace function public.end_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  update public.matches set ended_at = clock_timestamp(), ended_by = auth.uid() where id = p_match;
end $$;

-- send_message (0014 §5) + check.
create or replace function public.send_message(p_match uuid, p_client_id uuid, p_body text, p_photo_path text)
returns public.messages language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); msg public.messages; partner uuid;
begin
  perform public.assert_account_active();
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

-- Granting photo consent is an action towards the partner; withdrawing it stays available.
create or replace function public.set_photo_consent(p_match uuid, p_allowed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_allowed then perform public.assert_account_active(); end if;
  if public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  insert into public.photo_consents (match_id, user_id, allowed) values (p_match, auth.uid(), p_allowed)
    on conflict (match_id, user_id) do update set allowed = excluded.allowed, updated_at = now();
end $$;

create or replace function public.propose_date(p_match uuid, p_place text, p_custom text, p_day date, p_time time, p_note text)
returns public.dates language plpgsql security definer set search_path = public as $$
declare d public.dates;
begin
  perform public.assert_account_active();
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
  perform public.assert_account_active();
  select * into d from public.dates where id = p_date;
  if d.id is null or d.status <> 'pending' or d.proposer_id = auth.uid() or public.match_partner(d.match_id) is null then
    raise exception 'cannot respond' using errcode = '42501';
  end if;
  if p_action not in ('accept','decline') then raise exception 'bad action' using errcode = '22023'; end if;
  update public.dates set status = case p_action when 'accept' then 'accepted' else 'declined' end
    where id = p_date returning * into d;
  return d;
end $$;

-- Unblocking re-opens contact, so it is an action; blocking stays available (safety).
create or replace function public.unblock_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_account_active();
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user;
end $$;

-- Video calls (0018) + check. Declining / ending a call stays available.
create or replace function public.respond_video_call(p_call uuid, p_action text) returns public.video_calls
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v public.video_calls; partner uuid;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_action not in ('accept','decline') then raise exception 'bad action' using errcode = '22023'; end if;
  if p_action = 'accept' then perform public.assert_account_active(); end if;
  select * into v from public.video_calls where id = p_call for update;
  partner := case when v.id is null then null else public.match_partner(v.match_id) end;
  if partner is null then raise exception 'no call' using errcode = '42501'; end if;
  if public.is_blocked_pair(me, partner) then raise exception 'blocked' using errcode = '42501'; end if;
  if v.status <> 'requested' or v.requested_by = me or v.expires_at <= now() then
    raise exception 'cannot respond' using errcode = '42501';
  end if;
  update public.video_calls set
      status = case p_action when 'accept' then 'accepted' else 'declined' end,
      accepted_at = case p_action when 'accept' then now() end,
      expires_at = case p_action when 'accept' then now() + interval '30 minutes' else expires_at end,
      ended_at = case p_action when 'decline' then now() end,
      ended_by = case p_action when 'decline' then me end
    where id = p_call returning * into v;
  return v;
end $$;

create or replace function public.request_video_call(p_match uuid) returns public.video_calls
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); partner uuid; v public.video_calls;
begin
  perform public.assert_account_active();
  partner := public.match_partner(p_match);
  if partner is null then raise exception 'no match' using errcode = '42501'; end if;
  if public.is_blocked_pair(me, partner) then raise exception 'blocked' using errcode = '42501'; end if;
  perform public.video_call_close_stale(p_match);
  select * into v from public.video_calls where match_id = p_match and status in ('requested','accepted') for update;
  if found then
    if v.status = 'requested' and v.requested_by <> me then return public.respond_video_call(v.id, 'accept'); end if;
    return v;
  end if;
  perform public.check_rate_limit('video_call');
  insert into public.video_calls (match_id, requested_by, expires_at)
    values (p_match, me, now() + interval '10 minutes') returning * into v;
  return v;
end $$;

create or replace function public.video_call_join(p_call uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v public.video_calls; partner uuid;
begin
  perform public.assert_account_active();
  select * into v from public.video_calls where id = p_call;
  partner := case when v.id is null then null else public.match_partner(v.match_id) end;
  if partner is null then raise exception 'no call' using errcode = '42501'; end if;
  if public.is_blocked_pair(me, partner) then raise exception 'blocked' using errcode = '42501'; end if;
  if v.status <> 'accepted' then raise exception 'call not accepted' using errcode = '42501'; end if;
  if v.expires_at <= now() then raise exception 'call expired' using errcode = '42501'; end if;
  perform public.check_rate_limit('video_call_join');
  return jsonb_build_object(
    'call_id', v.id, 'match_id', v.match_id, 'expires_at', v.expires_at, 'room_name', v.room_name,
    'user_id', me, 'user_name', (select p.display_name from public.profiles p where p.id = me));
end $$;

-- ============================================================================================================
-- S3. A client can no longer delete its profiles row (that wiped sanctions and other people's blocks, and
-- save_onboarding then created a clean profile). The profile goes away only with the auth user
-- (delete-account Edge Function → auth admin API → FK cascade, executed as the table owner).
-- Blocks are written only through block_user()/unblock_user(); direct writes are closed as well.
-- ============================================================================================================
drop policy if exists profiles_delete on public.profiles;
revoke delete on public.profiles from authenticated;
revoke insert, update, delete on public.blocks from authenticated;

create or replace function public.guard_profile_delete() returns trigger language plpgsql as $$
begin
  if current_user in ('postgres','service_role','supabase_admin','supabase_auth_admin') then return old; end if;
  raise exception 'a profile is deleted only together with the account' using errcode = '42501';
end $$;
revoke execute on function public.guard_profile_delete() from public, anon, authenticated;
drop trigger if exists profiles_guard_delete on public.profiles;
create trigger profiles_guard_delete before delete on public.profiles
  for each row execute function public.guard_profile_delete();

-- ============================================================================================================
-- S5. Blocked-list view: the blocker gets only a minimal snapshot (id + display name, no photos/bio/age),
-- never a bypass of visibility. Everyone else gets the full card only when the profile is visible.
-- ============================================================================================================
create or replace function public.profile_card(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case
    when p.id = auth.uid() or public.is_admin()
         or (public.profile_is_visible(p.id) and not public.is_blocked_pair(p.id, auth.uid())) then
      jsonb_build_object(
        'profile_id', p.id, 'display_name', p.display_name, 'age', p.age, 'city', p.city, 'intent', p.intent,
        'interests', p.interests, 'bio', p.bio, 'verified', p.verification_status = 'approved',
        'distance', public.distance_label(auth.uid(), p.id), 'music_title', p.music_title, 'music_url', p.music_url,
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

-- ============================================================================================================
-- S6. Recipients do not read incoming spark rows directly (sender id + comment); Free sees only the count via
-- incoming_sparks(), Plus/Premium the list. Own sent sparks stay readable. The app reads sparks only via RPCs.
-- ============================================================================================================
drop policy if exists sparks_read on public.sparks;
create policy sparks_read on public.sparks for select to authenticated
  using (from_id = auth.uid() or public.is_admin());

-- ============================================================================================================
-- S7. The subscriptions guard returned NEW (NULL) on DELETE, which silently cancelled the cascade from
-- auth.users and left orphan rows. Return OLD on DELETE; remove the orphans left so far.
-- ============================================================================================================
create or replace function public.guard_subscription_write() returns trigger language plpgsql as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'subscriptions are written only by the server' using errcode = '42501';
end $$;

delete from public.subscriptions s where not exists (select 1 from auth.users u where u.id = s.user_id);
