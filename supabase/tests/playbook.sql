-- RENVI Playbook (0034_playbook.sql): progress RPCs, free lesson 2, purchase only through the service role.
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
-- True when `sql` fails (any error).
create or replace function pg_temp.fails(sql text) returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when others then
  return true;
end $$;
create or replace function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000034' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email) select pg_temp.uid(n), 'p' || n || '@playbook.test' from generate_series(1, 2) g(n);
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done) values
  (pg_temp.uid(1), 'Kolya', 26, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(2), 'Petr', 29, 'man', 'women', 'SK', 'Bratislava', 'serious', true);

select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(public.playbook_state() = '{"purchased": false, "done_lessons": [], "trainer_pos": 0}'::jsonb, 'new user: defaults');
select public.playbook_mark_done(2);
select public.playbook_mark_done(2);
select pg_temp.check(public.playbook_state() -> 'done_lessons' = '[2]'::jsonb, 'free lesson 2 counts without purchase, once');
select pg_temp.check(pg_temp.fails('select public.playbook_mark_done(3)'), 'paid lesson refused without purchase');
select pg_temp.check(pg_temp.fails('select public.playbook_set_trainer(5)'), 'trainer refused without purchase');
select pg_temp.check(pg_temp.fails('select public.playbook_mark_done(9)'), 'lesson 9 does not exist');
select pg_temp.check(pg_temp.fails('select public.playbook_set_purchased(pg_temp.uid(1), true)'), 'user cannot buy through the RPC');
select pg_temp.check(pg_temp.fails('update public.playbook_progress set purchased = true where user_id = pg_temp.uid(1)'), 'user cannot write the table');
select pg_temp.check(pg_temp.fails($q$insert into public.playbook_progress (user_id, purchased) values (pg_temp.uid(2), true)$q$), 'user cannot insert rows');

-- The Edge Function (service role) confirms the purchase.
reset role;
set local role service_role;
select public.playbook_set_purchased(pg_temp.uid(1), true);
select pg_temp.as_user(pg_temp.uid(1));
select public.playbook_mark_done(3);
select public.playbook_mark_done(1);
select public.playbook_set_trainer(7);
select pg_temp.check(public.playbook_state() = '{"purchased": true, "done_lessons": [1, 2, 3], "trainer_pos": 7}'::jsonb, 'after purchase: lessons sorted, trainer position saved');
select pg_temp.check(pg_temp.fails('select public.playbook_set_trainer(31)'), 'trainer position stays within 0–30');
select pg_temp.check((select count(*) from public.playbook_progress) = 1, 'user sees only own row');

select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check((select count(*) from public.playbook_progress) = 0, 'another user sees nothing');
select pg_temp.check((public.playbook_state() ->> 'purchased')::boolean = false, 'purchase is per user');

select pg_temp.as_user(null);
select pg_temp.check(pg_temp.fails('select public.playbook_state()'), 'anonymous: no access');

-- Refund: RevenueCat drops the entitlement, the function writes false; progress stays.
reset role;
set local role service_role;
select public.playbook_set_purchased(pg_temp.uid(1), false);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(public.playbook_state() = '{"purchased": false, "done_lessons": [1, 2, 3], "trainer_pos": 7}'::jsonb, 'refund closes access, keeps progress');
select pg_temp.check(pg_temp.fails('select public.playbook_mark_done(4)'), 'after refund paid lessons are closed again');

-- Account deletion removes the row.
reset role;
delete from auth.users where id = pg_temp.uid(1);
select pg_temp.check(not exists (select 1 from public.playbook_progress where user_id = pg_temp.uid(1)), 'deleted account: progress deleted');
rollback;
