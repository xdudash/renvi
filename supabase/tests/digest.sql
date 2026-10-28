-- Weekly digest (0019): counting rules, 7-day log, opt-outs, access control.
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
  if not p_ok then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
create or replace function pg_temp.expect_error(p_sql text, p_name text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then raise notice 'ok - % (%)', p_name, sqlerrm; return; end;
  raise exception 'FAILED (no error): %', p_name;
end $$;
create or replace function pg_temp.uid(n int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid $$;

-- User 1 = recipient (man, seeks women, SK). Others are candidates.
--  2 ok woman SK new            3 woman DE (other country)   4 man (wrong gender for seeking)
--  5 woman, blocked by 1        6 woman incognito            7 woman paused
--  8 woman published 10d ago    9 woman seeks only women     10 woman, passed by 1
--  11 woman suspended           12 woman ok new              13 woman age 17-> out of filter age (age 60, filter max 40)
insert into auth.users (id, email, email_confirmed_at) select pg_temp.uid(n), 'u' || n || '@test', now() from generate_series(1, 14) n;
insert into public.profiles (id, display_name, age, gender, seeking, intent, country, language, onboarding_done, filter_age_min, filter_age_max)
select pg_temp.uid(n),
  'Name' || n, 30,
  case when n = 1 or n = 4 then 'man' else 'woman' end,
  case when n = 1 then 'women' when n = 9 then 'women' else 'everyone' end,
  'serious', case when n = 3 then 'DE' else 'SK' end, 'RU', true, 18, case when n = 1 then 40 else 99 end
from generate_series(1, 13) n;
update public.profiles set incognito = true where id = pg_temp.uid(6);
update public.profiles set paused = true where id = pg_temp.uid(7);
update public.profiles set published_at = now() - interval '10 days' where id = pg_temp.uid(8);
update public.profiles set suspended_until = now() + interval '1 day' where id = pg_temp.uid(11);
update public.profiles set age = 60 where id = pg_temp.uid(13);
-- user 9 seeks women; recipient is a man -> not mutual
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(1), pg_temp.uid(5));
insert into public.passes (from_id, to_id) values (pg_temp.uid(1), pg_temp.uid(10));
-- user 14 has no profile completed (onboarding_done false) and is a candidate neither way
insert into public.profiles (id, display_name, gender, seeking, country, onboarding_done) values (pg_temp.uid(14), 'Draft', 'woman', 'everyone', 'SK', false);
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[t1]', pg_temp.uid(1), 'ios');

-- ---------- catalog / access ----------
select pg_temp.check(exists (select 1 from public.app_config where key = 'digest' and value ? 'enabled' and value ? 'weekday' and value ? 'hour_utc'),
  'app_config digest key has enabled/weekday/hour_utc');
select pg_temp.check((select digest_push from public.notification_prefs limit 1) is null or true, 'prefs columns exist');
select pg_temp.check(not has_table_privilege('authenticated', 'public.digest_log', 'select,insert,update,delete'), 'clients have no access to digest_log');
select pg_temp.check(not has_function_privilege('authenticated', 'public.weekly_digest_candidates(int)', 'execute'), 'clients cannot call weekly_digest_candidates');
select pg_temp.check(not has_function_privilege('anon', 'public.digest_new_count(uuid, timestamptz)', 'execute'), 'anon cannot call digest_new_count');
select pg_temp.check(not has_function_privilege('authenticated', 'public.digest_claim(uuid[], int[])', 'execute'), 'clients cannot claim digest slots');
select pg_temp.check(has_function_privilege('service_role', 'public.weekly_digest_candidates(int)', 'execute'), 'service role can call weekly_digest_candidates');

-- ---------- published_at ----------
select pg_temp.check((select published_at is not null from public.profiles where id = pg_temp.uid(2)), 'published profile has published_at');
select pg_temp.check((select published_at is null from public.profiles where id = pg_temp.uid(14)), 'draft profile has no published_at');
select pg_temp.as_user(pg_temp.uid(2));
update public.profiles set published_at = now() - interval '100 days' where id = pg_temp.uid(2);
reset role;
select pg_temp.check((select published_at > now() - interval '1 minute' from public.profiles where id = pg_temp.uid(2)), 'client cannot change published_at');

-- ---------- counting ----------
-- Matching for user 1: 2 and 12 only.
select pg_temp.check(public.digest_new_count(pg_temp.uid(1), now() - interval '7 days') = 2,
  'counts only same-country, seeking-compatible, unblocked, visible, new profiles');
select pg_temp.check(public.digest_new_count(pg_temp.uid(1), now() - interval '30 days') = 3, 'older profile counts with a longer window');
update public.profiles set filter_age_max = 70 where id = pg_temp.uid(1);
select pg_temp.check(public.digest_new_count(pg_temp.uid(1), now() - interval '7 days') = 3, 'age filter is honoured');
update public.profiles set filter_age_max = 40 where id = pg_temp.uid(1);
select pg_temp.check(public.digest_new_count(pg_temp.uid(1), now() - interval '7 days') = 2, 'age filter restored');
update public.profiles set filter_intents = '{casual}' where id = pg_temp.uid(1);
select pg_temp.check(public.digest_new_count(pg_temp.uid(1), now() - interval '7 days') = 0, 'intent filter is honoured');
update public.profiles set filter_intents = '{serious,casual,friends,unsure}' where id = pg_temp.uid(1);
-- A block in the other direction also hides the profile.
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(12), pg_temp.uid(1));
select pg_temp.check(public.digest_new_count(pg_temp.uid(1), now() - interval '7 days') = 1, 'blocks count in both directions');
delete from public.blocks where blocker_id = pg_temp.uid(12);

-- ---------- candidates ----------
-- Only user 1 has a push token; defaults: push on, e-mail off.
select pg_temp.check((select count(*) from public.weekly_digest_candidates()) = 1
  and (select user_id from public.weekly_digest_candidates()) = pg_temp.uid(1), 'only users with a deliverable channel are candidates');
select pg_temp.check((select new_count from public.weekly_digest_candidates()) = 2 and (select send_push from public.weekly_digest_candidates())
  and not (select send_email from public.weekly_digest_candidates()) and (select email from public.weekly_digest_candidates()) is null,
  'push on / e-mail off by default; no address returned without e-mail opt-in');

-- Opt-outs: own row only.
select pg_temp.as_user(pg_temp.uid(1));
insert into public.notification_prefs (user_id, digest_push) values (pg_temp.uid(1), false);
select pg_temp.check((select digest_push from public.notification_prefs where user_id = pg_temp.uid(1)) = false, 'user can opt out of digest push');
select pg_temp.expect_error($q$insert into public.notification_prefs (user_id) values ('00000000-0000-0000-0000-000000000102')$q$, 'user cannot write another user''s prefs');
reset role;
insert into public.notification_prefs (user_id, digest_email) values (pg_temp.uid(2), true);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check((select count(*) from public.notification_prefs) = 1, 'user reads only their own prefs');
reset role;
select pg_temp.check(not exists (select 1 from public.weekly_digest_candidates() where user_id = pg_temp.uid(1)), 'push opt-out removes the user (no e-mail opt-in)');
delete from public.notification_prefs where user_id = pg_temp.uid(2);

-- E-mail opt-in brings the address along, even without push.
update public.notification_prefs set digest_email = true where user_id = pg_temp.uid(1);
update auth.users set email_confirmed_at = null where id = pg_temp.uid(1);
select pg_temp.check(not exists (select 1 from public.weekly_digest_candidates() where user_id = pg_temp.uid(1)),
  'unconfirmed e-mail is never used');
update auth.users set email_confirmed_at = now() where id = pg_temp.uid(1);
select pg_temp.check((select email from public.weekly_digest_candidates()) = 'u1@test' and not (select send_push from public.weekly_digest_candidates()),
  'e-mail opt-in returns the address; push stays off');
update public.notification_prefs set digest_push = true where user_id = pg_temp.uid(1);

-- Skips users with 0 new profiles.
update public.profiles set paused = true where id in (pg_temp.uid(2), pg_temp.uid(12));
select pg_temp.check((select count(*) from public.weekly_digest_candidates()) = 0, 'users with 0 new matching profiles are skipped');
update public.profiles set paused = false where id in (pg_temp.uid(2), pg_temp.uid(12));

-- Paused recipients get nothing.
update public.profiles set paused = true where id = pg_temp.uid(1);
select pg_temp.check((select count(*) from public.weekly_digest_candidates()) = 0, 'paused recipient is skipped');
update public.profiles set paused = false where id = pg_temp.uid(1);

-- ---------- 7-day log ----------
select pg_temp.check((select count(*) from public.digest_claim(array[pg_temp.uid(1)], array[2])) = 1, 'first claim succeeds');
select pg_temp.check((select count(*) from public.digest_claim(array[pg_temp.uid(1)], array[2])) = 0, 'second claim within 7 days is refused');
select pg_temp.check((select count(*) from public.weekly_digest_candidates()) = 0, 'claimed user is no longer a candidate');
select public.digest_mark_sent(array[pg_temp.uid(1)], true, false);
select pg_temp.check((select push_sent and not email_sent from public.digest_log where user_id = pg_temp.uid(1)), 'delivery flags are recorded');
update public.digest_log set sent_at = now() - interval '8 days';
select pg_temp.check((select count(*) from public.weekly_digest_candidates()) = 1, 'user is eligible again after 7 days');
select pg_temp.check((select count(*) from public.digest_claim(array[pg_temp.uid(1)], array[0])) = 0, 'zero counts are never logged');

-- ---------- config ----------
update public.app_config set value = '{"enabled": false, "weekday": 0, "hour_utc": 0}' where key = 'digest';
select pg_temp.check((select count(*) from public.weekly_digest_candidates()) = 0, 'disabled digest yields no candidates');
select pg_temp.check(not public.digest_due_now('2026-11-01 18:00+00'), 'digest_due_now is false when disabled');
update public.app_config set value = '{"enabled": true, "weekday": 0, "hour_utc": 17}' where key = 'digest';
select pg_temp.check(public.digest_due_now('2026-11-01 17:30+00'), 'due on the configured weekday at/after the hour (2026-11-01 is a Sunday)');
select pg_temp.check(not public.digest_due_now('2026-11-01 16:59+00'), 'not due before the hour');
select pg_temp.check(not public.digest_due_now('2026-11-02 18:00+00'), 'not due on another weekday');

-- Deleting the account removes the log.
delete from auth.users where id = pg_temp.uid(1);
select pg_temp.check(not exists (select 1 from public.digest_log where user_id = pg_temp.uid(1)), 'log rows are removed with the account');

rollback;
