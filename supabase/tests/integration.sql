-- Cross-feature checks: admin sanctions (0023) must drive the server action guard (0020).
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
create or replace function pg_temp.spark_ok(p_to uuid) returns boolean language plpgsql as $$
begin
  perform public.send_spark(p_to, 'profile', null, null);
  return true;
exception when others then
  return false;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'ia@test'),
  ('00000000-0000-0000-0000-00000000a002', 'ib@test'),
  ('00000000-0000-0000-0000-00000000a003', 'ic@test'),
  ('00000000-0000-0000-0000-00000000a0ad', 'iadmin@test');
insert into public.profiles (id, display_name, age, gender, seeking, intent, country, city, onboarding_done, terms_accepted_at, adult_confirmed_at, sensitive_consent_at, bio)
values
  ('00000000-0000-0000-0000-00000000a001', 'IA', 27, 'woman', 'everyone', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-00000000a002', 'IB', 28, 'man', 'everyone', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-00000000a003', 'IC', 29, 'man', 'everyone', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000a0ad');

select pg_temp.as_user('00000000-0000-0000-0000-00000000a0ad');
select public.admin_sanction_user('00000000-0000-0000-0000-00000000a001', 'ban', 'integration test');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select pg_temp.check(not pg_temp.spark_ok('00000000-0000-0000-0000-00000000a002'), 'a ban from the admin panel blocks send_spark');

select pg_temp.as_user('00000000-0000-0000-0000-00000000a0ad');
select public.admin_lift_sanction('00000000-0000-0000-0000-00000000a001', 'integration test');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select pg_temp.check(pg_temp.spark_ok('00000000-0000-0000-0000-00000000a002'), 'lifting it in the admin panel restores send_spark');

select pg_temp.as_user('00000000-0000-0000-0000-00000000a0ad');
select public.admin_sanction_user('00000000-0000-0000-0000-00000000a001', 'suspension', 'integration test', 3);
select pg_temp.as_user('00000000-0000-0000-0000-00000000a001');
select pg_temp.check(not pg_temp.spark_ok('00000000-0000-0000-0000-00000000a003'), 'a suspension from the admin panel blocks send_spark');
rollback;
