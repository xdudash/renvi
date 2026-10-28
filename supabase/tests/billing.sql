-- Billing (0021): processed RevenueCat events are private to the service role; subscriptions gain product_id /
-- last_event_ms, still written only by the server.
\set QUIET 1
begin;

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  if p_uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;
create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
create or replace function pg_temp.expect_error(p_sql text, p_name text, p_state text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_state is not null and sqlstate <> p_state then raise exception 'FAILED (wrong error %: %): %', sqlstate, sqlerrm, p_name; end if;
    raise notice 'ok - % (%)', p_name, sqlerrm;
    return;
  end;
  raise exception 'FAILED (no error): %', p_name;
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000051', 'bill@b.test');

-- ---------- catalog ----------
select pg_temp.check((select relrowsecurity from pg_class where oid = 'public.billing_events'::regclass), 'RLS is enabled on billing_events');
select pg_temp.check(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'billing_events'),
  'billing_events has no policies (service role only)');
select pg_temp.check(not has_table_privilege('authenticated', 'public.billing_events', 'select')
  and not has_table_privilege('authenticated', 'public.billing_events', 'insert')
  and not has_table_privilege('anon', 'public.billing_events', 'select')
  and not has_table_privilege('anon', 'public.billing_events', 'insert'), 'clients have no access to billing_events');
select pg_temp.check(has_table_privilege('service_role', 'public.billing_events', 'insert')
  and has_table_privilege('service_role', 'public.billing_events', 'select'), 'service role can read and write billing_events');
select pg_temp.check(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'product_id')
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'last_event_ms'),
  'subscriptions has product_id and last_event_ms');

-- ---------- event ids are unique ----------
insert into public.billing_events (id, type, user_id, event_ms) values ('evt-1', 'RENEWAL', '00000000-0000-0000-0000-000000000051', 1);
select pg_temp.expect_error($q$insert into public.billing_events (id, type) values ('evt-1', 'RENEWAL')$q$, 'a processed event id cannot be stored twice', '23505');
insert into public.billing_events (id, type) values ('evt-1', 'RENEWAL') on conflict (id) do nothing;
select pg_temp.check((select count(*) from public.billing_events where id = 'evt-1') = 1, 'insert … on conflict do nothing keeps one row (webhook upsert)');
select pg_temp.expect_error($q$insert into public.billing_events (id, type) values ('', 'RENEWAL')$q$, 'empty event id is rejected', '23514');

-- ---------- server writes, client reads own row ----------
set local role service_role;
insert into public.subscriptions (user_id, tier, store, expires_at, product_id, last_event_ms)
  values ('00000000-0000-0000-0000-000000000051', 'plus', 'app_store', now() + interval '30 days', 'renvi.plus.month', 1000);
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000051');
select pg_temp.check((select product_id from public.subscriptions where user_id = auth.uid()) = 'renvi.plus.month',
  'the owner can read product_id of their plan');
select pg_temp.check(public.my_tier() = 'plus', 'my_tier still follows the subscription row');
select pg_temp.expect_error($q$update public.subscriptions set product_id = 'renvi.premium.year', tier = 'premium' where user_id = auth.uid()$q$,
  'client cannot change its own plan or product');
select pg_temp.expect_error($q$select count(*) from public.billing_events$q$, 'client cannot read processed events', '42501');
select pg_temp.as_user(null);
select pg_temp.expect_error($q$insert into public.billing_events (id, type) values ('evt-x', 'TRANSFER')$q$, 'anon cannot insert processed events', '42501');
reset role;

-- account deletion keeps the processed id (no FK), so a late retry stays a no-op
delete from auth.users where id = '00000000-0000-0000-0000-000000000051';
select pg_temp.check(exists (select 1 from public.billing_events where id = 'evt-1'), 'processed event ids survive account deletion');
select pg_temp.check(not exists (select 1 from public.subscriptions where user_id = '00000000-0000-0000-0000-000000000051'),
  'subscription row is removed with the account');

rollback;
