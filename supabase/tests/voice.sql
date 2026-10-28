-- Voice messages (0017): separate mutual voice consent, own-folder paths, 120 s limit, storage read gate, rate limit.
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
-- Expects an error with the given SQLSTATE (null = any).
create or replace function pg_temp.expect_error(p_sql text, p_name text, p_state text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_state is not null and sqlstate <> p_state then raise exception 'FAILED (wrong error %: %): %', sqlstate, sqlerrm, p_name; end if;
    raise notice 'ok - % (%)', p_name, sqlerrm;
    return;
  end;
  raise exception 'FAILED (no error): %', p_name;
end $$;

-- A = ...21, B = ...22 (matched). C = ...23 (outsider). D = ...24 (matched with B in another conversation).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000021', 'va@test'), ('00000000-0000-0000-0000-000000000022', 'vb@test'),
  ('00000000-0000-0000-0000-000000000023', 'vc@test'), ('00000000-0000-0000-0000-000000000024', 'vd@test');
insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000021'), ('00000000-0000-0000-0000-000000000022'),
  ('00000000-0000-0000-0000-000000000023'), ('00000000-0000-0000-0000-000000000024');
insert into public.matches (user_a, user_b) values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000022'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000024');
select set_config('test.m', (select id::text from public.matches where user_a = '00000000-0000-0000-0000-000000000021'), true);
select set_config('test.m2', (select id::text from public.matches where user_b = '00000000-0000-0000-0000-000000000024'), true);
update public.app_config set value = value || '{"voice_message": 4}' where key = 'rate_limits';

-- ---------- catalog ----------
select pg_temp.check(not has_table_privilege('authenticated', 'public.voice_consents', 'insert')
  and not has_table_privilege('authenticated', 'public.voice_consents', 'update')
  and not has_table_privilege('authenticated', 'public.voice_consents', 'delete'), 'clients change voice consent only through set_voice_consent');
select pg_temp.check(not has_function_privilege('anon', 'public.send_voice_message(uuid, uuid, text, int)', 'execute'), 'anon cannot send voice');
select pg_temp.check(not has_function_privilege('authenticated', 'public.voice_allowed(uuid)', 'execute'), 'voice_allowed is internal');
select pg_temp.check((select value ? 'voice_message' from public.app_config where key = 'rate_limits'), 'voice rate limit lives in app_config');

-- ---------- consent ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000023');
select pg_temp.expect_error($q$select public.set_voice_consent(current_setting('test.m')::uuid, true)$q$, 'outsider cannot set voice consent', '42501');

select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.m4a', 5000)$q$,
  'voice blocked without any consent', '42501');
-- Mutual PHOTO consent does not unlock voice.
select public.set_photo_consent(current_setting('test.m')::uuid, true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select public.set_photo_consent(current_setting('test.m')::uuid, true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.m4a', 5000)$q$,
  'mutual photo consent alone does not allow voice', '42501');
select public.set_voice_consent(current_setting('test.m')::uuid, true);
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.m4a', 5000)$q$,
  'voice blocked until the partner allows it', '42501');
select pg_temp.check((public.match_context(current_setting('test.m')::uuid) ->> 'my_voice_consent')::boolean
  and not (public.match_context(current_setting('test.m')::uuid) ->> 'their_voice_consent')::boolean, 'match_context reports voice consent of both sides');
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select public.set_voice_consent(current_setting('test.m')::uuid, true);

-- ---------- sending ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.check((select m.voice_path = '00000000-0000-0000-0000-000000000021/voice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.m4a'
                         and m.voice_duration_ms = 5000 and m.body is null
                      from public.send_voice_message(current_setting('test.m')::uuid, '77777777-7777-4777-8777-777777777777',
                        '00000000-0000-0000-0000-000000000021/voice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.m4a', 5000) m),
  'voice message is sent after mutual voice consent');
select pg_temp.check((public.send_voice_message(current_setting('test.m')::uuid, '77777777-7777-4777-8777-777777777777',
                        '00000000-0000-0000-0000-000000000021/voice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.m4a', 5000)).id
                     = (select id from public.messages where client_id = '77777777-7777-4777-8777-777777777777')
                     and (select count(*) from public.messages where client_id = '77777777-7777-4777-8777-777777777777') = 1,
  'resending the same client_id returns the same message, no duplicate');
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000022/voice/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.m4a', 5000)$q$,
  'voice path in another user''s folder is rejected', '42501');
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/../../00000000-0000-0000-0000-000000000022/verify/s.m4a', 5000)$q$,
  'path traversal is rejected', '42501');
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/chat/cccccccc-cccc-4ccc-8ccc-cccccccccccc.m4a', 5000)$q$,
  'voice must live in the voice folder', '42501');
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/clip.mp3', 5000)$q$,
  'voice file name must be <uuid>.m4a', '42501');
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/dddddddd-dddd-4ddd-8ddd-dddddddddddd.m4a', 120001)$q$,
  'voice longer than 120 s is rejected', '22023');
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/dddddddd-dddd-4ddd-8ddd-dddddddddddd.m4a', 0)$q$,
  'zero duration is rejected', '22023');
select pg_temp.check((public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(),
                        '00000000-0000-0000-0000-000000000021/voice/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.m4a', 120000)).voice_duration_ms = 120000,
  'exactly 120 s is accepted');
select pg_temp.expect_error($q$insert into public.messages (client_id, match_id, sender_id, voice_path, voice_duration_ms) values (gen_random_uuid(), current_setting('test.m')::uuid, '00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000021/voice/ffffffff-ffff-4fff-8fff-ffffffffffff.m4a', 1000)$q$,
  'clients cannot insert voice messages directly');
reset role;
select pg_temp.expect_error($q$insert into public.messages (client_id, match_id, sender_id, body, voice_path, voice_duration_ms) values (gen_random_uuid(), current_setting('test.m')::uuid, '00000000-0000-0000-0000-000000000021', 'text', '00000000-0000-0000-0000-000000000021/voice/ffffffff-ffff-4fff-8fff-ffffffffffff.m4a', 1000)$q$,
  'a voice message carries no text or photo');
select pg_temp.expect_error($q$insert into public.messages (client_id, match_id, sender_id, voice_path) values (gen_random_uuid(), current_setting('test.m')::uuid, '00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000021/voice/ffffffff-ffff-4fff-8fff-ffffffffffff.m4a')$q$,
  'voice duration metadata is required');

-- ---------- storage read gate ----------
select set_config('test.f', '00000000-0000-0000-0000-000000000021/voice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.m4a', true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.check(public.can_read_media(current_setting('test.f')), 'sender can play own voice');
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.check(public.can_read_media(current_setting('test.f')), 'match partner can play voice');
select pg_temp.check((select voice_duration_ms from public.list_messages(current_setting('test.m')::uuid) where client_id = '77777777-7777-4777-8777-777777777777') = 5000,
  'partner sees voice path and duration in list_messages');
select pg_temp.check(not public.can_read_media('00000000-0000-0000-0000-000000000021/voice/99999999-9999-4999-8999-999999999999.m4a'),
  'unsent voice file is not readable by the partner');
select pg_temp.as_user('00000000-0000-0000-0000-000000000023');
select pg_temp.check(not public.can_read_media(current_setting('test.f')), 'outsider cannot play voice');
select pg_temp.as_user('00000000-0000-0000-0000-000000000024');
select pg_temp.check(not public.can_read_media(current_setting('test.f')), 'partner from another conversation cannot play voice');
select pg_temp.as_user(null::uuid);
select pg_temp.expect_error($q$select public.can_read_media(current_setting('test.f'))$q$, 'anon cannot probe voice');

-- Revoking consent hides earlier voice messages and stops new ones.
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select public.set_voice_consent(current_setting('test.m')::uuid, false);
select pg_temp.check(not public.can_read_media(current_setting('test.f')), 'voice unreadable after the listener revokes consent');
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/12121212-1212-4121-8121-121212121212.m4a', 1000)$q$,
  'voice blocked after the partner revokes consent', '42501');
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select public.set_voice_consent(current_setting('test.m')::uuid, true);
select pg_temp.check(public.can_read_media(current_setting('test.f')), 'voice readable again after consent is restored');

-- ---------- rate limit (limit 4 per hour in this test; 2 messages already sent) ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/13131313-1313-4131-8131-131313131313.m4a', 1000);
select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/14141414-1414-4141-8141-141414141414.m4a', 1000);
select pg_temp.expect_error($q$select public.send_voice_message(current_setting('test.m')::uuid, gen_random_uuid(), '00000000-0000-0000-0000-000000000021/voice/15151515-1515-4151-8151-151515151515.m4a', 1000)$q$,
  'voice over the hourly limit is rejected with P0429', 'P0429');
select pg_temp.check((public.send_voice_message(current_setting('test.m')::uuid, '77777777-7777-4777-8777-777777777777',
                        '00000000-0000-0000-0000-000000000021/voice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.m4a', 5000)).id is not null,
  'idempotent retry of a delivered message still works at the limit');
select pg_temp.check((select count(*) from public.messages where sender_id = auth.uid() and voice_path is not null) = 4, 'rejected voice is not stored');
select pg_temp.check((public.send_message(current_setting('test.m')::uuid, gen_random_uuid(), 'text still works', null)).body = 'text still works',
  'text messages are not affected by the voice limit');

-- ---------- delete, block, unmatch ----------
select public.delete_own_message((select id from public.messages where client_id = '77777777-7777-4777-8777-777777777777'));
select pg_temp.check((select voice_path is null and voice_duration_ms is null and deleted_at is not null
                      from public.messages where client_id = '77777777-7777-4777-8777-777777777777'), 'deleting clears the voice reference');
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.check(not public.can_read_media(current_setting('test.f')), 'deleted voice is unreadable for the partner');
select set_config('test.f2', '00000000-0000-0000-0000-000000000021/voice/13131313-1313-4131-8131-131313131313.m4a', true);
select pg_temp.check(public.can_read_media(current_setting('test.f2')), 'other voice still readable');
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000021');
select pg_temp.check(not public.can_read_media(current_setting('test.f2')), 'voice unreadable after a block');
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-000000000022';
reset role;
update public.matches set ended_at = now() where id = current_setting('test.m')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.check(not public.can_read_media(current_setting('test.f2')), 'voice unreadable after unmatch');

rollback;
