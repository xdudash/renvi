-- Follow-ups (0015): hourly rate limits for report()/submit_appeal(), push tokens never silently reassigned.
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
  if not p_ok then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
-- Expects an error with the given SQLSTATE (null = any).
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000011', 'a@test'), ('00000000-0000-0000-0000-000000000012', 'b@test');
insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000011'), ('00000000-0000-0000-0000-000000000012');
update public.app_config set value = '{"report": 3, "submit_appeal": 2}' where key = 'rate_limits';

-- ---------- catalog ----------
select pg_temp.check(exists (select 1 from public.app_config where key = 'rate_limits'), 'rate_limits key exists in app_config');
select pg_temp.check(not has_table_privilege('authenticated', 'public.rate_limit_counters', 'select,insert,update,delete'),
  'clients have no access to rate-limit counters');
select pg_temp.check(not has_function_privilege('authenticated', 'public.check_rate_limit(text)', 'execute'),
  'clients cannot call check_rate_limit directly');

-- ---------- report() ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select public.report('00000000-0000-0000-0000-000000000012', null, 'fake', 'one');
select public.report('00000000-0000-0000-0000-000000000012', null, 'fake', 'two');
select public.report('00000000-0000-0000-0000-000000000012', null, 'fake', 'three');
select pg_temp.check((select count(*) from public.reports where reporter_id = auth.uid()) = 3, 'reports up to the limit are accepted');
select pg_temp.expect_error($q$select public.report('00000000-0000-0000-0000-000000000012', null, 'fake', 'four')$q$,
  'report over the hourly limit is rejected with P0429', 'P0429');
select pg_temp.check((select count(*) from public.reports where reporter_id = auth.uid()) = 3, 'rejected report is not stored');
select pg_temp.as_user('00000000-0000-0000-0000-000000000012');
select pg_temp.check((public.report('00000000-0000-0000-0000-000000000011', null, 'fake', 'x')).id is not null, 'limit is per user');

-- Admin raises the limit in app_config: takes effect immediately, no build.
reset role;
update public.app_config set value = '{"report": 4, "submit_appeal": 2}' where key = 'rate_limits';
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select pg_temp.check((public.report('00000000-0000-0000-0000-000000000012', null, 'fake', 'four')).id is not null, 'limit is read from app_config');

-- ---------- submit_appeal() ----------
reset role;
select set_config('test.rep', (select id::text from public.reports
  where target_profile_id = '00000000-0000-0000-0000-000000000012' limit 1), true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000012');
select public.submit_appeal(current_setting('test.rep')::uuid, 'appeal one');
select public.submit_appeal(current_setting('test.rep')::uuid, 'appeal two');
select pg_temp.expect_error($q$select public.submit_appeal(current_setting('test.rep')::uuid, 'appeal three')$q$,
  'appeal over the hourly limit is rejected with P0429', 'P0429');

-- Previous hour's counters do not count.
reset role;
update public.rate_limit_counters set window_start = window_start - interval '1 hour';
select pg_temp.as_user('00000000-0000-0000-0000-000000000012');
select pg_temp.check((public.submit_appeal(current_setting('test.rep')::uuid, 'next hour')).id is not null, 'limit resets in the next hour');

-- ---------- push tokens ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select public.register_push_token('ExponentPushToken[device-1]', 'ios');
select public.register_push_token('ExponentPushToken[device-a-2]', 'android');
select public.register_push_token('ExponentPushToken[device-1]', 'ios');
reset role;
select pg_temp.check((select count(*) from public.push_tokens) = 2, 're-registering own token is idempotent');
-- Mark A's row so we can tell "updated in place" from "deleted and recreated".
update public.push_tokens set created_at = now() - interval '1 day' where token = 'ExponentPushToken[device-1]';
-- Same phone, now signed in as B.
select pg_temp.as_user('00000000-0000-0000-0000-000000000012');
select public.register_push_token('ExponentPushToken[device-1]', 'ios');
reset role;
select pg_temp.check((select user_id from public.push_tokens where token = 'ExponentPushToken[device-1]') = '00000000-0000-0000-0000-000000000012',
  'device token now belongs to the account signed in on it');
select pg_temp.check((select created_at from public.push_tokens where token = 'ExponentPushToken[device-1]') = now(),
  'old owner row was removed and a new row created (not reassigned in place)');
select pg_temp.check((select count(*) from public.push_tokens where user_id = '00000000-0000-0000-0000-000000000011') = 1,
  'old owner keeps tokens of other devices');
select pg_temp.check(not exists (select 1 from pg_proc where proname = 'register_push_token' and prosrc ilike '%set user_id%'),
  'register_push_token never updates user_id of an existing row');
select pg_temp.as_user(null::uuid);
select pg_temp.expect_error($q$select public.register_push_token('ExponentPushToken[device-1]', 'ios')$q$, 'anon cannot register push tokens');

rollback;
