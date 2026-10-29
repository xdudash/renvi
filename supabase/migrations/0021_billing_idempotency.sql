-- Billing hardening for the revenuecat-webhook Edge Function.
-- 1. billing_events: RevenueCat event ids already applied. Retries reuse the same event id, so a replayed or
--    retried event is answered 200 without being applied twice. Written and read only by the service role.
-- 2. subscriptions.product_id: the store product of the active plan (lets the app tell Plus month from Plus year).
-- 3. subscriptions.last_event_ms: event_timestamp_ms of the newest applied event; older events arriving late are
--    not allowed to overwrite newer state.

create table public.billing_events (
  id text primary key check (length(id) between 1 and 200),
  type text not null,
  user_id uuid,              -- no FK: the record must survive account deletion so a late retry stays a no-op
  event_ms bigint,
  processed_at timestamptz not null default now()
);
create index billing_events_processed_at on public.billing_events (processed_at);

alter table public.billing_events enable row level security;
-- No policies: nobody but the service role (which bypasses RLS) may touch it.
revoke all on public.billing_events from public, anon, authenticated;
grant all on public.billing_events to service_role;

alter table public.subscriptions
  add column product_id text check (product_id is null or length(product_id) <= 200),
  add column last_event_ms bigint;

-- 4. Fix: the guard returned NEW, which is NULL in a BEFORE DELETE trigger, so a server-side delete (including the
--    ON DELETE CASCADE from auth.users on account deletion) was silently skipped and left an orphan plan row.
create or replace function public.guard_subscription_write() returns trigger language plpgsql as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'subscriptions are written only by the server' using errcode = '42501';
end $$;
