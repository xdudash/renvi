-- "Подробнее обо мне" (0031): owner saves fixed-list details; others see them on the card.
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

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000031a1', 'details@test');
select pg_temp.as_user('00000000-0000-0000-0000-0000000031a1');
select public.save_onboarding('{"display_name":"Det"}'::jsonb);

select pg_temp.check(public.save_profile_details('{"height_cm":178,"languages":["sk","en"],"kids":"open","zodiac":"leo"}'::jsonb)
  = '{"height_cm":178,"languages":["sk","en"],"kids":"open","zodiac":"leo"}'::jsonb, 'details are saved and returned');
select pg_temp.check((public.save_profile_details('{"smoking":"no"}'::jsonb)) ->> 'height_cm' = '178',
  'saving one key keeps the others');
select pg_temp.check(not (public.save_profile_details('{"kids":null,"height_cm":""}'::jsonb) ? 'kids'),
  'null / empty clears a value');
select pg_temp.check((public.profile_card('00000000-0000-0000-0000-0000000031a1') -> 'details' ->> 'zodiac') = 'leo',
  'profile_card includes details');
select pg_temp.expect_error($q$select public.save_profile_details('{"kids":"many"}'::jsonb)$q$, 'unknown value is rejected');
select pg_temp.expect_error($q$select public.save_profile_details('{"height_cm":90}'::jsonb)$q$, 'height out of range is rejected');
select pg_temp.expect_error($q$select public.save_profile_details('{"languages":["xx"]}'::jsonb)$q$, 'unknown language is rejected');

select pg_temp.as_user(null);
select pg_temp.expect_error($q$select public.save_profile_details('{"kids":"open"}'::jsonb)$q$, 'anonymous cannot save details');

rollback;
