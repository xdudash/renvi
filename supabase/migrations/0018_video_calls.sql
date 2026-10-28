-- Optional short video call between two matched users before a date (safety feature).
-- Flow: one member requests (request_video_call), the other accepts (respond_video_call) — both must consent.
-- After acceptance the Edge Function `video-call` checks access with video_call_join() as the caller, creates
-- (or reuses) a private Daily.co room for this session (max 2 participants, expires with the session, at most
-- 30 minutes) and returns a meeting token for the caller only. The room is never created before both accepted.
-- Notifications: like `dates`, a Database Webhook on this table calls the `push` function (see docs/SETUP.md).

-- ---------- 1. Rate limits (0015 mechanism) ----------
-- video_call: new call requests per user per hour; video_call_join: room/token requests per user per hour.
-- Existing values in app_config win (the admin may already have set them).
update public.app_config
  set value = '{"video_call": 6, "video_call_join": 30}'::jsonb || value
  where key = 'rate_limits' and jsonb_typeof(value) = 'object';

-- ---------- 2. Call sessions ----------
create table public.video_calls (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested','accepted','declined','cancelled','ended','expired')),
  -- Daily room name; set by the Edge Function (service role) when the first participant joins.
  room_name text check (room_name ~ '^[a-z0-9-]{1,64}$'),
  -- Requested: the invitation lapses at expires_at (10 min). Accepted: the call (and room) ends at expires_at.
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.profiles(id) on delete set null,
  check (status <> 'requested' or expires_at <= created_at + interval '10 minutes'),
  check (accepted_at is null or expires_at <= accepted_at + interval '30 minutes')
);
create index on public.video_calls (match_id, created_at desc);
-- At most one open session per match.
create unique index video_calls_one_open on public.video_calls (match_id) where status in ('requested','accepted');

alter table public.video_calls enable row level security;
create policy video_calls_read on public.video_calls for select to authenticated
  using (public.match_partner(match_id) is not null or public.is_admin());
revoke all on public.video_calls from public, anon, authenticated;
grant select on public.video_calls to authenticated;
grant all on public.video_calls to service_role;

-- ---------- 3. Functions ----------
-- Internal: sessions whose time has passed are closed before any new decision.
create or replace function public.video_call_close_stale(p_match uuid) returns void
language sql security definer set search_path = public as $$
  update public.video_calls set status = 'expired', ended_at = coalesce(ended_at, expires_at)
  where match_id = p_match and status in ('requested','accepted') and expires_at <= now()
$$;

create or replace function public.respond_video_call(p_call uuid, p_action text) returns public.video_calls
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v public.video_calls; partner uuid;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_action not in ('accept','decline') then raise exception 'bad action' using errcode = '22023'; end if;
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

-- Requesting is the caller's consent. If the partner already asked, a request from the other side accepts it.
-- Idempotent: an open session started by the caller (or an already accepted one) is returned as is.
create or replace function public.request_video_call(p_match uuid) returns public.video_calls
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); partner uuid; v public.video_calls;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
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

-- Either member closes the session (cancel a request, or end the call). Allowed even after unmatch/block,
-- so nobody is ever stuck in an open call. Idempotent for already closed sessions.
create or replace function public.end_video_call(p_call uuid) returns public.video_calls
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v public.video_calls;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select c.* into v from public.video_calls c join public.matches m on m.id = c.match_id
    where c.id = p_call and me in (m.user_a, m.user_b) for update of c;
  if v.id is null then raise exception 'no call' using errcode = '42501'; end if;
  if v.status in ('requested','accepted') then
    update public.video_calls set
        status = case when status = 'accepted' then 'ended' when requested_by = me then 'cancelled' else 'declined' end,
        ended_at = now(), ended_by = me
      where id = p_call returning * into v;
  end if;
  return v;
end $$;

-- Authorization check for the Edge Function (called with the user's JWT): the caller is in the active match,
-- neither side blocked the other, both accepted and the session has not expired. Counts against video_call_join.
create or replace function public.video_call_join(p_call uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v public.video_calls; partner uuid;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
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

revoke execute on function public.video_call_close_stale(uuid) from public, anon, authenticated;
revoke execute on function public.request_video_call(uuid), public.respond_video_call(uuid, text),
  public.end_video_call(uuid), public.video_call_join(uuid) from public, anon;
grant execute on function public.request_video_call(uuid), public.respond_video_call(uuid, text),
  public.end_video_call(uuid), public.video_call_join(uuid) to authenticated;
grant execute on function public.video_call_close_stale(uuid), public.request_video_call(uuid),
  public.respond_video_call(uuid, text), public.end_video_call(uuid), public.video_call_join(uuid) to service_role;
