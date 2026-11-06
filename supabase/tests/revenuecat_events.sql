-- 0043: duplicate / stale / in-flight RevenueCat events, and that referral Plus survives a store sync.
\set QUIET 1
begin;
create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
create or replace function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000043' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function pg_temp.state(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlstate; end $$;

insert into auth.users (id, email, email_confirmed_at) select pg_temp.uid(n), 'x' || n || '@rc.test', now() from generate_series(1, 2) g(n);

-- 1 a new event is claimed; unknown users are dropped from the list
select pg_temp.check((public.rc_event_claim('ev1', 'RENEWAL', 1000, array[pg_temp.uid(1), gen_random_uuid()])->>'status') = 'new', 'first delivery is new');
select pg_temp.check(jsonb_array_length(public.rc_event_claim('ev1', 'RENEWAL', 1000, array[pg_temp.uid(1)])->'users') = 1, 'claim lists the known user');
-- 2 the same event while the first one is still being handled is busy (the sender retries later)
select pg_temp.check((public.rc_event_claim('ev1', 'RENEWAL', 1000, array[pg_temp.uid(1)])->>'status') = 'busy', 'a second delivery during processing is busy');
-- 3 once done, a repeat is a duplicate
select public.rc_event_done('ev1', 1000, array[pg_temp.uid(1)]);
select pg_temp.check((public.rc_event_claim('ev1', 'RENEWAL', 1000, array[pg_temp.uid(1)])->>'status') = 'duplicate', 'a handled event is a duplicate');
-- 4 an older event after a newer one is stale
select public.rc_event_claim('ev2', 'RENEWAL', 5000, array[pg_temp.uid(1)]);
select public.rc_event_done('ev2', 5000, array[pg_temp.uid(1)]);
select pg_temp.check((public.rc_event_claim('ev0', 'INITIAL_PURCHASE', 3000, array[pg_temp.uid(1)])->>'status') = 'stale', 'an older event is stale');
select pg_temp.check((select last_event_ms from public.revenuecat_cursor where user_id = pg_temp.uid(1)) = 5000, 'cursor stays at the newest event');
select public.rc_event_done('ev9', 100, array[pg_temp.uid(1)]);
select pg_temp.check((select last_event_ms from public.revenuecat_cursor where user_id = pg_temp.uid(1)) = 5000, 'cursor never moves back');
-- 5 stale for one person, new for another: only the fresh one is listed
select pg_temp.check((public.rc_event_claim('ev3', 'TRANSFER', 4000, array[pg_temp.uid(1), pg_temp.uid(2)])->'users') = to_jsonb(array[pg_temp.uid(2)]), 'transfer: only the person without a newer event');
-- 6 a failed handling is released, the retry is new again
select public.rc_event_release('ev3');
select pg_temp.check((public.rc_event_claim('ev3', 'TRANSFER', 4000, array[pg_temp.uid(1), pg_temp.uid(2)])->>'status') = 'new', 'released claim can be retried');
-- 7 a claim stuck in processing for over 2 minutes is taken over
update public.revenuecat_events set received_at = now() - interval '5 minutes' where event_id = 'ev3';
select pg_temp.check((public.rc_event_claim('ev3', 'TRANSFER', 4000, array[pg_temp.uid(2)])->>'status') = 'new', 'a stuck claim is taken over');
-- 8 release does not remove a finished event
select public.rc_event_done('ev3', 4000, array[pg_temp.uid(2)]);
select public.rc_event_release('ev3');
select pg_temp.check((public.rc_event_claim('ev3', 'TRANSFER', 4000, array[pg_temp.uid(2)])->>'status') = 'duplicate', 'release keeps finished events');
-- 9 bad ids are refused
select pg_temp.check(pg_temp.state($q$select public.rc_event_claim('', 'RENEWAL', 1, '{}')$q$) = '22023', 'empty event id is refused');

-- 10 referral Plus survives a store answer and does not depend on it
select public.plus_grant_days(pg_temp.uid(2), 7);
select public.plus_set(pg_temp.uid(2), null, null, false);
select pg_temp.check(public.is_plus(pg_temp.uid(2)), 'promo Plus survives an empty store answer');
select public.plus_set(pg_temp.uid(2), now() + interval '30 days', 'renvi_plus_monthly', false);
select pg_temp.check((select expires_at > now() + interval '29 days' from public.subscriptions where user_id = pg_temp.uid(2)), 'store renewal is written');
select public.plus_set(pg_temp.uid(2), null, null, false);
select pg_temp.check(public.is_plus(pg_temp.uid(2)) and (select promo_until > now() from public.subscriptions where user_id = pg_temp.uid(2)), 'after a refund the promo week is still there');
update public.subscriptions set promo_until = now() - interval '1 day' where user_id = pg_temp.uid(2);
select pg_temp.check(not public.is_plus(pg_temp.uid(2)), 'expired store + expired promo = Free');

-- 11 the tables are closed to the app
set local role authenticated;
select pg_temp.check(pg_temp.state('select * from public.revenuecat_events') = '42501', 'the app cannot read events');
select pg_temp.check(pg_temp.state($q$select public.rc_event_claim('x', 'RENEWAL', 1, '{}')$q$) = '42501', 'the app cannot claim events');
reset role;
rollback;
\echo ALL TESTS PASSED
