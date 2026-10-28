-- Behavioural tests: every check runs as the real database role the app uses.
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql -f supabase/migrations/... -f supabase/tests/rls.sql
\set QUIET 1
begin;

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  if p_uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;

create or replace function pg_temp.as_admin_db() returns void language plpgsql as $$
begin execute 'reset role'; end $$;

create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if not p_ok then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

create or replace function pg_temp.expect_error(p_sql text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok - % (%)', p_name, sqlerrm;
    return;
  end;
  raise exception 'FAILED (no error): %', p_name;
end $$;

-- ---------- fixtures (as the database owner) ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'anna@test'),
  ('00000000-0000-0000-0000-000000000002', 'marek@test'),
  ('00000000-0000-0000-0000-000000000003', 'cz@test'),
  ('00000000-0000-0000-0000-000000000004', 'kid@test'),
  ('00000000-0000-0000-0000-000000000005', 'admin@test');

insert into public.profiles (id, display_name, age, gender, seeking, intent, country, city, onboarding_done, terms_accepted_at, adult_confirmed_at, sensitive_consent_at, bio)
values
  ('00000000-0000-0000-0000-000000000001', 'Anna', 27, 'woman', 'men', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'Hello'),
  ('00000000-0000-0000-0000-000000000002', 'Marek', 28, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'Coffee'),
  ('00000000-0000-0000-0000-000000000003', 'Jana', 29, 'woman', 'men', 'serious', 'CZ', 'Praha', true, now(), now(), now(), 'Ahoj'),
  ('00000000-0000-0000-0000-000000000004', 'Kid', 16, 'man', 'women', 'casual', 'SK', 'Bratislava', false, null, null, null, '');

insert into public.admins values ('00000000-0000-0000-0000-000000000005');
insert into public.private_profile (user_id, lat, lng, location_enabled) values
  ('00000000-0000-0000-0000-000000000001', 48.1486, 17.1077, true),
  ('00000000-0000-0000-0000-000000000002', 48.1600, 17.1200, true);
insert into public.profile_photos (profile_id, storage_path, position) values
  ('00000000-0000-0000-0000-000000000001', 'a/1.jpg', 0), ('00000000-0000-0000-0000-000000000001', 'a/2.jpg', 1),
  ('00000000-0000-0000-0000-000000000002', 'm/1.jpg', 0), ('00000000-0000-0000-0000-000000000002', 'm/2.jpg', 1),
  ('00000000-0000-0000-0000-000000000003', 'j/1.jpg', 0);

-- ---------- visibility ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.discover()) = 1, 'SK user discovers only the SK profile');
select pg_temp.check(not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000003'),
  'CZ profile is not visible to SK user');
select pg_temp.check(not exists (select 1 from public.private_profile where user_id = '00000000-0000-0000-0000-000000000002'),
  'coordinates and birth dates of others are not readable');
select pg_temp.check(public.distance_label('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002') = '≈ 2 км',
  'distance is rounded to whole km');

select pg_temp.expect_error($q$update public.profiles set verification_status = 'approved' where id = '00000000-0000-0000-0000-000000000001'$q$,
  'client cannot approve own verification');
select pg_temp.expect_error($q$insert into public.subscriptions (user_id, tier) values ('00000000-0000-0000-0000-000000000001','premium')$q$,
  'client cannot write subscriptions');
select pg_temp.expect_error($q$select public.save_onboarding('{"birthdate":"2015-01-01"}'::jsonb)$q$,
  'under 18 birth date rejected');

-- ---------- free tier limits and sparks ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.discover()) = 1, 'Marek sees Anna');
select pg_temp.check((select public.send_spark('00000000-0000-0000-0000-000000000001','profile',null,'hi there')->>'status') = 'sent',
  'spark is sent');
select pg_temp.check(public.likes_today() = 1, 'likes_today counts the spark');
select pg_temp.check((select count(*) from public.sparks where comment is not null) = 1, 'comment is stored');

-- Anna sees the incoming spark count, but Free hides the list.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((public.incoming_sparks()->>'count')::int = 1 and jsonb_array_length(public.incoming_sparks()->'items') = 0,
  'Free tier sees only the count of incoming sparks');
select pg_temp.check((select (public.send_spark('00000000-0000-0000-0000-000000000002','profile',null,null)->>'status')) = 'match',
  'mutual spark creates a match');
select pg_temp.check(exists (select 1 from public.matches where user_a = '00000000-0000-0000-0000-000000000001'), 'match row exists');

-- ---------- chat ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((public.send_message((select id from public.matches limit 1), '11111111-1111-1111-1111-111111111111', 'hey', null)).body = 'hey',
  'first message is stored');
select pg_temp.check((select count(*) from public.messages) = 1
  , 'resending the same client_id does not duplicate');
select pg_temp.expect_error($q$select public.send_message((select id from public.matches limit 1), '22222222-2222-2222-2222-222222222222', 'x', '00000000-0000-0000-0000-000000000001/chat/1.jpg')$q$,
  'photo needs mutual consent');
select pg_temp.check((public.send_message((select id from public.matches limit 1), '33333333-3333-3333-3333-333333333333', 'Ahoj kundo', null)).body = 'Ahoj kundo',
  'message is stored with text');
select pg_temp.check((select count(*) from public.list_matches() where unread = 0) = 1, 'own messages are not unread');
select public.delete_own_message((select id from public.messages where client_id = '33333333-3333-3333-3333-333333333333'));
select pg_temp.check((select deleted_at from public.messages where client_id = '33333333-3333-3333-3333-333333333333') is not null,
  'own message can be deleted');

-- Photo consent: both sides must allow it before a photo can be sent.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.set_photo_consent((select id from public.matches limit 1), true);
select pg_temp.expect_error($q$select public.send_message((select id from public.matches limit 1), '44444444-4444-4444-4444-444444444444', null, '00000000-0000-0000-0000-000000000001/chat/1.jpg')$q$, 'photo blocked until partner allows');
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.set_photo_consent((select id from public.matches limit 1), true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((public.send_message((select id from public.matches limit 1), '55555555-5555-5555-5555-555555555555', null, '00000000-0000-0000-0000-000000000001/chat/1.jpg')).photo_path = '00000000-0000-0000-0000-000000000001/chat/1.jpg', 'photo sent after mutual consent');

-- ---------- dates ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.propose_date((select id from public.matches limit 1), 'eurovea', null, '2000-01-01', '16:00', null)$q$,
  'date in the past rejected');
select pg_temp.check(((public.propose_date((select id from public.matches limit 1), 'custom', 'Kaviareň Mlyn', current_date + 3, '16:00', 'coffee')).status) = 'pending',
  'date is proposed with a custom public place');
select pg_temp.expect_error($q$select public.respond_date((select id from public.dates limit 1), 'accept')$q$,
  'proposer cannot accept own date');

-- ---------- blocks and reports ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((public.report('00000000-0000-0000-0000-000000000001', null, 'harassment', 'bad')).status = 'open',
  'report is created');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(not exists (select 1 from public.reports where reporter_id = '00000000-0000-0000-0000-000000000001'),
  'reporter cannot read other reports');

-- ---------- admin ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check(public.is_admin(), 'admin is recognised');
select pg_temp.check((select count(*) from public.profiles) >= 4, 'admin reads all profiles');

-- ---------- billing: plus unlocks incoming list ----------
select pg_temp.as_user(null::uuid);
select pg_temp.expect_error($q$select 1 from public.profiles$q$, 'anonymous user cannot read profiles');


-- ---------- more: admin-only functions are closed to regular users ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.admin_stats(null)$q$, 'regular user cannot read admin stats');
select pg_temp.expect_error($q$select public.admin_set_config('tier_limits', '{}'::jsonb)$q$, 'regular user cannot change tariffs');
select pg_temp.expect_error($q$select public.admin_sanction('00000000-0000-0000-0000-000000000002', 'ban', 'x', null)$q$, 'regular user cannot ban');
select pg_temp.check((select count(*) from public.admin_users(null, null)) = 0, 'admin_users returns nothing to regular users');
select pg_temp.check(public.my_tier() = 'free', 'default plan is free');

-- ---------- error journal: insert allowed, read denied ----------
insert into public.error_events (area, message, user_id) values ('test', 'boom', '00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.error_events) = 0, 'users cannot read the error journal');

-- ---------- paid plan from the server unlocks the incoming list ----------
select pg_temp.as_admin_db();
insert into public.sparks (from_id, to_id) values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001') on conflict do nothing;
update public.profiles set onboarding_done = true, age = 19, terms_accepted_at = now(), adult_confirmed_at = now(), sensitive_consent_at = now() where id = '00000000-0000-0000-0000-000000000004';
insert into public.subscriptions (user_id, tier) values ('00000000-0000-0000-0000-000000000001', 'plus');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(public.my_tier() = 'plus', 'server-set plan is read');
select pg_temp.check(jsonb_array_length(public.incoming_sparks()->'items') = 1, 'Plus sees the incoming list');

-- ---------- selfie verification ----------
select pg_temp.expect_error($q$select public.request_verification('00000000-0000-0000-0000-000000000002/verify/x.jpg')$q$, 'cannot file a selfie in someone else''s folder');
select public.request_verification('00000000-0000-0000-0000-000000000001/verify/s.jpg');
select pg_temp.check((select verification_status from public.profiles where id = '00000000-0000-0000-0000-000000000001') = 'pending', 'selfie request marks profile pending');
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select public.admin_set_verification('00000000-0000-0000-0000-000000000001', 'approved');
select pg_temp.check((select status from public.verification_requests limit 1) = 'approved', 'admin approval closes the request');

-- ---------- media access ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check(not public.can_read_media('00000000-0000-0000-0000-000000000001/verify/s.jpg'), 'selfies are not readable by other users');
select pg_temp.check(not public.can_read_media('00000000-0000-0000-0000-000000000003/profile/1.jpg'), 'photos of other-country profiles are not readable');

-- ---------- referrals ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((public.my_referral()->>'code') ~ '^[A-Z]{2}-[0-9A-F]{4}$', 'referral code is created (Latin letters and digits)');
select pg_temp.as_admin_db();
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000009', 'friend@test',
  jsonb_build_object('invite_code', (select code from public.referral_codes where user_id = '00000000-0000-0000-0000-000000000001')));
select pg_temp.check(exists (select 1 from public.referral_signups where invited_user = '00000000-0000-0000-0000-000000000009'), 'signup with invite code is attached');

-- ---------- filters ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.save_filters(30, 40, 50, true, array['serious']);
select pg_temp.check((select filter_verified_only from public.profiles where id = '00000000-0000-0000-0000-000000000002') = false, 'verified-only filter requires a paid plan');
select pg_temp.check((select count(*) from public.discover()) = 0, 'age filter hides profiles outside the range');

rollback;
\echo ALL TESTS PASSED
