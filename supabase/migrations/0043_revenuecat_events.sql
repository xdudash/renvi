-- Incoming RevenueCat webhook (Edge Function revenuecat-webhook): protection against repeated and out-of-order events.
-- The function never trusts the event body for access; it only uses the event as a signal, asks RevenueCat for the
-- current subscriber record and writes it through plus_set() (same as plus-sync). These tables only remember which
-- events were already handled. Service role only.

create table if not exists public.revenuecat_events (
  event_id text primary key,
  event_type text not null,
  event_ms bigint not null,
  status text not null default 'processing' check (status in ('processing', 'done')),
  received_at timestamptz not null default now()
);
create index if not exists revenuecat_events_received on public.revenuecat_events (received_at);

create table if not exists public.revenuecat_cursor (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_event_ms bigint not null
);

alter table public.revenuecat_events enable row level security;
alter table public.revenuecat_cursor enable row level security;
revoke all on public.revenuecat_events, public.revenuecat_cursor from anon, authenticated;
grant all on public.revenuecat_events, public.revenuecat_cursor to service_role;

-- Claim an event. Returns {status: new|duplicate|stale|busy, users: [known user ids]}.
--   duplicate: already handled. busy: another delivery of the same event is being handled right now (answer 5xx, RevenueCat retries).
--   stale: every person in the event already has a newer handled event (their state was refreshed after this one).
--   A claim stuck in 'processing' for over 2 minutes (function crashed) can be taken over.
create or replace function public.rc_event_claim(p_event_id text, p_type text, p_event_ms bigint, p_users uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare known uuid[]; fresh uuid[]; cur public.revenuecat_events; n int;
begin
  if p_event_id is null or length(p_event_id) = 0 or length(p_event_id) > 200 then raise exception 'bad event id' using errcode = '22023'; end if;
  delete from public.revenuecat_events where received_at < now() - interval '90 days';
  select coalesce(array_agg(u.id), '{}') into known from auth.users u where u.id = any (coalesce(p_users, '{}'));
  insert into public.revenuecat_events (event_id, event_type, event_ms) values (p_event_id, left(p_type, 60), p_event_ms)
    on conflict (event_id) do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    select * into cur from public.revenuecat_events where event_id = p_event_id for update;
    if cur.status = 'done' then return jsonb_build_object('status', 'duplicate', 'users', known); end if;
    if cur.received_at > now() - interval '2 minutes' then return jsonb_build_object('status', 'busy', 'users', known); end if;
    update public.revenuecat_events set received_at = now() where event_id = p_event_id;
  end if;
  select coalesce(array_agg(u), '{}') into fresh from unnest(known) u
    where not exists (select 1 from public.revenuecat_cursor c where c.user_id = u and c.last_event_ms > p_event_ms);
  if coalesce(array_length(known, 1), 0) > 0 and coalesce(array_length(fresh, 1), 0) = 0 then
    update public.revenuecat_events set status = 'done' where event_id = p_event_id;
    return jsonb_build_object('status', 'stale', 'users', known);
  end if;
  return jsonb_build_object('status', 'new', 'users', fresh);
end $$;

-- The state was written: remember the event and move each person's cursor forward (never back).
create or replace function public.rc_event_done(p_event_id text, p_event_ms bigint, p_users uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.revenuecat_events set status = 'done' where event_id = p_event_id;
  insert into public.revenuecat_cursor (user_id, last_event_ms)
    select u.id, p_event_ms from auth.users u where u.id = any (coalesce(p_users, '{}'))
    on conflict (user_id) do update set last_event_ms = greatest(public.revenuecat_cursor.last_event_ms, excluded.last_event_ms);
end $$;

-- Processing failed: forget the claim so the retry from RevenueCat is handled again.
create or replace function public.rc_event_release(p_event_id text) returns void
language sql security definer set search_path = public as $$
  delete from public.revenuecat_events where event_id = p_event_id and status = 'processing'
$$;

revoke all on function public.rc_event_claim(text, text, bigint, uuid[]), public.rc_event_done(text, bigint, uuid[]), public.rc_event_release(text) from public, anon, authenticated;
grant execute on function public.rc_event_claim(text, text, bigint, uuid[]), public.rc_event_done(text, bigint, uuid[]), public.rc_event_release(text) to service_role;
