-- 0041: the 21:00 «всё ок?» check, polls in the plan chat, and the company hello after a plan.
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
create or replace function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000041' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function pg_temp.state(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlstate; end $$;

-- 1 Host  2 Eva (went, arrived)  3 Tom (going, did not arrive)  4 Outsider  5 Zoe (pending)
insert into auth.users (id, email, email_confirmed_at) select pg_temp.uid(n), 'x' || n || '@extras.test', now() from generate_series(1, 5) g(n);
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done) values
  (pg_temp.uid(1), 'Host', 30, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(2), 'Eva', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(3), 'Tom', 29, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(4), 'Out', 29, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(5), 'Zoe', 26, 'woman', 'men', 'SK', 'Bratislava', 'serious', true);

select pg_temp.as_user(pg_temp.uid(1));
create temp table t_plan as select (public.plan_create(jsonb_build_object('category','market','title','Evening walk','starts_at',(now() + interval '1 day')::text,
  'area','Old Town','place','By the fountain','max_people',6,'auto_accept',true))->>'id')::uuid as id;
select pg_temp.as_user(pg_temp.uid(2)); select public.plan_request((select id from t_plan));
select pg_temp.as_user(pg_temp.uid(3)); select public.plan_request((select id from t_plan));
select pg_temp.as_user(pg_temp.uid(5)); select public.plan_request((select id from t_plan));
reset role;
update public.plan_members set status = 'pending' where user_id = pg_temp.uid(5);
-- the plan happened today at 18:00 Bratislava time
update public.plans set starts_at = ((now() at time zone 'Europe/Bratislava')::date + time '18:00') at time zone 'Europe/Bratislava' where id = (select id from t_plan);
update public.plan_members set arrived_at = now() where user_id = pg_temp.uid(2);
insert into public.push_tokens (token, user_id, platform) select 'ExponentPushToken[' || n || ']', pg_temp.uid(n), 'ios' from generate_series(1, 5) g(n);

-- ================= 21:00 check =================
select pg_temp.check(public.plan_tz('SK') = 'Europe/Bratislava' and public.plan_tz('UA') = 'Europe/Kyiv' and public.plan_tz(null) = 'Europe/Bratislava', 'time zone by country');
select pg_temp.check((select public.plan_check_due_at(p) = (((p.starts_at at time zone 'Europe/Bratislava')::date + time '21:00') at time zone 'Europe/Bratislava') from public.plans p where id = (select id from t_plan)),
  'a plan at 18:00 is checked at 21:00 local');
update public.plans set starts_at = ((now() at time zone 'Europe/Bratislava')::date + time '22:30') at time zone 'Europe/Bratislava' where id = (select id from t_plan);
select pg_temp.check((select public.plan_check_due_at(p) = p.starts_at + interval '2 hours' from public.plans p where id = (select id from t_plan)), 'a late plan is checked two hours after the start');

-- The clock is not under test below: inside this transaction the due time is "one hour ago" (rolled back at the end).
create or replace function public.plan_check_due_at(p public.plans) returns timestamptz language sql stable as $$ select now() - interval '1 hour' $$;
update public.plans set starts_at = now() - interval '3 hours' where id = (select id from t_plan);
select pg_temp.check((select public.plan_check_due_at(p) <= now() and now() < public.plan_check_due_at(p) + interval '6 hours' from public.plans p where id = (select id from t_plan)),
  'the plan is inside the window');
select pg_temp.check((select count(*) from public.plan_check_candidates(100) where plan_id = (select id from t_plan)) = 3,
  'host + two accepted members are asked; the pending request is not');
select pg_temp.check(not exists (select 1 from public.plan_check_candidates(100) where user_id in (pg_temp.uid(4), pg_temp.uid(5))), 'outsiders and pending people are not asked');
insert into public.notification_prefs (user_id, plan_check) values (pg_temp.uid(3), false) on conflict (user_id) do update set plan_check = false;
select pg_temp.check(not exists (select 1 from public.plan_check_candidates(100) where user_id = pg_temp.uid(3)), 'opted-out people are not asked');
delete from public.push_tokens where user_id = pg_temp.uid(2);
select pg_temp.check(not exists (select 1 from public.plan_check_candidates(100) where user_id = pg_temp.uid(2)), 'no push token, nothing to send');
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[2b]', pg_temp.uid(2), 'ios');
select pg_temp.check((select count(*) from public.plan_check_claim(array[(select id from t_plan), (select id from t_plan)], array[pg_temp.uid(1), pg_temp.uid(2)])) = 2, 'claim takes both');
select pg_temp.check((select count(*) from public.plan_check_claim(array[(select id from t_plan)], array[pg_temp.uid(1)])) = 0, 'a second claim for the same person returns nothing');
select pg_temp.check(not exists (select 1 from public.plan_check_candidates(100) where user_id in (pg_temp.uid(1), pg_temp.uid(2))), 'claimed people leave the list');
select pg_temp.check(pg_temp.state($$select * from public.plan_check_candidates(5)$$) = '', 'service side runs');
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check(pg_temp.state($$select * from public.plan_check_candidates(5)$$) = '42501', 'clients cannot list candidates');
select pg_temp.check(pg_temp.state($$select * from public.plan_check_claim('{}', '{}')$$) = '42501', 'clients cannot claim');
select pg_temp.check(public.plan_check_mine((select id from t_plan))->>'answer' is null and public.plan_check_mine((select id from t_plan)) is not null, 'asked, not answered yet');
select public.plan_check_answer((select id from t_plan), false);
select pg_temp.check(public.plan_check_mine((select id from t_plan))->>'answer' = 'help', 'help answer is stored');
select public.plan_check_answer((select id from t_plan), true);
select pg_temp.check(public.plan_check_mine((select id from t_plan))->>'answer' = 'ok', 'the answer can be corrected');
select pg_temp.as_user(pg_temp.uid(4));
select pg_temp.check(public.plan_check_mine((select id from t_plan)) is null, 'never asked: null');
select pg_temp.check(pg_temp.state(format($$select public.plan_check_answer(%L, true)$$, (select id from t_plan))) = 'P0002', 'an outsider cannot answer');

-- ================= polls =================
select pg_temp.as_user(pg_temp.uid(2));
create temp table t_poll as select public.plan_poll_create((select id from t_plan), 'Where do we meet?', array['Fountain', ' Café ', '', 'Bridge'])  as id;
select pg_temp.check((select jsonb_array_length(x->0->'options') = 3 and x->0->>'question' = 'Where do we meet?' from (select public.plan_polls_list((select id from t_plan)) x) q), 'poll created with 3 clean options');
select pg_temp.check(pg_temp.state(format($$select public.plan_poll_create(%L, 'one option', array['only'])$$, (select id from t_plan))) = '22023', 'less than two options is refused');
select pg_temp.check(pg_temp.state(format($$select public.plan_poll_create(%L, 'seven', array['1','2','3','4','5','6','7'])$$, (select id from t_plan))) = '22023', 'more than six options is refused');
select pg_temp.as_user(pg_temp.uid(4));
select pg_temp.check(pg_temp.state(format($$select public.plan_poll_create(%L, 'Hi there', array['a','b'])$$, (select id from t_plan))) = 'P0002', 'an outsider cannot ask');
select pg_temp.check(pg_temp.state(format($$select public.plan_polls_list(%L)$$, (select id from t_plan))) = 'P0002', 'an outsider cannot read polls');
select pg_temp.check(pg_temp.state($$select * from public.plan_polls$$) = '42501', 'poll tables are closed to direct reads');
select pg_temp.as_user(pg_temp.uid(3));
select public.plan_poll_vote((select id from t_poll), (select (public.plan_polls_list((select id from t_plan))->0->'options'->0->>'id')::uuid));
select pg_temp.as_user(pg_temp.uid(1));
select public.plan_poll_vote((select id from t_poll), (select (public.plan_polls_list((select id from t_plan))->0->'options'->0->>'id')::uuid));
select pg_temp.check((select (x->0->'options'->0->>'votes')::int = 2 and x->0->>'my_option' is not null from (select public.plan_polls_list((select id from t_plan)) x) q), 'two votes counted; the host sees their own choice');
select public.plan_poll_vote((select id from t_poll), (select (public.plan_polls_list((select id from t_plan))->0->'options'->1->>'id')::uuid));
select pg_temp.check((select (x->0->'options'->0->>'votes')::int = 1 and (x->0->'options'->1->>'votes')::int = 1 from (select public.plan_polls_list((select id from t_plan)) x) q), 'changing a vote moves it, one vote per person');
select pg_temp.check(pg_temp.state(format($$select public.plan_poll_vote(%L, %L)$$, (select id from t_poll), gen_random_uuid())) = 'P0002', 'an option from nowhere is refused');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(pg_temp.state(format($$select public.plan_poll_close(%L)$$, (select id from t_poll))) = 'P0002', 'a member who is neither author nor host cannot close');
select pg_temp.as_user(pg_temp.uid(1));
select public.plan_poll_close((select id from t_poll));
select pg_temp.check((select (public.plan_polls_list((select id from t_plan))->0->>'closed')::boolean), 'the host closes it');
select pg_temp.check(pg_temp.state(format($$select public.plan_poll_vote(%L, %L)$$, (select id from t_poll), (select (public.plan_polls_list((select id from t_plan))->0->'options'->2->>'id')::uuid))) = 'P0007', 'voting in a closed poll is refused');
select public.plan_poll_create((select id from t_plan), 'Second one', array['a','b']);
select public.plan_poll_create((select id from t_plan), 'Third one', array['a','b']);
select public.plan_poll_create((select id from t_plan), 'Fourth one', array['a','b']);
select pg_temp.check(pg_temp.state(format($$select public.plan_poll_create(%L, 'Fifth one', array['a','b'])$$, (select id from t_plan))) = 'P0006', 'at most three open polls');

-- ================= company hello after the plan =================
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.state(format($$select public.plan_company_hello(%L, %L)$$, (select id from t_plan), pg_temp.uid(3))) = 'P0002', 'somebody who never arrived cannot be greeted through the plan');
select pg_temp.check(pg_temp.state(format($$select public.plan_company_hello(%L, %L)$$, (select id from t_plan), pg_temp.uid(4))) = 'P0002', 'an outsider cannot be greeted through the plan');
select pg_temp.check(pg_temp.state(format($$select public.plan_company_hello(%L, %L)$$, (select id from t_plan), pg_temp.uid(1))) = 'P0002', 'not yourself');
select pg_temp.check((public.plan_company_hello((select id from t_plan), pg_temp.uid(2))->>'connected')::boolean = false, 'host greets Eva: waiting for her hello');
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check((public.plan_company_hello((select id from t_plan), pg_temp.uid(1))->>'connected')::boolean, 'Eva greets back: a company chat opens');
reset role;
select pg_temp.check((select count(*) from public.matches where kind = 'company' and least(user_a, user_b) = least(pg_temp.uid(1), pg_temp.uid(2))) = 1, 'one company match exists');
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check(pg_temp.state(format($$select public.plan_company_hello(%L, %L)$$, (select id from t_plan), pg_temp.uid(5))) = 'P0002', 'a pending request is not a member');
reset role; update public.plans set starts_at = now() + interval '1 day' where id = (select id from t_plan);
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check(pg_temp.state(format($$select public.plan_company_hello(%L, %L)$$, (select id from t_plan), pg_temp.uid(1))) = 'P0002', 'before the plan starts nothing can be sent');

rollback;
\echo ALL TESTS PASSED
