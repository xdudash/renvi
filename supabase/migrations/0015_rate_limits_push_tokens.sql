-- Follow-ups from docs/SECURITY_AUDIT.md: rate limits for report()/submit_appeal(), explicit push-token handover.

-- ---------- 1. Per-user, per-hour rate limits ----------
-- Limits live in app_config so the admin can change them (admin_set_config) without a new build.
-- A missing key or a non-numeric value means "no limit" for that action.
insert into public.app_config (key, value) values ('rate_limits', '{"report": 10, "submit_appeal": 5}')
  on conflict (key) do nothing;

-- One row per (user, action, hour). Only reached through check_rate_limit(); clients have no access at all.
create table public.rate_limit_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, action, window_start)
);
alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from public, anon, authenticated;
grant all on public.rate_limit_counters to service_role;

-- Counts one call and raises SQLSTATE P0429 ('rate limited') once the hourly limit is exceeded.
-- The failed call does not consume quota beyond the limit (the counter update is rolled back with the error).
create or replace function public.check_rate_limit(p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); lim int; n int; w timestamptz := date_trunc('hour', now());
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select case when jsonb_typeof(value -> p_action) = 'number' then (value ->> p_action)::int end
    into lim from public.app_config where key = 'rate_limits';
  if lim is null then return; end if;
  insert into public.rate_limit_counters (user_id, action, window_start, hits) values (me, p_action, w, 1)
    on conflict (user_id, action, window_start) do update set hits = rate_limit_counters.hits + 1
    returning hits into n;
  if n > lim then
    raise exception 'rate limited' using errcode = 'P0429', detail = p_action, hint = 'limit ' || lim || ' per hour';
  end if;
  -- Old windows are useless; keep the table small.
  delete from public.rate_limit_counters where user_id = me and window_start < w - interval '1 day';
end $$;
revoke execute on function public.check_rate_limit(text) from public, anon, authenticated;

-- Same bodies as 0014 §6 / 0002, plus the rate-limit check first.
create or replace function public.report(p_target_profile uuid, p_target_message uuid, p_reason text, p_details text)
returns public.reports language plpgsql security definer set search_path = public as $$
declare r public.reports; snap text;
begin
  perform public.check_rate_limit('report');
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

create or replace function public.submit_appeal(p_report uuid, p_details text) returns public.appeals
language plpgsql security definer set search_path = public as $$
declare a public.appeals;
begin
  perform public.check_rate_limit('submit_appeal');
  if not exists (select 1 from public.reports where id = p_report and reporter_id = auth.uid())
     and not exists (select 1 from public.reports r join public.profiles p on p.id = r.target_profile_id
                     where r.id = p_report and p.id = auth.uid()) then
    raise exception 'not your report' using errcode = '42501';
  end if;
  insert into public.appeals (report_id, user_id, details) values (p_report, auth.uid(), p_details) returning * into a;
  return a;
end $$;

-- ---------- 2. Push tokens: no silent reassignment ----------
-- Before: `on conflict (token) do update set user_id = ...` silently moved a token owned by another account.
-- An Expo push token identifies the app install, not the person, and the server has no other way to know the
-- device. Decision: when a signed-in user registers a token that another account holds, the old owner's row is
-- deleted (that account stops receiving pushes on this device) and a fresh row is created for the caller.
-- The previous owner's other tokens are never touched, and no row is ever updated across accounts.
-- Trade-off: anyone who knows another user's token string could still unsubscribe that device from the other
-- account. Tokens are not exposed by any API (RLS push_own), so this requires access to the device itself;
-- refusing instead would break the legitimate "log out, log in as another account on the same phone" flow
-- and leak pushes for account A to whoever now uses the phone as account B.
create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_token is null or char_length(p_token) not between 10 and 512 then
    raise exception 'bad token' using errcode = '22023';
  end if;
  delete from public.push_tokens where token = p_token and user_id <> me;
  insert into public.push_tokens (token, user_id, platform) values (p_token, me, p_platform)
    on conflict (token) do update set platform = excluded.platform
    where push_tokens.user_id = me;
end $$;
revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
