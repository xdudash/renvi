-- Passed profiles come back (0033_recycle_passes.sql): cooldown, fallback when the feed is empty, a pass limit,
-- "seen" flag, undo of a repeated pass. Sparks still exclude for good.
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
  select ('00000000-0000-0000-0000-0000000033' || lpad(n::text, 2, '0'))::uuid
$$;
-- Feed order as names; `seen` marks people passed before.
create or replace function pg_temp.feed() returns text language sql as $$
  select coalesce(string_agg(display_name || case when seen then '*' else '' end, ','), '') from public.discover(50)
$$;
-- Moves my pass of person n into the past (owner role).
create or replace function pg_temp.age_pass(n int, p_ago interval) returns void language plpgsql as $$
begin
  execute 'reset role';
  update public.passes set created_at = now() - p_ago where from_id = pg_temp.uid(1) and to_id = pg_temp.uid(n);
  perform pg_temp.as_user(pg_temp.uid(1));
end $$;

insert into auth.users (id, email) select pg_temp.uid(n), 'r' || n || '@recycle.test' from generate_series(1, 4) g(n);
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done) values
  (pg_temp.uid(1), 'Me', 28, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(2), 'Anna', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(3), 'Bea', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(4), 'Cili', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true);

select pg_temp.check((select max_passes from public.discover_recycle_settings()) = 5
  and (select cooldown_hours from public.discover_recycle_settings()) = 24
  and (select fallback_minutes from public.discover_recycle_settings()) = 10, 'defaults: 24 h cooldown, 10 min fallback, 5 passes');

select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.feed() ~ '^[A-Za-z]+,[A-Za-z]+,[A-Za-z]+$' and pg_temp.feed() !~ '\*', 'three fresh people, none marked seen');

-- Just passed: gone, even though the feed has room.
select public.pass_profile(pg_temp.uid(2));
select pg_temp.check(pg_temp.feed() !~ 'Anna', 'a person passed a moment ago does not come straight back');

-- Older than the fallback window but within the cooldown: shown, after the fresh people, marked seen.
select pg_temp.age_pass(2, interval '1 hour');
select pg_temp.check(pg_temp.feed() ~ '^(Bea,Cili|Cili,Bea),Anna\*$', 'recently passed person fills the end of the feed, marked seen');

-- Everyone passed: the feed is not empty, the oldest pass comes first.
select public.pass_profile(pg_temp.uid(3));
select public.pass_profile(pg_temp.uid(4));
select pg_temp.age_pass(3, interval '2 hours');
select pg_temp.age_pass(4, interval '30 minutes');
select pg_temp.check(pg_temp.feed() = 'Bea*,Anna*,Cili*', 'nobody fresh left: passed people return, oldest pass first');

-- Past the cooldown: ahead of people still in their cooldown.
select pg_temp.age_pass(4, interval '25 hours');
select pg_temp.check(split_part(pg_temp.feed(), ',', 1) = 'Cili*', 'a pass older than the cooldown comes before recent ones');

-- Passing again counts. Undo of a repeated pass counts it back and makes the person available again.
select public.pass_profile(pg_temp.uid(4));
select pg_temp.check((select times from public.passes where from_id = pg_temp.uid(1) and to_id = pg_temp.uid(4)) = 2, 'second pass is counted');
select public.pass_profile(pg_temp.uid(4)); select public.pass_profile(pg_temp.uid(4)); select public.pass_profile(pg_temp.uid(4));
select pg_temp.check(public.undo_last_pass() = pg_temp.uid(4), 'undo takes back the latest (repeated) pass');
select pg_temp.check((select times from public.passes where from_id = pg_temp.uid(1) and to_id = pg_temp.uid(4)) = 4
  and pg_temp.feed() ~ 'Cili\*', 'undone fifth pass: counter back to 4, the person is in the feed again');

-- After five passes the person never returns, however long ago.
select public.pass_profile(pg_temp.uid(4));
select pg_temp.age_pass(4, interval '30 days');
select pg_temp.check(pg_temp.feed() !~ 'Cili', 'after five passes the person is gone for good');

-- A spark still excludes for good, whatever the passes.
select public.send_spark(pg_temp.uid(3), 'profile', null, null);
select pg_temp.check(pg_temp.feed() !~ 'Bea', 'a person I sent a spark to never comes back to the feed');

rollback;
\echo ALL TESTS PASSED
