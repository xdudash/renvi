-- 0044: the seven trigger / helper functions have a fixed search_path and still behave the same.
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
create or replace function pg_temp.state(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlstate; end $$;

select pg_temp.check((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('touch_updated_at','guard_profile_update','guard_profile_insert','guard_profile_delete','guard_photo_update','profiles_set_published_at','profile_details_json')
    and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')) = 7, 'all seven functions have a fixed search_path');
select pg_temp.check(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))), 'no SECURITY DEFINER function in public lacks a search_path');

insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-000000004401', 'a@sp.test', now());
insert into public.profiles (id, display_name, country, city) values ('00000000-0000-0000-0000-000000004401', 'Ann', 'SK', 'Bratislava');
select pg_temp.as_user('00000000-0000-0000-0000-000000004401');
select pg_temp.check(pg_temp.state($$update public.profiles set age = 30 where id = auth.uid()$$) = '42501', 'guard_profile_update still blocks protected fields');
select pg_temp.check(pg_temp.state($$update public.profiles set display_name = 'Anna' where id = auth.uid()$$) = '', 'ordinary profile edits still work');
select pg_temp.check(pg_temp.state($$delete from public.profiles where id = auth.uid()$$) = '42501', 'guard_profile_delete still blocks deleting a profile');
select pg_temp.check((select updated_at >= now() - interval '1 minute' from public.profiles where id = auth.uid()), 'touch_updated_at still sets updated_at');
select pg_temp.check(pg_temp.state($$insert into public.profile_photos (profile_id, storage_path, kind, verified, position) values (auth.uid(), 'x/profile/a.jpg', 'photo', false, 0)$$) = '42501', 'guard_photo_update still checks the photo path');
reset role;
select pg_temp.check(public.profile_details_json((select p from public.profiles p where id = '00000000-0000-0000-0000-000000004401')) = '{}'::jsonb, 'profile_details_json still works');
update public.profiles set onboarding_done = true where id = '00000000-0000-0000-0000-000000004401';
select pg_temp.check((select published_at is not null from public.profiles where id = '00000000-0000-0000-0000-000000004401'), 'profiles_set_published_at still stamps the publication');
rollback;
\echo ALL TESTS PASSED
