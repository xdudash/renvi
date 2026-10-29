\set QUIET 1
begin;
create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin if not coalesce(p_ok,false) then raise exception 'FAILED: %',p_name; end if; raise notice 'ok - %',p_name; end $$;
create or replace function pg_temp.expect_error(p_sql text, p_name text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then raise notice 'ok - %',p_name; return; end; raise exception 'FAILED (no error): %',p_name; end $$;
insert into auth.users(id,email) values ('a1000000-0000-0000-0000-000000000001','analytics1@test'),('a1000000-0000-0000-0000-000000000002','analytics2@test');
insert into public.profiles(id,display_name) values ('a1000000-0000-0000-0000-000000000001','Analytics'),('a1000000-0000-0000-0000-000000000002','Admin');
insert into public.admins(user_id) values ('a1000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select pg_temp.check(public.analytics_consent() = false,'default consent off');
select public.analytics_record('11111111-1111-1111-1111-111111111111','screen_view','discover',0);
reset role;
select pg_temp.check(not exists(select 1 from public.analytics_events),'off means no event rows');
set local role authenticated;
select public.analytics_set_consent(true);
select public.analytics_record('11111111-1111-1111-1111-111111111111','screen_view','discover',0);
reset role;
update public.analytics_sessions set started_at=clock_timestamp()-interval '31 seconds',last_seen_at=clock_timestamp()-interval '31 seconds';
set local role authenticated;
select public.analytics_record('11111111-1111-1111-1111-111111111111','heartbeat','discover',30);
select pg_temp.expect_error($q$select public.analytics_record('11111111-1111-1111-1111-111111111111','message_body','discover',0)$q$,'arbitrary event rejected');
select pg_temp.expect_error($q$select public.analytics_record('11111111-1111-1111-1111-111111111111','screen_view','chat/private-id',0)$q$,'arbitrary screen rejected');
select pg_temp.expect_error($q$select public.analytics_record('11111111-1111-1111-1111-111111111111','heartbeat','discover',31)$q$,'oversized duration rejected');
select pg_temp.expect_error('select public.admin_analytics()','non-admin aggregate denied');
select pg_temp.expect_error($q$select public.admin_user_analytics('a1000000-0000-0000-0000-000000000002')$q$,'non-admin timeline denied');
select pg_temp.expect_error('select * from public.analytics_events','raw events inaccessible');
reset role;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select pg_temp.check((public.admin_analytics()->>'dau')::int=1,'DAU distinct measured users');
select pg_temp.check((public.admin_analytics()->>'active_seconds')::int=30,'foreground duration aggregate');
select pg_temp.check((public.admin_analytics()->>'sessions')::int=1,'distinct sessions');
select pg_temp.check(jsonb_array_length(public.admin_user_analytics('a1000000-0000-0000-0000-000000000001')->'timeline')=2,'timeline explicit events');
-- Metrics fixtures: one unprofiled signup, one offline outcome recipient and one demo.
reset role;
insert into auth.users(id,email) values('a1000000-0000-0000-0000-000000000003','unprofiled@test'),('a1000000-0000-0000-0000-000000000004','demo@demo.renvi.app');
insert into public.profiles(id,display_name) values('a1000000-0000-0000-0000-000000000004','Demo');
insert into public.demo_bots(user_id) values('a1000000-0000-0000-0000-000000000004');
insert into public.analytics_preferences(user_id,enabled) values('a1000000-0000-0000-0000-000000000002',true),('a1000000-0000-0000-0000-000000000004',true);
insert into public.analytics_sessions(user_id,id,started_at,last_seen_at) values
 ('a1000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-interval '1 day',now()-interval '1 day'),
 ('a1000000-0000-0000-0000-000000000004','44444444-4444-4444-4444-444444444444',now()-interval '8 days',now());
insert into public.analytics_events(user_id,session_id,event,screen,created_at) values
 ('a1000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','screen_view','discover',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'-interval '1 day'),
 ('a1000000-0000-0000-0000-000000000004','44444444-4444-4444-4444-444444444444','screen_view','discover',now());
-- Receiving a match does not imply the offline partner returned.
insert into public.analytics_events(user_id,event) values('a1000000-0000-0000-0000-000000000002','match');
set local role authenticated;
select pg_temp.check((public.admin_analytics()->>'total')::int=3,'total includes unprofiled account and excludes demo');
select pg_temp.check((public.admin_analytics()->>'new')::int=3,'new includes unprofiled signup');
select pg_temp.check((public.admin_analytics()->>'dau')::int=1,'offline match recipient and demo do not inflate DAU');
select pg_temp.check((select (r->>'eligible')::int=1 and (r->>'returned')::int=0 from jsonb_array_elements(public.admin_analytics()->'retention') r where r->>'d'='1'),'D1 mature cohort excludes outcome-only returns and demos');
select pg_temp.check((select (r->>'eligible')::int=0 from jsonb_array_elements(public.admin_analytics()->'retention') r where r->>'d'='7'),'immature D7 excluded');
select pg_temp.check(not exists(select 1 from jsonb_array_elements(public.admin_analytics()->'demographics') r where r ? 'tier'),'demographics have no tier column (no paid plans)');
select pg_temp.check((select sum((r->>'active_seconds')::int)=30 from jsonb_array_elements(public.admin_analytics()->'screens') r),'per-screen duration totals agree');
select pg_temp.check((select sum((r->>'active_seconds')::int)=30 from jsonb_array_elements(public.admin_analytics()->'hourly') r),'UTC hourly durations agree');
select pg_temp.check(public.admin_analytics()->'funnel'->'first_visit'='null'::jsonb,'anonymous visit never fabricated');
reset role;
-- A real foreground return now makes the D1 numerator one.
insert into public.analytics_events(user_id,session_id,event,screen) values('a1000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','screen_view','discover');
set local role authenticated;
select pg_temp.check((select (r->>'returned')::int=1 from jsonb_array_elements(public.admin_analytics()->'retention') r where r->>'d'='1'),'real foreground return counted');
reset role;
-- Sequential funnel does not count an earlier like as completion after onboarding.
insert into public.analytics_events(user_id,session_id,event,screen,created_at) values
 ('a1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','screen_view','onboarding',now()-interval '60 minutes');
insert into public.analytics_events(user_id,event,created_at) values
 ('a1000000-0000-0000-0000-000000000001','like',now()-interval '50 minutes'),
 ('a1000000-0000-0000-0000-000000000001','onboard',now()-interval '40 minutes'),
 ('a1000000-0000-0000-0000-000000000001','match',now()-interval '30 minutes'),
 ('a1000000-0000-0000-0000-000000000001','date',now()-interval '20 minutes');
set local role authenticated;
select pg_temp.check((public.admin_analytics()->'funnel'->>'onboard')::int=1 and (public.admin_analytics()->'funnel'->>'like')::int=0,'out of order actions cannot advance funnel');
reset role;
insert into public.analytics_events(user_id,event,created_at) values('a1000000-0000-0000-0000-000000000001','like',now()-interval '35 minutes');
set local role authenticated;
select pg_temp.check((public.admin_analytics()->'funnel'->>'date')::int=1,'ordered onboarding like match date reaches funnel end');
reset role;
-- Successful product writes emit server outcomes; the client cannot forge them.
insert into public.matches(user_a,user_b) values('a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002');
select pg_temp.check(exists(select 1 from public.analytics_events where user_id='a1000000-0000-0000-0000-000000000001' and event='match' and created_at>=now()),'database match trigger emits consented outcome');
set local role authenticated;
select pg_temp.expect_error($q$select public.analytics_record('11111111-1111-1111-1111-111111111111','match','discover',0)$q$,'client cannot forge product outcome');
reset role;
-- Purge deletes all raw sources after 180 days and is not callable by users.
insert into public.analytics_events(user_id,event,created_at) values('a1000000-0000-0000-0000-000000000002','like',now()-interval '181 days');
select public.analytics_purge();
select pg_temp.check(not exists(select 1 from public.analytics_events where created_at<now()-interval '180 days'),'raw retention purge works');
set local role authenticated;
select pg_temp.expect_error('select public.analytics_purge()','users cannot run maintenance');
reset role;
-- Clean metric fixtures before testing own-data erasure.
delete from public.analytics_events where user_id<>'a1000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.analytics_set_consent(false);
reset role;
select pg_temp.check(not exists(select 1 from public.analytics_events),'revoke erases events');
select pg_temp.check(not exists(select 1 from public.analytics_acquisition),'revoke erases acquisition');
rollback;
