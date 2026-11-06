-- 0045: who gets a push for a message in the group chat of a plan.
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
  select ('00000000-0000-0000-0000-0000000045' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function pg_temp.state(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlstate; end $$;
-- ids of the people who would be pushed for a message
create or replace function pg_temp.who(p_msg uuid) returns uuid[] language sql as $$
  select coalesce(array_agg(user_id order by user_id), '{}') from public.plan_message_push(p_msg)
$$;

-- 1 Host  2 Eva (going)  3 Tom (going)  4 Outsider  5 Zoe (pending)  6 Ben (going, blocked by Eva)  7 Kim (going, no token)
insert into auth.users (id, email, email_confirmed_at) select pg_temp.uid(n), 'x' || n || '@pp.test', now() from generate_series(1, 7) g(n);
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done, language) values
  (pg_temp.uid(1), 'Host', 30, 'man', 'women', 'SK', 'Bratislava', 'serious', true, 'SK'),
  (pg_temp.uid(2), 'Eva', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true, 'EN'),
  (pg_temp.uid(3), 'Tom', 29, 'man', 'women', 'SK', 'Bratislava', 'serious', true, 'RU'),
  (pg_temp.uid(4), 'Out', 29, 'man', 'women', 'SK', 'Bratislava', 'serious', true, 'RU'),
  (pg_temp.uid(5), 'Zoe', 26, 'woman', 'men', 'SK', 'Bratislava', 'serious', true, 'RU'),
  (pg_temp.uid(6), 'Ben', 31, 'man', 'women', 'SK', 'Bratislava', 'serious', true, 'RU'),
  (pg_temp.uid(7), 'Kim', 28, 'woman', 'men', 'SK', 'Bratislava', 'serious', true, 'RU');
select pg_temp.as_user(pg_temp.uid(1));
create temp table t_plan as select (public.plan_create(jsonb_build_object('category','market','title','Evening walk','starts_at',(now() + interval '1 day')::text,
  'area','Old Town','place','By the fountain','max_people',8,'auto_accept',true))->>'id')::uuid as id;
select pg_temp.as_user(pg_temp.uid(2)); select public.plan_request((select id from t_plan));
select pg_temp.as_user(pg_temp.uid(3)); select public.plan_request((select id from t_plan));
select pg_temp.as_user(pg_temp.uid(5)); select public.plan_request((select id from t_plan));
select pg_temp.as_user(pg_temp.uid(6)); select public.plan_request((select id from t_plan));
select pg_temp.as_user(pg_temp.uid(7)); select public.plan_request((select id from t_plan));
reset role;
update public.plan_members set status = 'pending' where user_id = pg_temp.uid(5);
insert into public.push_tokens (token, user_id, platform) select 'ExponentPushToken[' || n || ']', pg_temp.uid(n), 'ios' from generate_series(1, 6) g(n);
create temp table t_msg (n int, id uuid);
create or replace function pg_temp.say(p_n int, p_user uuid) returns void language plpgsql as $$
begin
  with ins as (insert into public.plan_messages (plan_id, user_id, body) values ((select id from t_plan), p_user, 'secret text ' || p_n) returning id)
  insert into t_msg select p_n, id from ins;
end $$;

-- 2 Tom writes: the host and the other going members with a token; not Tom, not the outsider, not the pending request, not Kim (no token)
select pg_temp.say(1, pg_temp.uid(3));
select pg_temp.check(pg_temp.who((select id from t_msg where n = 1)) = (select array_agg(u order by u) from unnest(array[pg_temp.uid(1), pg_temp.uid(2), pg_temp.uid(6)]) u), 'host and going members, not the sender, outsider, pending or token-less people');
-- 3 the recipients carry their language, and the result has nothing but plan, user and language
select pg_temp.say(2, pg_temp.uid(3));
select pg_temp.check((select count(*) from public.plan_message_push((select id from t_msg where n = 2))) = 0, 'a second message within a minute sends nothing (rate limit)');
update public.plan_push_log set sent_at = now() - interval '2 minutes';
select pg_temp.check((select language from public.plan_message_push((select id from t_msg where n = 2)) where user_id = pg_temp.uid(2)) = 'EN', 'language of the recipient is returned');
-- 4 the same message is never pushed twice, even after the minute
update public.plan_push_log set sent_at = now() - interval '5 minutes';
select pg_temp.check((select count(*) from public.plan_message_push((select id from t_msg where n = 2))) = 0, 'a webhook retry of the same message sends nothing');
-- 5 blocks: Ben is blocked by Eva (either direction): Eva does not get Ben's message, Ben does not get Eva's
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(2), pg_temp.uid(6));
update public.plan_push_log set sent_at = now() - interval '5 minutes';
select pg_temp.say(3, pg_temp.uid(6));
select pg_temp.check(not (pg_temp.uid(2) = any (pg_temp.who((select id from t_msg where n = 3)))), 'the blocker is not notified about the blocked person');
update public.plan_push_log set sent_at = now() - interval '5 minutes';
select pg_temp.say(4, pg_temp.uid(2));
select pg_temp.check(not (pg_temp.uid(6) = any (pg_temp.who((select id from t_msg where n = 4)))), 'the blocked person is not notified about the blocker');
delete from public.blocks;
-- 6 notification preferences
insert into public.notification_prefs (user_id, messages) values (pg_temp.uid(1), false) on conflict (user_id) do update set messages = false;
update public.plan_push_log set sent_at = now() - interval '5 minutes';
select pg_temp.say(5, pg_temp.uid(3));
select pg_temp.check(not (pg_temp.uid(1) = any (pg_temp.who((select id from t_msg where n = 5)))), 'people with «Сообщения» off are not notified');
-- 7 suspended people
update public.profiles set suspended_until = now() + interval '1 day' where id = pg_temp.uid(2);
update public.plan_push_log set sent_at = now() - interval '5 minutes';
select pg_temp.say(6, pg_temp.uid(3));
select pg_temp.check(not (pg_temp.uid(2) = any (pg_temp.who((select id from t_msg where n = 6)))), 'suspended people are not notified');
update public.profiles set suspended_until = null where id = pg_temp.uid(2);
-- 8 someone who is not a member cannot be a source: no push for a message from a person who left
update public.plan_members set status = 'left' where user_id = pg_temp.uid(3);
update public.plan_push_log set sent_at = now() - interval '5 minutes';
select pg_temp.say(7, pg_temp.uid(3));
select pg_temp.check(pg_temp.who((select id from t_msg where n = 7)) = '{}', 'a message from a non-member sends nothing');
update public.plan_members set status = 'going' where user_id = pg_temp.uid(3);
-- 9 cancelled plan and old plan
update public.plans set status = 'cancelled' where id = (select id from t_plan);
update public.plan_push_log set sent_at = now() - interval '5 minutes';
select pg_temp.say(8, pg_temp.uid(3));
select pg_temp.check(pg_temp.who((select id from t_msg where n = 8)) = '{}', 'a cancelled plan sends nothing');
update public.plans set status = 'active', starts_at = now() - interval '4 days' where id = (select id from t_plan);
select pg_temp.say(9, pg_temp.uid(3));
select pg_temp.check(pg_temp.who((select id from t_msg where n = 9)) = '{}', 'a plan that ended days ago sends nothing');
-- 10 unknown message
select pg_temp.check(pg_temp.who(gen_random_uuid()) = '{}', 'unknown message sends nothing');
-- 11 closed to the app
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check(pg_temp.state($$select * from public.plan_message_push(gen_random_uuid())$$) = '42501', 'the app cannot ask for recipients');
select pg_temp.check(pg_temp.state($$select * from public.plan_push_log$$) = '42501', 'the app cannot read the push log');
rollback;
\echo ALL TESTS PASSED
