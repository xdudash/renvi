-- 0042: one list of conversations: list_matches() reports the kind of chat, plan_chats() lists group chats of my plans.
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
  select ('00000000-0000-0000-0000-0000000042' || lpad(n::text, 2, '0'))::uuid
$$;

-- 1 Host, 2 Eva (goes), 3 Tom (pending), 4 Outsider
insert into auth.users (id, email, email_confirmed_at) select pg_temp.uid(n), 'c' || n || '@chats.test', now() from generate_series(1, 4) g(n);
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done) values
  (pg_temp.uid(1), 'Host', 30, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(2), 'Eva', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(3), 'Tom', 29, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(4), 'Out', 29, 'man', 'women', 'SK', 'Bratislava', 'serious', true);
select pg_temp.as_user(pg_temp.uid(1));
create temp table t_plan as select (public.plan_create(jsonb_build_object('category','market','title','Evening walk','starts_at',(now() + interval '1 day')::text,
  'area','Old Town','place','By the fountain','max_people',6,'auto_accept',true))->>'id')::uuid as id;
select pg_temp.as_user(pg_temp.uid(2)); select public.plan_request((select id from t_plan));
reset role;
insert into public.matches (user_a, user_b, kind) values (least(pg_temp.uid(1), pg_temp.uid(2)), greatest(pg_temp.uid(1), pg_temp.uid(2)), 'company');
insert into public.matches (user_a, user_b, kind) values (least(pg_temp.uid(2), pg_temp.uid(4)), greatest(pg_temp.uid(2), pg_temp.uid(4)), 'dating');

select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check((select string_agg(kind, ',' order by kind) from public.list_matches()) = 'company,dating', 'list_matches reports the kind of every chat');
select pg_temp.check(jsonb_array_length(public.plan_chats()) = 1 and public.plan_chats()->0->>'title' = 'Evening walk' and (public.plan_chats()->0->>'going')::int = 2,
  'Eva (going) sees the plan chat with the number of people going');
select pg_temp.as_user(pg_temp.uid(4));
select pg_temp.check(jsonb_array_length(public.plan_chats()) = 0, 'an outsider has no plan chats');
select pg_temp.as_user(pg_temp.uid(1));
select public.plan_chat_send((select id from t_plan), 'see you at six');
select pg_temp.check(public.plan_chats()->0->>'last_body' = 'see you at six' and public.plan_chats()->0->>'last_name' = 'Host', 'last message and its author are shown');
reset role;
update public.plans set status = 'cancelled' where id = (select id from t_plan);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(jsonb_array_length(public.plan_chats()) = 0, 'a cancelled plan leaves the list');
reset role;
update public.plans set status = 'active', starts_at = now() - interval '4 days' where id = (select id from t_plan);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(jsonb_array_length(public.plan_chats()) = 0, 'old plans leave the list after 3 days');

rollback;
\echo ALL TESTS PASSED
