-- Security audit checks (0014). Every check runs as the real database role the app uses.
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
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok - % (%)', p_name, sqlerrm;
    return;
  end;
  raise exception 'FAILED (no error): %', p_name;
end $$;

-- ---------- catalog checks ----------
select pg_temp.check(not exists (
  select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'every security definer function pins search_path');
select pg_temp.check(not exists (
  select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname <> 'referral_lookup'
    and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege('anon', p.oid, 'execute')),
  'anon can execute no public function except referral_lookup');
select pg_temp.check(not has_table_privilege('authenticated', 'public.demo_bots', 'insert')
  and not has_table_privilege('authenticated', 'public.demo_bots', 'delete')
  and not has_table_privilege('authenticated', 'public.demo_bots', 'update'), 'demo_bots is read-only for clients');
select pg_temp.check(not exists (
  select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v','m')
    and c.relname <> 'app_config'
    and has_table_privilege('anon', c.oid, 'select,insert,update,delete')), 'anon has no table access except app_config');
select pg_temp.check(not exists (
  select 1 from pg_proc p, unnest(p.proargnames, p.proargmodes) as a(n, m)
  where p.pronamespace = 'public'::regnamespace and p.proname in ('discover', 'list_matches', 'admin_users')
    and a.m in ('t', 'o') and a.n in ('lat', 'lng', 'birthdate')), 'RPC result columns never include lat/lng/birthdate');

-- ---------- fixtures ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'anna@test'),
  ('00000000-0000-0000-0000-000000000002', 'marek@test'),
  ('00000000-0000-0000-0000-000000000003', 'cz@test'),
  ('00000000-0000-0000-0000-000000000004', 'new@test'),
  ('00000000-0000-0000-0000-000000000006', 'petr@test'),
  ('00000000-0000-0000-0000-000000000007', 'sneaky@test');
insert into public.profiles (id, display_name, age, gender, seeking, intent, country, city, onboarding_done, terms_accepted_at, adult_confirmed_at, sensitive_consent_at, bio)
values
  ('00000000-0000-0000-0000-000000000001', 'Anna', 27, 'woman', 'men', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'Hello'),
  ('00000000-0000-0000-0000-000000000002', 'Marek', 28, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'Coffee'),
  ('00000000-0000-0000-0000-000000000003', 'Jan', 29, 'man', 'women', 'serious', 'CZ', 'Praha', true, now(), now(), now(), 'Ahoj'),
  ('00000000-0000-0000-0000-000000000006', 'Petr', 30, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'Hi');
insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000004');
insert into public.private_profile (user_id, lat, lng, location_enabled) values
  ('00000000-0000-0000-0000-000000000001', 48.1486, 17.1077, true),
  ('00000000-0000-0000-0000-000000000002', 48.1600, 17.1200, true),
  ('00000000-0000-0000-0000-000000000004', 48.2000, 17.2000, true);
insert into public.matches (user_a, user_b) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006');
insert into public.photo_consents (match_id, user_id, allowed)
  select m.id, u, true from public.matches m, unnest(array[m.user_a, m.user_b]) u;
insert into public.messages (client_id, match_id, sender_id, body)
  select gen_random_uuid(), id, user_b, 'private between Marek and Petr' from public.matches
  where user_a = '00000000-0000-0000-0000-000000000002';
select set_config('test.foreign_msg', (select id::text from public.messages where body like 'private between%'), true);
-- Spark from a CZ profile (e.g. sent before the sender moved country).
insert into public.sparks (from_id, to_id) values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001');

-- ---------- anonymous ----------
select pg_temp.as_user(null::uuid);
select pg_temp.expect_error($q$select public.discover()$q$, 'anon cannot call discover');
select pg_temp.expect_error($q$select public.distance_label('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')$q$, 'anon cannot call distance_label');
select pg_temp.expect_error($q$select public.can_read_media('00000000-0000-0000-0000-000000000001/profile/1.jpg')$q$, 'anon cannot probe media');
select pg_temp.expect_error($q$select public.leave_deletion_feedback('spam')$q$, 'anon cannot write deletion feedback');
select pg_temp.check(public.referral_lookup('NOPE') is null, 'anon can still use the invite landing lookup');
select pg_temp.check((select count(*) from public.app_config) > 0, 'anon can still read app_config');

-- ---------- coordinates ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$select public.distance_km('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')$q$,
  'exact distance_km is not callable by clients');
select pg_temp.check(public.distance_label('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002') ~ '^≈ [0-9]+ км$',
  'distance label is whole km');
select pg_temp.check(not (public.profile_card('00000000-0000-0000-0000-000000000002') ?| array['lat','lng','birthdate']),
  'profile_card has no coordinates');

-- ---------- incoming sparks: own country only ----------
select pg_temp.check((public.incoming_sparks()->>'count')::int = 0 and jsonb_array_length(public.incoming_sparks()->'items') = 0,
  'incoming spark from another country is hidden');

-- ---------- protected profile columns ----------
select pg_temp.expect_error($q$update public.profiles set age = 30 where id = '00000000-0000-0000-0000-000000000001'$q$, 'client cannot set age directly');
select pg_temp.expect_error($q$update public.profiles set sensitive_consent_at = null where id = '00000000-0000-0000-0000-000000000001'$q$, 'client cannot forge consent timestamp');
update public.profiles set incognito = true where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.check((select incognito from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 'incognito is an own setting for everyone (no plan)');
update public.profiles set incognito = false where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
update public.profiles set filter_verified_only = true where id = '00000000-0000-0000-0000-000000000006';
select pg_temp.check((select filter_verified_only from public.profiles where id = '00000000-0000-0000-0000-000000000006'), 'verified-only filter is an own setting for everyone (no plan)');
update public.profiles set filter_verified_only = false where id = '00000000-0000-0000-0000-000000000006';
reset role;
update public.app_config set value = '["badword"]' where key = 'banned_words';
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$update public.profiles set bio = 'BADWORD here' where id = '00000000-0000-0000-0000-000000000001'$q$, 'banned word rejected in bio after publish');
update public.profiles set bio = 'fine text', paused = true where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.check((select bio from public.profiles where id = '00000000-0000-0000-0000-000000000001') = 'fine text', 'normal profile edits still work');

select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select pg_temp.expect_error($q$insert into public.profiles (id, onboarding_done, verification_status, age) values ('00000000-0000-0000-0000-000000000007', true, 'approved', 18)$q$,
  'client cannot insert an already published/verified profile');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');

-- ---------- photos ----------
select pg_temp.expect_error($q$insert into public.profile_photos (profile_id, storage_path, verified) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/profile/x.jpg', true)$q$,
  'client cannot mark own photo verified');
select pg_temp.expect_error($q$insert into public.profile_photos (profile_id, storage_path) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002/verify/s.jpg')$q$,
  'profile photo cannot point to someone else''s file');
insert into public.profile_photos (profile_id, storage_path) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/profile/ok.jpg');
select pg_temp.check(exists (select 1 from public.profile_photos where storage_path = '00000000-0000-0000-0000-000000000001/profile/ok.jpg'), 'own profile photo can be added');
update public.profile_photos set position = 3 where storage_path = '00000000-0000-0000-0000-000000000001/profile/ok.jpg';

-- ---------- chat photos ----------
select pg_temp.expect_error($q$select public.send_message((select id from public.matches where user_b = '00000000-0000-0000-0000-000000000002'), gen_random_uuid(), null, '00000000-0000-0000-0000-000000000006/verify/selfie.jpg')$q$,
  'chat photo cannot reference another user''s selfie');
select pg_temp.check((public.send_message((select id from public.matches where user_b = '00000000-0000-0000-0000-000000000002'), gen_random_uuid(), null, '00000000-0000-0000-0000-000000000001/chat/p.jpg')).photo_path is not null,
  'own chat photo is sent with mutual consent');

-- ---------- reports cannot quote foreign conversations ----------
select pg_temp.expect_error($q$select public.report(null, current_setting('test.foreign_msg')::uuid, 'other', null)$q$,
  'report cannot snapshot a message from someone else''s chat');

-- ---------- demo_bots ----------
select pg_temp.expect_error($q$insert into public.demo_bots (user_id) values ('00000000-0000-0000-0000-000000000001')$q$, 'client cannot add demo bots');

-- ---------- export works with unfinished onboarding, without coordinates ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check(public.export_my_data() ? 'profile', 'export works with unfinished onboarding');
select pg_temp.check(not ((public.export_my_data()->'private') ?| array['lat','lng']), 'export contains no coordinates');

rollback;
