-- RENVI is free (0029_remove_subscriptions.sql): no plans, no billing tables, every former paid feature works for
-- every account, and the single anti-abuse limit (app_config.daily_spark_limit) is enforced by the server.
-- Every user check runs as the database role the app uses.
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
-- Expects SQLSTATE p_state; the message must not mention plans, upgrades or payment.
create or replace function pg_temp.expect_state(p_sql text, p_state text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_state then raise exception 'FAILED: % (got % %)', p_name, sqlstate, sqlerrm; end if;
    if sqlerrm ~* '(plan|tier|plus|premium|upgrade|subscri|purchase)' then raise exception 'FAILED: % (upsell in error: %)', p_name, sqlerrm; end if;
    raise notice 'ok - % (%)', p_name, sqlerrm;
    return;
  end;
  raise exception 'FAILED (no error): %', p_name;
end $$;
create or replace function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000006' || lpad(n::text, 2, '0'))::uuid
$$;

-- ================= catalog: nothing paid is left =================
select pg_temp.check(to_regclass('public.subscriptions') is null and to_regclass('public.billing_events') is null,
  'subscriptions and billing_events tables are gone');
select pg_temp.check(not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('my_tier', 'tier_flag', 'daily_like_limit', 'admin_reset_free', 'billing_commit', 'guard_subscription_write')),
  'plan helpers, billing commit and reset-to-Free are gone');
select pg_temp.check(not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
  and prosrc ~* '\y(subscriptions|billing_events|tier_flag|my_tier|daily_like_limit|tier_limits|prices_preliminary)\y'),
  'no database function refers to subscriptions or tiers');
select pg_temp.check(not exists (select 1 from public.app_config where key in ('tier_limits', 'prices_preliminary')),
  'tier limits and prices are removed from app_config');
select pg_temp.check((select value from public.app_config where key = 'daily_spark_limit') = '100'::jsonb,
  'daily_spark_limit defaults to 100');
select pg_temp.check(not ((select value from public.app_config where key = 'legal_urls') ? 'subscriptions')
  and not ((select value from public.app_config where key = 'referral') ? 'reward_days'),
  'no subscriptions document and no referral reward days in config');

-- ---------- fixtures (database owner): everyone in SK, nobody has any plan ----------
-- 61 Alena woman (main user)   62 Boris man (sparks Alena)   63 Cyril man (Alena passes him)
-- 64 Dana woman (unrelated viewer)   65 Emil man   66 Fero man (verified)   67 admin
insert into auth.users (id, email) select pg_temp.uid(n), 'u' || n || '@free.test' from generate_series(61, 67) as g(n);
insert into public.profiles (id, display_name, age, gender, seeking, intent, country, city, onboarding_done,
                             terms_accepted_at, adult_confirmed_at, sensitive_consent_at, bio)
select pg_temp.uid(x.n), x.name, 30, x.g, x.s, 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'bio of ' || x.name
from (values (61, 'Alena', 'woman', 'men'), (62, 'Boris', 'man', 'women'), (63, 'Cyril', 'man', 'women'),
             (64, 'Dana', 'woman', 'men'), (65, 'Emil', 'man', 'women'), (66, 'Fero', 'man', 'women'),
             (67, 'Admin', 'man', 'everyone')) x(n, name, g, s);
insert into public.private_profile (user_id, birthdate)
select pg_temp.uid(n), ((now() at time zone 'UTC')::date - interval '30 years')::date from generate_series(61, 67) as g(n);
update public.profiles set verification_status = 'approved' where id = pg_temp.uid(66);
insert into public.admins (user_id) values (pg_temp.uid(67));

-- ================= incoming sparks: who sparked you, for everyone =================
select pg_temp.as_user(pg_temp.uid(62));
select pg_temp.check(public.send_spark(pg_temp.uid(61), 'profile', null, 'hello Alena')->>'status' = 'sent', 'Boris sparks Alena');
select pg_temp.as_user(pg_temp.uid(61));
select pg_temp.check((public.incoming_sparks()->>'count')::int = 1
  and jsonb_array_length(public.incoming_sparks()->'items') = 1
  and public.incoming_sparks()->'items'->0->>'profile_id' = pg_temp.uid(62)::text
  and public.incoming_sparks()->'items'->0->>'name' = 'Boris'
  and public.incoming_sparks()->'items'->0->>'comment' = 'hello Alena',
  'Alena (no plan) sees who sparked her, with the name and comment');

-- ================= undo last pass, for everyone =================
select pg_temp.check(exists (select 1 from public.discover(50) d where d.profile_id = pg_temp.uid(63)), 'Alena sees Cyril in discover');
select public.pass_profile(pg_temp.uid(63));
select pg_temp.check(not exists (select 1 from public.discover(50) d where d.profile_id = pg_temp.uid(63)), 'passed profile leaves discover');
select pg_temp.check(public.undo_last_pass() = pg_temp.uid(63), 'Alena (no plan) can undo the last pass');
select pg_temp.check(exists (select 1 from public.discover(50) d where d.profile_id = pg_temp.uid(63)), 'undone pass brings the profile back');
select pg_temp.check(public.undo_last_pass() is null, 'nothing left to undo returns null, not an error');

-- ================= verified-only filter, for everyone =================
select public.save_filters(18, 99, 100, true, array['serious','casual','friends','unsure']);
select pg_temp.check((select filter_verified_only from public.profiles where id = pg_temp.uid(61)), 'Alena (no plan) saves the verified-only filter');
select pg_temp.check(exists (select 1 from public.discover(50) d where d.profile_id = pg_temp.uid(66))
  and not exists (select 1 from public.discover(50) d where d.profile_id = pg_temp.uid(63)),
  'verified-only filter shows only verified profiles');
select public.save_filters(18, 99, 100, false, array['serious','casual','friends','unsure']);
select pg_temp.check(exists (select 1 from public.discover(50) d where d.profile_id = pg_temp.uid(63)), 'turning the filter off shows everyone again');

-- ================= incognito, for everyone =================
select public.save_onboarding('{"incognito": true}'::jsonb);
select pg_temp.check((select incognito from public.profiles where id = pg_temp.uid(61)), 'Alena (no plan) turns on incognito');
select pg_temp.as_user(pg_temp.uid(65));
select pg_temp.check(not exists (select 1 from public.discover(50) d where d.profile_id = pg_temp.uid(61))
  and public.profile_card(pg_temp.uid(61)) is null, 'incognito hides Alena from an unrelated man');
select pg_temp.as_user(pg_temp.uid(61));
select public.send_spark(pg_temp.uid(63), 'profile', null, null);
select pg_temp.as_user(pg_temp.uid(63));
select pg_temp.check(public.profile_card(pg_temp.uid(61)) is not null, 'the person incognito Alena sparked can see her');
select pg_temp.as_user(pg_temp.uid(61));
update public.profiles set incognito = false where id = pg_temp.uid(61);
select pg_temp.check(not (select incognito from public.profiles where id = pg_temp.uid(61)), 'incognito can be switched off directly');

-- ================= the anti-abuse daily spark limit (same for everyone) =================
reset role;
update public.app_config set value = '2' where key = 'daily_spark_limit';
select pg_temp.as_user(pg_temp.uid(64));
select pg_temp.check(public.daily_spark_limit() = 2, 'limit is read from app_config.daily_spark_limit');
select public.send_spark(pg_temp.uid(62), 'profile', null, null);
select public.send_spark(pg_temp.uid(63), 'profile', null, null);
select pg_temp.expect_state(format($q$select public.send_spark(%L, 'profile', null, null)$q$, pg_temp.uid(65)), 'P0003',
  'third spark over the limit is refused with P0003 and a neutral message');
select pg_temp.check(not exists (select 1 from public.sparks where from_id = pg_temp.uid(64) and to_id = pg_temp.uid(65)),
  'the refused spark is not stored');
select pg_temp.check(public.likes_today() = 2, 'likes_today still reports the sparks sent today');
select pg_temp.as_user(pg_temp.uid(61));   -- Alena already sent one spark today (to Cyril)
select public.send_spark(pg_temp.uid(65), 'profile', null, null);
select pg_temp.expect_state(format($q$select public.send_spark(%L, 'profile', null, null)$q$, pg_temp.uid(66)), 'P0003',
  'the same limit applies to every account');
reset role;
update public.sparks set created_at = created_at - interval '1 day' where from_id = pg_temp.uid(64);
select pg_temp.as_user(pg_temp.uid(64));
select pg_temp.check(public.send_spark(pg_temp.uid(65), 'profile', null, null)->>'status' in ('sent', 'match'),
  'sparks from yesterday do not count: the limit resets the next day');
reset role;
update public.app_config set value = '"lots"' where key = 'daily_spark_limit';
select pg_temp.check(public.daily_spark_limit() = 100, 'a malformed limit falls back to 100, never to unlimited');
delete from public.app_config where key = 'daily_spark_limit';
select pg_temp.check(public.daily_spark_limit() = 100, 'a missing limit falls back to 100');
insert into public.app_config (key, value) values ('daily_spark_limit', '100');
select pg_temp.as_user(pg_temp.uid(64));
select pg_temp.expect_state($q$update public.app_config set value = '100000' where key = 'daily_spark_limit'$q$, '42501',
  'a user cannot raise the limit');
select pg_temp.as_user(pg_temp.uid(67));
select public.admin_config_set('daily_spark_limit', '5', 'tighten for spam wave');
select pg_temp.check(public.daily_spark_limit() = 5, 'an admin changes the limit through the validated RPC');

-- ================= referrals: invites stay, approval grants nothing =================
reset role;
insert into public.referral_codes (user_id, code) values (pg_temp.uid(61), 'AL-0001');
insert into public.referral_signups (invited_user, code, status) values (pg_temp.uid(66), 'AL-0001', 'verified');
select pg_temp.as_user(pg_temp.uid(61));
select pg_temp.check((public.my_referral()->>'verified')::int = 1 and not (public.my_referral() ? 'reward_days'),
  'referral progress counts verified invites, no reward days');
select pg_temp.as_user(pg_temp.uid(67));
select public.admin_decide_referral(pg_temp.uid(66), true);
select pg_temp.check((select status from public.referral_signups where invited_user = pg_temp.uid(66)) = 'rewarded'
  and exists (select 1 from public.admin_actions where action = 'referral.approve' and target_user = pg_temp.uid(61)
              and not (details ? 'reward_days')),
  'approving an invite only marks it counted (logged, no promo days)');

-- ================= own data export has no subscription section =================
select pg_temp.as_user(pg_temp.uid(61));
select pg_temp.check(public.export_my_data() ? 'profile' and not (public.export_my_data() ? 'subscription'),
  'data export has no subscription section');

rollback;
\echo ALL TESTS PASSED
