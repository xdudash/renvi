-- No credential values: verify only the admin listing and account boundaries.
begin;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'FAILED: %',label; end if; raise notice 'ok - %',label; end $$;
insert into auth.users(id,email) values
('d0000000-0000-0000-0000-000000000001','operator@example.test'),
('d0000000-0000-0000-0000-000000000002','existing@demo.renvi.app'),
('d0000000-0000-0000-0000-000000000003','real@example.test'),
('d0000000-0000-0000-0000-000000000004','unlisted@demo.renvi.app'),
('d0000000-0000-0000-0000-000000000005','admin@demo.renvi.app');
insert into public.admins(user_id) values ('d0000000-0000-0000-0000-000000000001'),('d0000000-0000-0000-0000-000000000005');
insert into public.demo_bots(user_id) values ('d0000000-0000-0000-0000-000000000002'),('d0000000-0000-0000-0000-000000000003'),('d0000000-0000-0000-0000-000000000005');
set local role authenticated;
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000001',true);
select pg_temp.check((select count(*) = 1 from public.admin_demo_accounts()),'only registered, reserved-domain, non-admin accounts listed');
select pg_temp.check((select email = 'existing@demo.renvi.app' from public.admin_demo_accounts()),'uses existing auth email');
select set_config('request.jwt.claim.sub','d0000000-0000-0000-0000-000000000003',true);
do $$begin
  perform public.admin_demo_accounts();
  raise exception 'FAILED: ordinary user can list demo identities';
exception when insufficient_privilege then raise notice 'ok - ordinary user denied'; end$$;
reset role;
select pg_temp.check(not has_function_privilege('anon','public.admin_demo_accounts()','EXECUTE'),'anonymous denied');
select pg_temp.check(not has_table_privilege('authenticated','public.admin_actions','INSERT'),'client cannot fake reset audit');
rollback;
