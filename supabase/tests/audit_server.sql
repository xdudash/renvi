-- External audit 2026-10-28, server rules S1–S7 (fixed in 0020_audit_server_rules.sql).
-- Every check runs as the database role the app uses. `psql -v soft=1 ...` reports failures as
-- "FAILED: ..." notices and keeps going (used to show which checks fail on migrations before 0020).
\set QUIET 1
begin;
\if :{?soft}
select set_config('test.soft', 'on', false);
\endif

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  if p_uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;
create or replace function pg_temp.fail(p_msg text) returns void language plpgsql as $$
begin
  if current_setting('test.soft', true) = 'on' then raise notice 'FAILED: %', p_msg; return; end if;
  raise exception 'FAILED: %', p_msg;
end $$;
create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then perform pg_temp.fail(p_name); return; end if;
  raise notice 'ok - %', p_name;
end $$;
-- p_like: optional pattern the error message must match (tells "restricted" apart from other refusals).
create or replace function pg_temp.expect_error(p_sql text, p_name text, p_like text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_like is not null and sqlerrm not like p_like then
      perform pg_temp.fail(format('%s (wrong error: %s)', p_name, sqlerrm)); return;
    end if;
    raise notice 'ok - % (%)', p_name, sqlerrm;
    return;
  end;
  perform pg_temp.fail(p_name || ' (no error)');
end $$;
create or replace function pg_temp.expect_ok(p_sql text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    perform pg_temp.fail(format('%s (error: %s)', p_name, sqlerrm)); return;
  end;
  raise notice 'ok - %', p_name;
end $$;
create or replace function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- ---------- fixtures (database owner) ----------
-- 41 Alena  woman, unrelated viewer          42 Boris  man, INCOGNITO, sparked 44, active match with 45
-- 43 Cyril  man                              44 Dana   woman (Boris sparked her)
-- 45 Eva    woman, active match with 42      46 admin
-- 47 Stefan man, matched with 41 (gets banned)
-- 48 Gita   woman, PAUSED, blocked 49        49 Hugo   man, counter-blocks 48
-- 50 Ivan   man (account deletion)
insert into auth.users (id, email) select pg_temp.uid(n), 'u' || n || '@audit.test' from generate_series(41, 50) as g(n);
insert into public.profiles (id, display_name, age, gender, seeking, intent, country, city, onboarding_done,
                             terms_accepted_at, adult_confirmed_at, sensitive_consent_at, bio)
select pg_temp.uid(x.n), x.name, 30, x.g, x.s, 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'secret bio of ' || x.name
from (values (41, 'Alena', 'woman', 'men'), (42, 'Boris', 'man', 'women'), (43, 'Cyril', 'man', 'women'),
             (44, 'Dana', 'woman', 'men'), (45, 'Eva', 'woman', 'men'), (46, 'Admin', 'man', 'everyone'),
             (47, 'Stefan', 'man', 'women'), (48, 'Gita', 'woman', 'men'), (49, 'Hugo', 'man', 'women'),
             (50, 'Ivan', 'man', 'women')) x(n, name, g, s);
update public.profiles set incognito = true where id = pg_temp.uid(42);
update public.profiles set paused = true where id = pg_temp.uid(48);
insert into public.admins (user_id) values (pg_temp.uid(46));
insert into public.profile_photos (profile_id, storage_path, position)
select pg_temp.uid(n), pg_temp.uid(n)::text || '/profile/1.jpg', 0 from unnest(array[42, 48]) as t(n);
insert into public.profile_prompts (profile_id, question_key, answer)
select pg_temp.uid(n), 'q1', 'answer ' || n from unnest(array[42, 48]) as t(n);
insert into public.sparks (from_id, to_id, comment) values (pg_temp.uid(42), pg_temp.uid(44), 'hi from incognito');
insert into public.matches (user_a, user_b) values (pg_temp.uid(42), pg_temp.uid(45)), (pg_temp.uid(41), pg_temp.uid(47));
select set_config('t.m_eva', (select id::text from public.matches where user_b = pg_temp.uid(45)), false);
select set_config('t.m_stefan', (select id::text from public.matches where user_b = pg_temp.uid(47)), false);
insert into public.photo_consents (match_id, user_id, allowed) values (current_setting('t.m_stefan')::uuid, pg_temp.uid(41), true);
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(48), pg_temp.uid(49));

-- ================= S1: incognito is one rule for tables, RPCs and media =================
select pg_temp.as_user(pg_temp.uid(41));
select pg_temp.check(exists (select 1 from public.profiles where id = pg_temp.uid(43)), 'S1 control: a normal same-country profile is readable');
select pg_temp.check(not exists (select 1 from public.profiles where id = pg_temp.uid(42)), 'S1 incognito profile row is hidden from an unrelated user');
select pg_temp.check(not exists (select 1 from public.profile_photos where profile_id = pg_temp.uid(42)), 'S1 incognito photos rows are hidden');
select pg_temp.check(not exists (select 1 from public.profile_prompts where profile_id = pg_temp.uid(42)), 'S1 incognito prompts rows are hidden');
select pg_temp.check(public.profile_card(pg_temp.uid(42)) is null, 'S1 profile_card of an incognito profile is null');
select pg_temp.check(not public.can_read_media(pg_temp.uid(42)::text || '/profile/1.jpg'), 'S1 incognito profile media is not readable');
select pg_temp.check(not exists (select 1 from public.discover(50) d where d.profile_id = pg_temp.uid(42)), 'S1 discover hides incognito (unchanged)');
select pg_temp.expect_error(format('select public.send_spark(%L, ''profile'', null, null)', pg_temp.uid(42)),
  'S1 cannot spark an incognito profile one cannot see', '%not available%');

select pg_temp.as_user(pg_temp.uid(44));
select pg_temp.check(exists (select 1 from public.profiles where id = pg_temp.uid(42)), 'S1 person the incognito user sparked sees the row');
select pg_temp.check(public.profile_card(pg_temp.uid(42)) ? 'bio', 'S1 person the incognito user sparked gets the card');
select pg_temp.check(public.can_read_media(pg_temp.uid(42)::text || '/profile/1.jpg'), 'S1 person the incognito user sparked reads the photo');
select pg_temp.check((public.incoming_sparks()->>'count')::int = 1, 'S1 incoming spark from the incognito user is counted');

select pg_temp.as_user(pg_temp.uid(45));
select pg_temp.check(exists (select 1 from public.profiles where id = pg_temp.uid(42))
  and public.can_read_media(pg_temp.uid(42)::text || '/profile/1.jpg'), 'S1 active match partner sees the incognito profile');
select public.end_match(current_setting('t.m_eva')::uuid);
select pg_temp.check(public.profile_card(pg_temp.uid(42)) is null
  and not exists (select 1 from public.profiles where id = pg_temp.uid(42)), 'S1 an ended match gives no incognito access');

select pg_temp.as_user(pg_temp.uid(42));
select pg_temp.check(exists (select 1 from public.profiles where id = pg_temp.uid(42)) and public.profile_card(pg_temp.uid(42)) ? 'bio',
  'S1 owner sees own incognito profile');
select pg_temp.as_user(pg_temp.uid(46));
select pg_temp.check(exists (select 1 from public.profiles where id = pg_temp.uid(42)) and public.profile_card(pg_temp.uid(42)) ? 'bio'
  and public.can_read_media(pg_temp.uid(42)::text || '/profile/1.jpg'), 'S1 admin sees the incognito profile');

-- ================= S6: recipients do not read incoming spark rows directly =================
select pg_temp.as_user(pg_temp.uid(44));
select pg_temp.check(not exists (select 1 from public.sparks where to_id = pg_temp.uid(44)), 'S6 recipient cannot SELECT incoming spark rows');
select pg_temp.check((public.incoming_sparks()->>'count')::int = 1 and jsonb_array_length(public.incoming_sparks()->'items') = 1,
  'S6 recipient gets the incoming spark through the RPC (no paid plans since 0029)');
select pg_temp.as_user(pg_temp.uid(42));
select pg_temp.check(exists (select 1 from public.sparks where from_id = pg_temp.uid(42)), 'S6 sender still reads own sent sparks');

-- ================= S4: an ended match reopens only after new mutual consent =================
select pg_temp.as_user(pg_temp.uid(43));
select pg_temp.check(public.send_spark(pg_temp.uid(44), 'profile', null, null)->>'status' = 'sent', 'S4 setup: Cyril sparks Dana');
select pg_temp.as_user(pg_temp.uid(44));
select set_config('t.m_cd', public.send_spark(pg_temp.uid(43), 'profile', null, null)->>'match_id', false);
select pg_temp.check(current_setting('t.m_cd', true) <> '', 'S4 setup: mutual spark makes a match');
select public.end_match(current_setting('t.m_cd')::uuid);
select pg_temp.check(public.send_spark(pg_temp.uid(43), 'profile', null, null)->>'status' = 'sent',
  'S4 repeating send_spark after end_match does not re-open the match');
select pg_temp.check((select ended_at is not null from public.matches where id = current_setting('t.m_cd')::uuid),
  'S4 match stays ended without the other person');
select pg_temp.check(public.send_spark(pg_temp.uid(43), 'profile', null, null)->>'status' = 'sent', 'S4 still not reopened on a third call');
select pg_temp.as_user(pg_temp.uid(43));
select pg_temp.check(public.send_spark(pg_temp.uid(44), 'profile', null, null)->>'status' = 'match',
  'S4 a NEW spark from the other person after the end re-opens it');
select pg_temp.check((select ended_at is null from public.matches where id = current_setting('t.m_cd')::uuid),
  'S4 the re-opened match is active again');

-- ================= S5: blocked-list view is a minimal snapshot =================
select pg_temp.as_user(pg_temp.uid(49));
select public.block_user(pg_temp.uid(48));
select pg_temp.check(public.profile_card(pg_temp.uid(48))->>'display_name' = 'Gita', 'S5 blocker still gets the display name for the blocked list');
select pg_temp.check(not (public.profile_card(pg_temp.uid(48)) ?| array['bio','age','city','music_url','distance'])
  and jsonb_array_length(public.profile_card(pg_temp.uid(48))->'photos') = 0
  and jsonb_array_length(public.profile_card(pg_temp.uid(48))->'prompts') = 0,
  'S5 counter-block does not reveal the (paused) profile of the user who blocked you');
select pg_temp.check(not exists (select 1 from public.profile_photos where profile_id = pg_temp.uid(48))
  and not public.can_read_media(pg_temp.uid(48)::text || '/profile/1.jpg'), 'S5 photos stay closed');
select pg_temp.as_user(pg_temp.uid(41));
select public.block_user(pg_temp.uid(43));
select pg_temp.check((public.profile_card(pg_temp.uid(43))->>'blocked')::boolean
  and not (public.profile_card(pg_temp.uid(43)) ? 'bio'), 'S5 a visible profile one blocked is also only a snapshot');
select public.unblock_user(pg_temp.uid(43));
select pg_temp.check(public.profile_card(pg_temp.uid(43)) ? 'bio', 'S5 after unblock the full card is back');

-- ================= S2: sanctioned accounts cannot act =================
-- Before the ban: Alena proposes a date and requests a video call in her match with Stefan.
select pg_temp.as_user(pg_temp.uid(41));
select set_config('t.date', (public.propose_date(current_setting('t.m_stefan')::uuid, 'eurovea', null, current_date + 2, '18:00', null)).id::text, false);
select set_config('t.call', (public.request_video_call(current_setting('t.m_stefan')::uuid)).id::text, false);
select pg_temp.as_user(pg_temp.uid(46));
select public.admin_sanction(pg_temp.uid(47), 'ban', 'spam', null);
select pg_temp.as_user(pg_temp.uid(47));
select pg_temp.expect_error(format('select public.send_message(%L, gen_random_uuid(), ''hi'', null)', current_setting('t.m_stefan')),
  'S2 banned user cannot send_message', '%account restricted%');
select pg_temp.expect_error(format('select public.send_spark(%L, ''profile'', null, null)', pg_temp.uid(44)),
  'S2 banned user cannot send_spark', '%account restricted%');
select pg_temp.expect_error(format('select public.pass_profile(%L)', pg_temp.uid(44)), 'S2 banned user cannot pass', '%account restricted%');
select pg_temp.expect_error('select * from public.discover()', 'S2 banned user cannot browse discover', '%account restricted%');
select pg_temp.expect_error(format('select public.propose_date(%L, ''eurovea'', null, current_date + 3, ''18:00'', null)', current_setting('t.m_stefan')),
  'S2 banned user cannot propose a date', '%account restricted%');
select pg_temp.expect_error(format('select public.respond_date(%L, ''accept'')', current_setting('t.date')),
  'S2 banned user cannot respond to a date', '%account restricted%');
select pg_temp.expect_error(format('select public.respond_video_call(%L, ''accept'')', current_setting('t.call')),
  'S2 banned user cannot accept a video call', '%account restricted%');
select pg_temp.expect_error(format('select public.request_video_call(%L)', current_setting('t.m_stefan')),
  'S2 banned user cannot request a video call', '%account restricted%');
select pg_temp.expect_error(format('select public.video_call_join(%L)', current_setting('t.call')),
  'S2 banned user cannot join a video call', '%account restricted%');
select pg_temp.expect_error(format('select public.set_photo_consent(%L, true)', current_setting('t.m_stefan')),
  'S2 banned user cannot grant photo consent', '%account restricted%');
select pg_temp.expect_error(format('select public.unblock_user(%L)', pg_temp.uid(41)), 'S2 banned user cannot unblock', '%account restricted%');
-- What stays available: report, appeal/support, export, safety actions (block, withdraw consent, decline/end call, end match).
select pg_temp.check((public.report(pg_temp.uid(41), null, 'other', 'appeal context')).status = 'open', 'S2 banned user can still report');
select pg_temp.check((public.submit_support('ban', 'please review my ban', false)).id is not null, 'S2 banned user can still contact support');
select pg_temp.check(public.export_my_data()->'profile'->>'id' = pg_temp.uid(47)::text, 'S2 banned user can still export data');
select public.set_photo_consent(current_setting('t.m_stefan')::uuid, false);
select pg_temp.expect_ok(format('select 1 / ((public.respond_video_call(%L, ''decline'')).status = ''declined'')::int', current_setting('t.call')),
  'S2 banned user can still decline a call');
select pg_temp.check(exists (select 1 from public.account_sanctions where user_id = pg_temp.uid(47) and kind = 'ban'), 'S2 banned user still sees own sanction');
-- Catalog: every user-action RPC runs the check.
reset role;
select pg_temp.check(not exists (
  select 1 from unnest(array['send_spark','pass_profile','undo_last_pass','discover','send_message','set_photo_consent',
                             'propose_date','respond_date','unblock_user','request_video_call','respond_video_call','video_call_join']) f
  where not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = f
                    and p.prosrc like '%assert_account_active()%')), 'S2 every user-action RPC calls assert_account_active()');
-- Lift restores everything; the sanction row is marked lifted.
select pg_temp.as_user(pg_temp.uid(46));
select public.admin_sanction(pg_temp.uid(47), 'lift', null, null);
select pg_temp.as_user(pg_temp.uid(47));
select pg_temp.check((public.send_message(current_setting('t.m_stefan')::uuid, gen_random_uuid(), 'back', null)).id is not null,
  'S2 after lift the user can send again');
-- An active sanction row alone (e.g. profile flag not set) is enough; an expired suspension is not.
reset role;
insert into public.account_sanctions (user_id, kind, reason, until) values (pg_temp.uid(47), 'suspension', 'x', now() + interval '1 day');
select pg_temp.as_user(pg_temp.uid(47));
select pg_temp.expect_error(format('select public.send_message(%L, gen_random_uuid(), ''hi'', null)', current_setting('t.m_stefan')),
  'S2 an active suspension row restricts even without the profile flag', '%account restricted%');
reset role;
update public.account_sanctions set until = now() - interval '1 minute' where user_id = pg_temp.uid(47) and kind = 'suspension';
select pg_temp.as_user(pg_temp.uid(47));
select pg_temp.check((public.send_message(current_setting('t.m_stefan')::uuid, gen_random_uuid(), 'again', null)).id is not null,
  'S2 an expired suspension does not restrict');

-- ================= S3: profiles cannot be deleted by the client; sanctions and blocks survive =================
select pg_temp.as_user(pg_temp.uid(46));
select public.admin_sanction(pg_temp.uid(47), 'ban', 'evasion', null);
select pg_temp.as_user(pg_temp.uid(47));
select pg_temp.check(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'S3 clients have no DELETE on profiles');
select pg_temp.check(not has_table_privilege('authenticated', 'public.blocks', 'delete')
  and not has_table_privilege('authenticated', 'public.blocks', 'insert'), 'S3 clients write blocks only through RPCs');
select pg_temp.expect_error(format('delete from public.profiles where id = %L', pg_temp.uid(47)), 'S3 banned user cannot delete own profile row');
select pg_temp.as_user(pg_temp.uid(48));
select pg_temp.expect_error(format('delete from public.profiles where id = %L', pg_temp.uid(48)), 'S3 blocker cannot delete own profile row');
reset role;
select pg_temp.check(exists (select 1 from public.account_sanctions where user_id = pg_temp.uid(47) and kind = 'ban' and reason = 'evasion')
  and (select suspended_until = 'infinity' from public.profiles where id = pg_temp.uid(47)), 'S3 sanction and ban flag survive');
select pg_temp.check(exists (select 1 from public.blocks where blocker_id = pg_temp.uid(48) and blocked_id = pg_temp.uid(49)),
  'S3 other people''s blocks survive');
select pg_temp.as_user(pg_temp.uid(47));
select public.save_onboarding('{"bio": "new me"}'::jsonb);
reset role;
select pg_temp.check((select suspended_until = 'infinity' from public.profiles where id = pg_temp.uid(47)), 'S3 save_onboarding does not produce a clean profile');
-- Account deletion (delete-account Edge Function → auth admin API) still removes everything.
delete from auth.users where id = pg_temp.uid(50);
select pg_temp.check(not exists (select 1 from public.profiles where id = pg_temp.uid(50)), 'S3 deleting the auth user still removes the profile');

-- ================= S7: obsolete since 0029 (subscriptions removed) =================
select pg_temp.check(to_regclass('public.subscriptions') is null, 'S7 no subscriptions table is left to orphan rows');

rollback;
