-- profiles.language is nullable without a default (0016); NULL means "never chosen".
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
create or replace function pg_temp.expect_error(p_sql text, p_name text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then raise notice 'ok - % (%)', p_name, sqlerrm; return; end;
  raise exception 'FAILED (no error): %', p_name;
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000004a1', 'lang@test');

select pg_temp.check((select is_nullable = 'YES' and column_default is null from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'language'),
  'profiles.language is nullable with no default');

select pg_temp.as_user('00000000-0000-0000-0000-0000000004a1');
select public.save_onboarding('{"display_name":"Lang"}'::jsonb);
select pg_temp.check((select language is null from public.profiles where id = '00000000-0000-0000-0000-0000000004a1'),
  'new profile has NULL language');
select pg_temp.check((public.save_onboarding('{"bio":"hi"}'::jsonb)).language is null,
  'save_onboarding without language keeps NULL');
select pg_temp.check((public.save_onboarding('{"language":"SK"}'::jsonb)).language = 'SK',
  'save_onboarding stores a chosen language');
select pg_temp.check((public.save_onboarding('{"bio":"again"}'::jsonb)).language = 'SK',
  'save_onboarding without language keeps the chosen one');
select pg_temp.expect_error($q$select public.save_onboarding('{"language":"XX"}'::jsonb)$q$,
  'invalid language is still rejected by the check constraint');

rollback;
