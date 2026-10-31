-- Feed filters by "Подробнее обо мне" (0032) and self-cleaning analytics retention.
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
create or replace function pg_temp.expect_error(p_sql text, p_name text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then raise notice 'ok - % (%)', p_name, sqlerrm; return; end;
  raise exception 'FAILED (no error): %', p_name;
end $$;

-- me (looking for everyone) and four candidates in the same country.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000032a0', 'me@test'), ('00000000-0000-0000-0000-0000000032a1', 'tall@test'),
  ('00000000-0000-0000-0000-0000000032a2', 'short@test'), ('00000000-0000-0000-0000-0000000032a3', 'unset@test'),
  ('00000000-0000-0000-0000-0000000032a4', 'smoker@test');
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done) values
  ('00000000-0000-0000-0000-0000000032a0', 'Me', 28, 'man', 'everyone', 'SK', 'Bratislava', 'serious', true),
  ('00000000-0000-0000-0000-0000000032a1', 'Tall', 28, 'woman', 'everyone', 'SK', 'Bratislava', 'serious', true),
  ('00000000-0000-0000-0000-0000000032a2', 'Short', 28, 'woman', 'everyone', 'SK', 'Bratislava', 'serious', true),
  ('00000000-0000-0000-0000-0000000032a3', 'Unset', 28, 'woman', 'everyone', 'SK', 'Bratislava', 'serious', true),
  ('00000000-0000-0000-0000-0000000032a4', 'Smoker', 28, 'woman', 'everyone', 'SK', 'Bratislava', 'serious', true);
update public.profiles set height_cm = 180, smoking = 'no', languages = '{sk,en}' where id = '00000000-0000-0000-0000-0000000032a1';
update public.profiles set height_cm = 160, smoking = 'no', languages = '{cs}' where id = '00000000-0000-0000-0000-0000000032a2';
update public.profiles set smoking = 'yes', languages = '{sk}', height_cm = 175 where id = '00000000-0000-0000-0000-0000000032a4';

create or replace function pg_temp.names() returns text language sql as $$
  select coalesce(string_agg(display_name, ',' order by display_name), '') from public.discover(50)
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000032a0');
select pg_temp.check(pg_temp.names() = 'Short,Smoker,Tall,Unset', 'no detail filters: everyone is shown');

select public.save_filter_details(170, null, '{}', '{}', '{}');
select pg_temp.check(pg_temp.names() = 'Smoker,Tall,Unset', 'minimum height hides shorter people, keeps unset');
select public.save_filter_details(null, 170, '{}', '{}', '{}');
select pg_temp.check(pg_temp.names() = 'Short,Unset', 'maximum height hides taller people, keeps unset');
select public.save_filter_details(null, null, '{}', '{no,sometimes}', '{}');
select pg_temp.check(pg_temp.names() = 'Short,Tall,Unset', 'smoking filter hides smokers, keeps unset');
select public.save_filter_details(null, null, '{}', '{}', '{sk}');
select pg_temp.check(pg_temp.names() = 'Smoker,Tall,Unset', 'language filter matches any shared language, keeps unset');
select public.save_filter_details(172, 190, '{}', '{no}', '{sk,en}');
select pg_temp.check(pg_temp.names() = 'Tall,Unset', 'filters combine');
select public.save_filter_details(null, null, null, null, null);
select pg_temp.check(pg_temp.names() = 'Short,Smoker,Tall,Unset', 'null clears every detail filter');

select pg_temp.expect_error($q$select public.save_filter_details(100, null, '{}', '{}', '{}')$q$, 'height below range is rejected');
select pg_temp.expect_error($q$select public.save_filter_details(190, 170, '{}', '{}', '{}')$q$, 'inverted height range is rejected');
select pg_temp.expect_error($q$select public.save_filter_details(null, null, '{many}', '{}', '{}')$q$, 'unknown kids value is rejected');
select pg_temp.expect_error($q$select public.save_filter_details(null, null, '{}', '{}', '{xx}')$q$, 'unknown language is rejected');
select pg_temp.as_user(null);
select pg_temp.expect_error($q$select public.save_filter_details(null, null, '{}', '{}', '{}')$q$, 'anonymous cannot save filters');

-- Retention: opening a session after rows expired removes them without cron.
select pg_temp.as_user(null);
reset role;
insert into public.analytics_sessions (user_id, id, started_at, last_seen_at)
  values ('00000000-0000-0000-0000-0000000032a1', '32000000-0000-0000-0000-000000000001', now() - interval '200 days', now() - interval '200 days');
select pg_temp.check(not exists (select 1 from public.analytics_sessions where id = '32000000-0000-0000-0000-000000000001'),
  'expired analytics rows are purged as soon as a session is written');
insert into public.analytics_sessions (user_id, id) values ('00000000-0000-0000-0000-0000000032a1', '32000000-0000-0000-0000-000000000002');
select pg_temp.check(exists (select 1 from public.analytics_sessions where id = '32000000-0000-0000-0000-000000000002'),
  'fresh sessions are kept');

rollback;
