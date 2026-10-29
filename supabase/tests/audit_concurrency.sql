-- Runtime lock inspection exercises the real RPCs. The same advisory pair lock must be
-- held by both transitions until transaction end, so their reads cannot interleave.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-4000-8000-000000000001','pair-one@example.test',now()),
 ('20000000-0000-4000-8000-000000000002','pair-two@example.test',now());
insert into public.profiles(id,display_name,age,gender,seeking,intent,country,city,onboarding_done,terms_accepted_at,adult_confirmed_at,sensitive_consent_at)
values ('20000000-0000-4000-8000-000000000001','One',30,'man','women','serious','SK','Bratislava',true,now(),now(),now()),
 ('20000000-0000-4000-8000-000000000002','Two',30,'woman','men','serious','SK','Bratislava',true,now(),now(),now());
insert into public.matches(user_a,user_b) values('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
create function pg_temp.holds_advisory(k bigint) returns boolean language sql as $$
 select exists(select 1 from pg_locks where locktype='advisory' and pid=pg_backend_pid() and granted
   and mode='ExclusiveLock' and classid::bigint=((k >> 32) & 4294967295) and objid::bigint=(k & 4294967295) and objsubid=1)
$$;
do $$
declare pair_key bigint := hashtextextended('match-pair:20000000-0000-4000-8000-000000000001:20000000-0000-4000-8000-000000000002',0);
  mid uuid; first_code text; second_code text;
begin
  select id into mid from public.matches where user_a='20000000-0000-4000-8000-000000000001';
  begin
    perform public.send_spark('20000000-0000-4000-8000-000000000002','profile',null,null);
    if not pg_temp.holds_advisory(pair_key) then raise exception 'FAILED: send_spark does not hold pair transition lock'; end if;
    raise exception using errcode='ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  if pg_temp.holds_advisory(pair_key) then raise exception 'FAILED: test subtransaction did not release pair lock'; end if;
  perform public.end_match(mid);
  if not pg_temp.holds_advisory(pair_key) then raise exception 'FAILED: end_match does not hold same pair transition lock'; end if;
  if not exists(select 1 from public.matches where id=mid and ended_at is not null) then raise exception 'FAILED: end_match did not end match'; end if;
  raise notice 'ok - send_spark and end_match hold the same transaction-scoped pair lock';
  first_code := public.my_referral()->>'code';
  if not pg_temp.holds_advisory(hashtextextended('referral-user:20000000-0000-4000-8000-000000000001',0)) then
    raise exception 'FAILED: referral creation does not serialize callers';
  end if;
  second_code := public.my_referral()->>'code';
  if first_code is null or first_code is distinct from second_code then raise exception 'FAILED: referral code is not stable'; end if;
  raise notice 'ok - referral creation holds per-user lock and repeated requests return the same code';
end $$;
rollback;
