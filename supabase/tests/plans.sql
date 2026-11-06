-- Block P (0037): plans — visibility rules, hidden place, requests, limits, chat.
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
  select ('00000000-0000-0000-0000-0000000037' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function pg_temp.state(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlstate; end $$;
create or replace function pg_temp.titles() returns text language sql as $$
  select coalesce(string_agg(x->>'title', ',' order by x->>'title'), '') from jsonb_array_elements(public.plans_feed()) x
$$;
create or replace function pg_temp.mk(p_title text, p_audience text default 'all', p_max int default 5, p_auto boolean default false) returns jsonb language sql as $$
  select public.plan_create(jsonb_build_object('category','market','title',p_title,'starts_at',(now() + interval '2 days')::text,'area','Old Town','place','Main square by the tree',
    'max_people',p_max,'audience',p_audience,'auto_accept',p_auto,'bring','["gloves"]'::jsonb))
$$;

insert into auth.users (id, email, email_confirmed_at) select pg_temp.uid(n), 'p' || n || '@plans.test', now() from generate_series(1, 7) g(n);
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done) values
  (pg_temp.uid(1), 'Host', 30, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(2), 'Eva', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(3), 'Tom', 29, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(4), 'Kid', 19, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(5), 'Far', 28, 'man', 'women', 'CZ', 'Praha', 'serious', true),
  (pg_temp.uid(6), 'Zoe', 26, 'woman', 'men', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(7), 'Ann', 31, 'woman', 'men', 'SK', 'Bratislava', 'serious', true);

-- ---- create ----
select pg_temp.as_user(pg_temp.uid(1));
create temp table t_open as select (pg_temp.mk('Market and mulled wine')->>'id')::uuid as id;
select pg_temp.check((select (public.plan_detail(id)->>'place') = 'Main square by the tree' and (public.plan_detail(id)->>'is_host')::boolean from t_open), 'host sees the exact place');
create temp table t_women as select (pg_temp.mk('Girls night', 'women')->>'id')::uuid as id;
select pg_temp.check(pg_temp.state($$select pg_temp.mk('Third plan')$$) = 'P0008', 'free limit: two active plans');
select pg_temp.check(pg_temp.state($$select public.plan_create('{"category":"market","title":"x","starts_at":"2999-01-01","area":"a","place":"b","max_people":3}')$$) in ('P0008','22023','23514'), 'bad data is rejected');
select public.plan_cancel(id) from t_women;
select pg_temp.check(pg_temp.state($$select pg_temp.mk('Boys day', 'men')$$) = '', 'cancelling frees a slot');

-- ---- visibility ----
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(pg_temp.titles() = 'Boys day,Market and mulled wine', 'a man sees "all" and "men" plans, not women-only or cancelled');
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check(pg_temp.titles() = 'Market and mulled wine', 'a woman does not see men-only plans');
select pg_temp.check((public.plan_detail((select id from t_women))->>'status') = 'cancelled', 'a cancelled plan shows its status');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(pg_temp.state(format($$select public.plan_detail(%L)$$, (select id from t_women))) = 'P0002', 'women-only plan detail is closed to men');
select pg_temp.as_user(pg_temp.uid(5));
select pg_temp.check(pg_temp.titles() = '', 'another city sees nothing');
select pg_temp.as_user(pg_temp.uid(1));
reset role; update public.plans set age_min = 21 where title = 'Market and mulled wine';
select pg_temp.as_user(pg_temp.uid(4));
select pg_temp.check(pg_temp.titles() = 'Boys day', 'age limit hides the plan from a 19-year-old');
reset role; update public.plans set age_min = null where title = 'Market and mulled wine';

-- ---- the hidden place ----
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check((public.plan_detail((select id from t_open))->>'place') is null and (public.plan_detail((select id from t_open))->>'place_hidden')::boolean, 'the place is hidden before approval');
select pg_temp.check(pg_temp.state($$select * from public.plans$$) = '42501', 'plans table is closed to direct reads');
select public.plan_request((select id from t_open), 'hi, I bring cocoa');
select pg_temp.check(public.plan_detail((select id from t_open))->>'my_status' = 'pending', 'request is pending');
select pg_temp.check((public.plan_detail((select id from t_open))->>'place') is null, 'still hidden while pending');
select pg_temp.check(pg_temp.state(format($$select public.plan_request(%L)$$, (select id from t_open))) = 'P0005', 'a second request is refused');
select pg_temp.check(pg_temp.state(format($$select public.plan_chat_send(%L, 'hello')$$, (select id from t_open))) = 'P0002', 'pending people cannot write in the chat');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(pg_temp.state(format($$select public.plan_decide(%L, %L, true)$$, (select id from t_open), pg_temp.uid(2))) = 'P0002', 'only the host decides');
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(jsonb_array_length(public.plan_requests((select id from t_open))) = 1 and (public.plan_requests((select id from t_open))->0->>'name') = 'Eva', 'host sees the request');
select public.plan_decide((select id from t_open), pg_temp.uid(2), true);
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check((public.plan_detail((select id from t_open))->>'place') = 'Main square by the tree', 'after approval the place opens');
select public.plan_chat_send((select id from t_open), 'see you at the tree');
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(jsonb_array_length(public.plan_chat((select id from t_open))) = 1, 'host reads the chat');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(pg_temp.state(format($$select public.plan_chat(%L)$$, (select id from t_open))) = 'P0002', 'outsiders cannot read the chat');
select pg_temp.check(pg_temp.state(format($$select count(*) from public.plan_messages where plan_id = %L$$, (select id from t_open))) = '', 'direct chat read is allowed by policy but returns nothing for outsiders');
select pg_temp.check((select count(*) from public.plan_messages) = 0, 'policy hides messages from outsiders');

-- ---- full plan, auto-accept, withdraw ----
select pg_temp.as_user(pg_temp.uid(1));
select public.plan_cancel(id) from t_open;
create temp table t_small as select (pg_temp.mk('Tiny plan', 'all', 2, true)->>'id')::uuid as id;
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check((public.plan_request((select id from t_small))->>'status') = 'going', 'auto-accept puts the person straight in');
select pg_temp.as_user(pg_temp.uid(6));
select pg_temp.check(pg_temp.state(format($$select public.plan_request(%L)$$, (select id from t_small))) = 'P0009', 'a full plan refuses requests');
select pg_temp.as_user(pg_temp.uid(3));
select public.plan_withdraw((select id from t_small));
select pg_temp.as_user(pg_temp.uid(6));
select pg_temp.check((public.plan_request((select id from t_small))->>'status') = 'going', 'a freed place can be taken');

-- ---- blocks and finishing ----
reset role;
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(1), pg_temp.uid(7));
select pg_temp.as_user(pg_temp.uid(7));
select pg_temp.check(pg_temp.titles() = '', 'a blocked person does not see the host plans');
select pg_temp.as_user(pg_temp.uid(6));
select pg_temp.check(jsonb_array_length(public.plans_mine()->'going') = 1, 'plans_mine lists the plan I am going to');
select pg_temp.check(pg_temp.state(format($$select public.plan_rate(%L, 'fire')$$, (select id from t_small))) = 'P0002', 'cannot rate before the plan took place');
reset role; update public.plans set starts_at = now() - interval '5 hours' where id = (select id from t_small);
select pg_temp.as_user(pg_temp.uid(6));
select public.plan_rate((select id from t_small), 'fire');
select pg_temp.check((public.plans_mine()->'past'->0->>'my_rating') = 'fire', 'rating is saved and shown in past plans');
select pg_temp.check(jsonb_array_length(public.plan_people((select id from t_small))) = 1, 'plan_people lists the others');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(pg_temp.state(format($$select public.plan_request(%L)$$, (select id from t_small))) = 'P0002', 'a finished plan takes no requests');
rollback;
