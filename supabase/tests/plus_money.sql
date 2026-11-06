-- Block M (0039): Plus entitlements, spark limit, rewarded ads, plan boosts, ads.
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
  select ('00000000-0000-0000-0000-0000000039' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function pg_temp.state(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlstate; end $$;
create or replace function pg_temp.mk(p_title text) returns jsonb language sql as $$
  select public.plan_create(jsonb_build_object('category','market','title',p_title,'starts_at',(now() + interval '2 days')::text,'area','Old Town','place','Main square by the tree',
    'max_people',5,'audience','all','auto_accept',false,'bring','[]'::jsonb))
$$;

insert into auth.users (id, email, email_confirmed_at) select pg_temp.uid(n), 'm' || n || '@money.test', now() from generate_series(1, 8) g(n);
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done)
  select pg_temp.uid(n), 'P' || n, 28, case when n % 2 = 0 then 'woman' else 'man' end, case when n % 2 = 0 then 'men' else 'women' end, 'SK', 'Bratislava', 'serious', true from generate_series(1, 8) g(n);
update public.app_config set value = '2'::jsonb where key = 'daily_spark_limit';

-- ---- Free tier ----
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check((public.my_tier()->>'plus')::boolean = false, 'a new account is Free');
select pg_temp.check((public.my_tier()->>'spark_limit')::int = 2 and (public.my_tier()->>'plan_limit')::int = 2 and (public.my_tier()->>'free_sparks')::int = 2, 'Free: spark limit from config, 2 plans');
select pg_temp.check(pg_temp.state('select * from public.subscriptions') = '42501' or (select count(*) from public.subscriptions) = 0, 'subscriptions are not readable for others');
select pg_temp.check(pg_temp.state(format($$select public.plus_set(%L, now() + interval '1 day', 'x', false)$$, pg_temp.uid(1))) = '42501', 'a client cannot grant itself Plus');
select pg_temp.check(pg_temp.state(format($$select public.plan_boost_apply(%L, gen_random_uuid(), 3, 'tx0', 'p')$$, pg_temp.uid(1))) = '42501', 'a client cannot apply a paid boost');
select public.send_spark(pg_temp.uid(2), 'profile', null, null);
select public.send_spark(pg_temp.uid(4), 'profile', null, null);
select pg_temp.check(pg_temp.state(format($$select public.send_spark(%L, 'profile', null, null)$$, pg_temp.uid(6))) = 'P0003', 'Free: the third spark hits the daily limit');
select pg_temp.check((public.my_tier()->>'sparks_left')::int = 0, 'sparks_left is 0');

-- ---- rewarded ad ----
select pg_temp.check(pg_temp.state('select public.ad_reward_start()') = 'P0002', 'no rewarded ad inventory: nothing to start');
reset role;
insert into public.ads (slot, partner, title, link_url) values ('rewarded', 'Partner', 'Slovak online', 'https://example.com/r'), ('people', 'Partner', 'Card ad', 'https://example.com/p');
select pg_temp.as_user(pg_temp.uid(1));
create temp table t_rw as select (public.ad_reward_start()->>'reward_id')::uuid as id;
select pg_temp.check(pg_temp.state(format($$select public.ad_reward_claim(%L)$$, (select id from t_rw))) = 'P0006', 'claiming before the video ends is refused');
reset role; update public.ad_rewards set started_at = now() - interval '20 seconds';
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check((public.ad_reward_claim((select id from t_rw))->>'spark_limit')::int = 7, 'a watched ad adds 5 sparks to the limit');
select pg_temp.check(pg_temp.state(format($$select public.ad_reward_claim(%L)$$, (select id from t_rw))) = 'P0002', 'a reward is claimed once');
select pg_temp.check(public.send_spark(pg_temp.uid(6), 'profile', null, null)->>'status' = 'sent', 'the extra sparks can be sent');
select pg_temp.check(pg_temp.state(format($$select public.ad_reward_claim(%L)$$, gen_random_uuid())) = 'P0002', 'an unknown reward is refused');
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check(pg_temp.state(format($$select public.ad_reward_claim(%L)$$, (select id from t_rw))) = 'P0002', 'someone else cannot claim my reward');
select pg_temp.as_user(pg_temp.uid(1));
create temp table t_rw2 as select (public.ad_reward_start()->>'reward_id')::uuid as id;
insert into t_rw2 select (public.ad_reward_start()->>'reward_id')::uuid;
reset role; update public.ad_rewards set started_at = now() - interval '20 seconds'; grant select on t_rw2 to authenticated;
select pg_temp.as_user(pg_temp.uid(1));
select public.ad_reward_claim(id) from t_rw2;
select pg_temp.check(pg_temp.state('select public.ad_reward_start()') = 'P0003', 'at most 3 rewarded ads a day');

-- ---- ads for people ----
select pg_temp.check((public.ad_next('people')->>'title') = 'Card ad', 'Free sees a partner card');
select pg_temp.check(pg_temp.state($$select public.ad_next('bad')$$) = '22023', 'unknown slot is refused');
reset role; create temp table t_ad as select id from public.ads where slot = 'people'; grant select on t_ad to authenticated;
select pg_temp.as_user(pg_temp.uid(1));
select public.ad_click((select id from t_ad));
reset role;
select pg_temp.check((select impressions from public.ads where slot = 'people') = 1 and (select clicks from public.ads where slot = 'people') = 1, 'impressions and clicks are counted');
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.state($$insert into public.ads (slot, partner, title, link_url) values ('people', 'x', 'yy', 'https://e.co')$$) in ('42501', '42P17'), 'a normal user cannot add ads');

-- ---- Plus ----
reset role;
select public.plus_set(pg_temp.uid(7), now() + interval '7 days', 'renvi_plus_monthly', true);
select pg_temp.as_user(pg_temp.uid(7));
select pg_temp.check((public.my_tier()->>'plus')::boolean and (public.my_tier()->>'trial')::boolean, 'Plus with trial is reported');
select pg_temp.check((public.my_tier()->>'spark_limit') is null and (public.my_tier()->>'plan_limit')::int = 10, 'Plus: no spark limit, 10 plans');
select public.send_spark(pg_temp.uid(2), 'profile', null, null); select public.send_spark(pg_temp.uid(4), 'profile', null, null); select public.send_spark(pg_temp.uid(6), 'profile', null, null);
select pg_temp.check(public.send_spark(pg_temp.uid(8), 'profile', null, null) is not null, 'Plus sends past the Free limit');
select pg_temp.check(public.ad_next('people') is null, 'Plus gets no ads');
select pg_temp.check(pg_temp.state('select public.ad_reward_start()') = 'P0010', 'Plus cannot start a rewarded ad');
create temp table t_plans as select (pg_temp.mk('Plan ' || n)->>'id')::uuid as id, n from generate_series(1, 3) g(n);
select pg_temp.check((select count(*) from t_plans) = 3, 'Plus hosts more than 2 plans');
select pg_temp.check((public.playbook_state()->>'purchased')::boolean, 'Plus opens the whole Playbook');
select public.playbook_mark_done(5);
select pg_temp.check((public.playbook_state()->'done_lessons') @> '[5]'::jsonb, 'Plus can finish a paid lesson');
-- free weekly boost
select pg_temp.check((public.my_tier()->>'boost_free_ready')::boolean, 'the weekly boost is ready');
select pg_temp.check((public.plan_boost_free((select id from t_plans where n = 1))->>'boosted_until') is not null, 'Plus boosts a plan for free');
select pg_temp.check(pg_temp.state(format($$select public.plan_boost_free(%L)$$, (select id from t_plans where n = 2))) = 'P0005', 'only one free boost a week');
select pg_temp.check(not (public.my_tier()->>'boost_free_ready')::boolean and (public.my_tier()->>'boost_free_at') is not null, 'the next free boost date is shown');
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.state(format($$select public.plan_boost_free(%L)$$, (select id from t_plans where n = 3))) = '42501', 'Free cannot use the free boost');
-- expiry
reset role; select public.plus_set(pg_temp.uid(7), now() - interval '1 minute', 'renvi_plus_monthly', false);
select pg_temp.as_user(pg_temp.uid(7));
select pg_temp.check(not (public.my_tier()->>'plus')::boolean, 'an expired subscription is Free again');
select pg_temp.check(jsonb_array_length(public.plans_mine()->'hosting') = 3 and pg_temp.state('select pg_temp.mk(''Fourth'')') = 'P0008', 'after expiry existing plans stay, new ones obey the Free limit');

-- ---- paid boost ----
reset role;
select pg_temp.check((public.plan_boost_apply(pg_temp.uid(7), (select id from t_plans where n = 2), 24, 'tx-1', 'renvi_boost_24h')->>'applied')::boolean, 'a paid boost is applied');
select pg_temp.check((public.plan_boost_apply(pg_temp.uid(7), (select id from t_plans where n = 2), 24, 'tx-1', 'renvi_boost_24h')->>'already')::boolean, 'the same store transaction is not applied twice');
select pg_temp.check((select boosted_until from public.plans where id = (select id from t_plans where n = 2)) > now() + interval '23 hours', 'boosted_until is about 24 hours ahead');
select pg_temp.check(pg_temp.state(format($$select public.plan_boost_apply(%L, %L, 3, 'tx-2', 'p')$$, pg_temp.uid(1), (select id from t_plans where n = 2))) = 'P0002', 'only the host can boost a plan');
select pg_temp.check(pg_temp.state(format($$select public.plan_boost_apply(%L, %L, 5, 'tx-3', 'p')$$, pg_temp.uid(7), (select id from t_plans where n = 2))) = '22023', 'only 3 and 24 hour boosts exist');
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check((public.plans_feed()->2->>'title') = 'Plan 3', 'boosted plans come before the unboosted one in the feed');
rollback;
