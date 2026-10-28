-- Demo bots (0012/0013): every N-th spark a real user sends to bots must create a real match.
\set QUIET 1
begin;

create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if not p_ok then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000101', 'real@test'),
  ('00000000-0000-0000-0000-000000000201', 'bot1@demo.renvi.app'),
  ('00000000-0000-0000-0000-000000000202', 'bot2@demo.renvi.app'),
  ('00000000-0000-0000-0000-000000000203', 'bot3@demo.renvi.app'),
  ('00000000-0000-0000-0000-000000000204', 'bot4@demo.renvi.app'),
  ('00000000-0000-0000-0000-000000000205', 'bot5@demo.renvi.app');

insert into public.profiles (id, display_name, age, gender, seeking, intent, country, city, onboarding_done, terms_accepted_at, adult_confirmed_at, sensitive_consent_at, bio)
values
  ('00000000-0000-0000-0000-000000000101', 'Real', 27, 'woman', 'men', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'Hi'),
  ('00000000-0000-0000-0000-000000000201', 'B1', 28, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-000000000202', 'B2', 28, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-000000000203', 'B3', 28, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-000000000204', 'B4', 28, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-000000000205', 'B5', 28, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x');

insert into public.demo_bots (user_id) values
  ('00000000-0000-0000-0000-000000000201'), ('00000000-0000-0000-0000-000000000202'),
  ('00000000-0000-0000-0000-000000000203'), ('00000000-0000-0000-0000-000000000204'),
  ('00000000-0000-0000-0000-000000000205');

-- Sparks 1..4 to bots: no match yet.
insert into public.sparks (from_id, to_id, target_kind) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'profile'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', 'profile'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000203', 'profile'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000204', 'profile');
select pg_temp.check((select count(*) from public.matches) = 0, 'no match before the 5th spark to a bot');

-- Spark 5: the bot answers and a real match appears, with the ordered pair the schema requires.
insert into public.sparks (from_id, to_id, target_kind) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000205', 'profile');
select pg_temp.check((select count(*) from public.matches) = 1, 'the 5th spark creates exactly one match');
select pg_temp.check(exists (select 1 from public.matches m
  where m.user_a = least('00000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000205')
    and m.user_b = greatest('00000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000205')),
  'match row is stored with user_a < user_b');
select pg_temp.check(exists (select 1 from public.sparks where from_id = '00000000-0000-0000-0000-000000000205'
  and to_id = '00000000-0000-0000-0000-000000000101'), 'bot sent the reciprocal spark');

rollback;
