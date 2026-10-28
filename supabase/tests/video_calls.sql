-- Video calls (0018): consent of both members, RLS, blocks, expiry, rate limits, join check for the Edge Function.
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

-- A and B are matched; C is an outsider.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000021', 'a@v.test'), ('00000000-0000-0000-0000-000000000022', 'b@v.test'),
  ('00000000-0000-0000-0000-000000000023', 'c@v.test');
insert into public.profiles (id, display_name) values ('00000000-0000-0000-0000-000000000021', 'Ana'),
  ('00000000-0000-0000-0000-000000000022', 'Boris'), ('00000000-0000-0000-0000-000000000023', 'Cyril');
insert into public.matches (user_a, user_b) values ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000022');
select set_config('t.m', (select id::text from public.matches where user_a = '00000000-0000-0000-0000-000000000021'), true);
update public.app_config set value = value || '{"video_call": 4, "video_call_join": 5}' where key = 'rate_limits';

-- ---------- catalog ----------
select pg_temp.check((select relrowsecurity from pg_class where oid = 'public.video_calls'::regclass), 'RLS is enabled on video_calls');
select pg_temp.check(not has_table_privilege('authenticated', 'public.video_calls', 'insert')
  and not has_table_privilege('authenticated', 'public.video_calls', 'update')
  and not has_table_privilege('authenticated', 'public.video_calls', 'delete'), 'clients cannot write video_calls directly');
select pg_temp.check(not has_table_privilege('anon', 'public.video_calls', 'select'), 'anon cannot read video_calls');
select pg_temp.check(not has_function_privilege('authenticated', 'public.video_call_close_stale(uuid)', 'execute'),
  'internal close_stale helper is not callable by clients');
select pg_temp.check(not has_function_privilege('anon', 'public.request_video_call(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.video_call_join(uuid)', 'execute'), 'anon cannot call video RPCs');
select pg_temp.check(has_function_privilege('authenticated', 'public.video_call_join(uuid)', 'execute'),
  'signed-in users can call video_call_join (Edge Function uses the caller JWT)');
select pg_temp.check(exists (select 1 from public.app_config where key = 'rate_limits' and value ? 'video_call' and value ? 'video_call_join'),
  'rate limit keys video_call / video_call_join exist in app_config');
select pg_temp.check(not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and prosecdef
  and proname like '%video_call%' and not exists (select 1 from unnest(proconfig) c where c like 'search_path=%')),
  'video security definer functions pin search_path');

-- ---------- request: A asks ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select set_config('t.c1', (public.request_video_call(current_setting('t.m')::uuid)).id::text, true);
select pg_temp.check((select status = 'requested' and requested_by = auth.uid() and expires_at = now() + interval '10 minutes'
  from public.video_calls where id = current_setting('t.c1')::uuid), 'request creates a pending session that lapses in 10 minutes');
select pg_temp.check((public.request_video_call(current_setting('t.m')::uuid)).id = current_setting('t.c1')::uuid,
  'repeated request by the same user returns the same session');
select pg_temp.expect_error($q$select public.respond_video_call(current_setting('t.c1')::uuid, 'accept')$q$,
  'requester cannot accept their own request', '42501');
select pg_temp.expect_error($q$select public.video_call_join(current_setting('t.c1')::uuid)$q$,
  'no room/token before both accepted', '42501');
select pg_temp.expect_error($q$insert into public.video_calls (match_id, requested_by, status, expires_at)
  values (current_setting('t.m')::uuid, auth.uid(), 'accepted', now())$q$, 'direct insert is refused', '42501');

-- ---------- RLS: partner sees, outsider does not ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.check((select count(*) from public.video_calls) = 1, 'partner sees the session');
select pg_temp.as_user('00000000-0000-0000-0000-000000000023');
select pg_temp.check((select count(*) from public.video_calls) = 0, 'outsider sees nothing');
select pg_temp.expect_error($q$select public.request_video_call(current_setting('t.m')::uuid)$q$, 'outsider cannot request', '42501');
select pg_temp.expect_error($q$select public.respond_video_call(current_setting('t.c1')::uuid, 'accept')$q$, 'outsider cannot accept', '42501');
select pg_temp.expect_error($q$select public.video_call_join(current_setting('t.c1')::uuid)$q$, 'outsider cannot join', '42501');
select pg_temp.expect_error($q$select public.end_video_call(current_setting('t.c1')::uuid)$q$, 'outsider cannot end', '42501');

-- ---------- accept: B consents ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.expect_error($q$select public.respond_video_call(current_setting('t.c1')::uuid, 'maybe')$q$, 'bad action rejected', '22023');
select public.respond_video_call(current_setting('t.c1')::uuid, 'accept');
select pg_temp.check((select status = 'accepted' and accepted_at = now() and expires_at = now() + interval '30 minutes'
  from public.video_calls where id = current_setting('t.c1')::uuid), 'accepted session lasts at most 30 minutes');
select pg_temp.check((public.video_call_join(current_setting('t.c1')::uuid)) ->> 'user_id' = '00000000-0000-0000-0000-000000000022',
  'join returns the caller as the token user (B)');
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.check((public.video_call_join(current_setting('t.c1')::uuid)) ->> 'user_name' = 'Ana',
  'join returns the caller as the token user (A)');
select pg_temp.expect_error($q$update public.video_calls set expires_at = now() + interval '5 hours'$q$,
  'client cannot extend the call', '42501');
reset role;
select pg_temp.expect_error($q$update public.video_calls set expires_at = accepted_at + interval '2 hours' where id = current_setting('t.c1')::uuid$q$,
  'even the server cannot store an accepted call longer than 30 minutes', '23514');
-- Service role (Edge Function) records the room name.
set local role service_role;
update public.video_calls set room_name = 'rv-' || replace(current_setting('t.c1'), '-', '') where id = current_setting('t.c1')::uuid;
reset role;
select pg_temp.check((select room_name is not null from public.video_calls where id = current_setting('t.c1')::uuid), 'service role stores the room name');

-- ---------- end ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.check((public.end_video_call(current_setting('t.c1')::uuid)).status = 'ended', 'member ends the call');
select pg_temp.check((public.end_video_call(current_setting('t.c1')::uuid)).status = 'ended', 'ending twice is harmless');
select pg_temp.expect_error($q$select public.video_call_join(current_setting('t.c1')::uuid)$q$, 'ended call cannot be joined', '42501');

-- ---------- both request: the second request is consent ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select set_config('t.c2', (public.request_video_call(current_setting('t.m')::uuid)).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.check((public.request_video_call(current_setting('t.m')::uuid)).status = 'accepted',
  'request while the partner already asked accepts the partner''s request');
select pg_temp.check((select count(*) from public.video_calls where status in ('requested','accepted')) = 1, 'one open session per match');

-- ---------- blocks ----------
reset role;
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000021');
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.expect_error($q$select public.video_call_join(current_setting('t.c2')::uuid)$q$, 'blocked user cannot join an accepted call', '42501');
select pg_temp.expect_error($q$select public.request_video_call(current_setting('t.m')::uuid)$q$, 'blocked user cannot request', '42501');
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.expect_error($q$select public.video_call_join(current_setting('t.c2')::uuid)$q$, 'blocker cannot join either', '42501');
select pg_temp.check((public.end_video_call(current_setting('t.c2')::uuid)).status = 'ended', 'call can still be ended after a block');
reset role;
delete from public.blocks;

-- ---------- decline and expiry ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select set_config('t.c3', (public.request_video_call(current_setting('t.m')::uuid)).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.check((public.respond_video_call(current_setting('t.c3')::uuid, 'decline')).status = 'declined', 'partner can decline');
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select set_config('t.c4', (public.request_video_call(current_setting('t.m')::uuid)).id::text, true);
reset role;
update public.video_calls set expires_at = now() - interval '1 second' where id = current_setting('t.c4')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.expect_error($q$select public.respond_video_call(current_setting('t.c4')::uuid, 'accept')$q$, 'expired request cannot be accepted', '42501');
select pg_temp.check((public.request_video_call(current_setting('t.m')::uuid)).id <> current_setting('t.c4')::uuid,
  'new request after expiry starts a new session');
select pg_temp.check((select status from public.video_calls where id = current_setting('t.c4')::uuid) = 'expired', 'stale request is marked expired');

-- ---------- rate limits (app_config.rate_limits) ----------
-- A has created c1, c3, c4 (3 of 4); B created c2 and the latest one.
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select public.end_video_call(id) from public.video_calls where status in ('requested','accepted');
select set_config('t.c5', (public.request_video_call(current_setting('t.m')::uuid)).id::text, true);
select public.end_video_call(current_setting('t.c5')::uuid);
select pg_temp.expect_error($q$select public.request_video_call(current_setting('t.m')::uuid)$q$,
  'call requests over the hourly limit are rejected with P0429', 'P0429');
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select set_config('t.c6', (public.request_video_call(current_setting('t.m')::uuid)).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select public.respond_video_call(current_setting('t.c6')::uuid, 'accept');
-- A joined c1 once; limit 5.
select public.video_call_join(current_setting('t.c6')::uuid);
select public.video_call_join(current_setting('t.c6')::uuid);
select public.video_call_join(current_setting('t.c6')::uuid);
select public.video_call_join(current_setting('t.c6')::uuid);
select pg_temp.expect_error($q$select public.video_call_join(current_setting('t.c6')::uuid)$q$,
  'room/token requests over the hourly limit are rejected with P0429', 'P0429');

-- ---------- unmatch ----------
reset role;
update public.matches set ended_at = now(), ended_by = '00000000-0000-0000-0000-000000000022' where id = current_setting('t.m')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.expect_error($q$select public.video_call_join(current_setting('t.c6')::uuid)$q$, 'no join after unmatch', '42501');
select pg_temp.expect_error($q$select public.request_video_call(current_setting('t.m')::uuid)$q$, 'no request after unmatch', '42501');
select pg_temp.check((public.end_video_call(current_setting('t.c6')::uuid)).status = 'ended', 'open call can be ended after unmatch');
select pg_temp.as_user(null::uuid);
select pg_temp.expect_error($q$select public.request_video_call(current_setting('t.m')::uuid)$q$, 'anon cannot request');

rollback;
