\set QUIET 1
begin;
create or replace function pg_temp.check(p_ok boolean,p_name text) returns void language plpgsql as $$ begin if p_ok is not true then raise exception 'FAILED: %',p_name; end if; raise notice 'ok - %',p_name; end $$;
create or replace function pg_temp.denied(p_sql text,p_name text) returns void language plpgsql as $$ begin begin execute p_sql; exception when undefined_function then raise; when others then raise notice 'ok - % (%)',p_name,sqlerrm; return; end; raise exception 'FAILED (no error): %',p_name; end $$;
insert into auth.users(id,email,email_confirmed_at) values ('00000000-0000-0000-0000-000000002601','identity@test',now()),('00000000-0000-0000-0000-000000002602','unverified@test',null),('00000000-0000-0000-0000-000000002603','admin@test',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002601',true);
select public.save_onboarding('{"birthdate":"2000-02-29","gender":"man"}');
select pg_temp.denied($q$select public.save_onboarding('{"birthdate":"2000-03-01"}')$q$,'birthdate RPC immutable');
select pg_temp.denied($q$select public.save_onboarding('{"gender":"woman"}')$q$,'gender RPC immutable');
select pg_temp.denied($q$update public.private_profile set birthdate=null where user_id=auth.uid()$q$,'cannot clear chosen birthdate');
select pg_temp.denied($q$update public.profiles set gender=null where id=auth.uid()$q$,'cannot clear chosen gender');
select pg_temp.denied($q$update public.profiles set age=99 where id=auth.uid()$q$,'age cannot be forged');
select public.save_onboarding('{"birthdate":"2000-02-29","gender":"man","bio":"same values allowed"}');
select pg_temp.denied($q$insert into public.private_profile(user_id,birthdate) values(auth.uid(),'2000-03-02') on conflict(user_id) do update set birthdate=excluded.birthdate$q$,'upsert cannot replace birthday');
select pg_temp.check((select gender_locked_at is not null from public.profiles where id=auth.uid()),'gender lock recorded');
select pg_temp.check((select birthdate_locked_at is not null from public.private_profile where user_id=auth.uid()),'birthday lock recorded');
select pg_temp.check(public.age_on_utc_date('2008-10-29','2026-10-29')=18,'birthday age UTC');
select pg_temp.check(public.age_on_utc_date('2008-10-30','2026-10-29')=17,'day before birthday');
select pg_temp.check(public.age_on_utc_date('2008-02-29','2026-02-28')=17,'leap birthday before March');
select pg_temp.check(public.age_on_utc_date('2008-02-29','2026-03-01')=18,'leap birthday March');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002602',true);
select public.save_onboarding('{"display_name":"Unverified","city":"Bratislava"}');
select pg_temp.denied($q$select public.save_onboarding('{"birthdate":"2001-02-29"}')$q$,'invalid Gregorian date');
select pg_temp.denied($q$select public.save_onboarding('{"birthdate":"2099-01-01"}')$q$,'future date');
select pg_temp.denied($q$select public.save_onboarding('{"birthdate":"2020-01-01"}')$q$,'under eighteen');
select pg_temp.denied($q$select public.save_onboarding('{"birthdate":"02/03/2000"}')$q$,'ambiguous birthday format rejected');
select pg_temp.denied($q$select public.publish_profile()$q$,'unverified cannot publish');
select pg_temp.denied($q$select public.discover(10)$q$,'unverified cannot discover');
select pg_temp.denied($q$select public.admin_correct_identity('00000000-0000-0000-0000-000000002601','2000-03-01','woman','correct document')$q$,'non-admin cannot correct');
insert into public.admins(user_id) values ('00000000-0000-0000-0000-000000002603');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002603',true);
select pg_temp.denied($q$select public.admin_correct_identity('00000000-0000-0000-0000-000000002601','2000-03-01','woman','')$q$,'admin reason required');
select public.admin_correct_identity('00000000-0000-0000-0000-000000002601','2000-03-01','woman','Corrected from document');
select pg_temp.check((select gender='woman' from public.profiles where id='00000000-0000-0000-0000-000000002601'),'admin correction applied');
select pg_temp.check((select count(*)=1 from public.admin_actions where action='identity.correct' and target_user='00000000-0000-0000-0000-000000002601' and reason='Corrected from document'),'correction audited');

-- Publishing requires real identity fields, rather than a forged cached age.
insert into auth.users(id,email,email_confirmed_at) values ('00000000-0000-0000-0000-000000002604','publisher@test',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002604',true);
select public.save_onboarding('{"display_name":"Publisher","city":"Bratislava","gender":"man","adult_confirmed":true,"terms_accepted":true,"sensitive_consent":true}');
insert into public.profile_photos(profile_id,storage_path,position) values (auth.uid(),'publisher/1.jpg',0),(auth.uid(),'publisher/2.jpg',1);
select pg_temp.denied($q$select public.publish_profile()$q$,'birthday required for publication');
select public.save_onboarding('{"birthdate":"1999-03-01"}');
select pg_temp.check((public.publish_profile()).onboarding_done,'verified adult publishes after choosing identity');
-- Direct table requests cannot clear identity or erase a locked birthday and choose again.
set local role authenticated;
select pg_temp.denied($q$delete from public.private_profile where user_id=auth.uid()$q$,'cannot delete birthday lock');
select pg_temp.denied($q$update public.private_profile set birthdate='1998-03-01' where user_id=auth.uid()$q$,'direct birthday update denied');
select pg_temp.denied($q$update public.profiles set gender='woman' where id=auth.uid()$q$,'direct gender update denied');
select pg_temp.denied($q$select public.profile_age('00000000-0000-0000-0000-000000002601')$q$,'internal age helper not exposed');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002602',true);
select pg_temp.check(public.profile_card('00000000-0000-0000-0000-000000002604') is null,'unverified cannot read other profiles');
-- A persisted age can lag a birthday; admin demographic buckets use the private birthdate at read time.
reset role;
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-0000-0000-000000002605','birthday-metric@test',now());
insert into public.profiles(id,age,gender) values('00000000-0000-0000-0000-000000002605',18,'woman');
insert into public.private_profile(user_id,birthdate) values('00000000-0000-0000-0000-000000002605','1980-01-01');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000002603',true);
set local role authenticated;
select pg_temp.check(exists(select 1 from jsonb_array_elements(public.admin_analytics()->'demographics') x where x->>'age_group'='45+' and x->>'gender'='woman'),'admin demographic age follows birthdate instead of stale profile age');
reset role;
rollback;

