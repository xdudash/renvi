-- Server side of the admin review (migration 0035) and the guarantees the admin screens rely on:
-- discover_recycle is validated, only a confirmed account can be made admin, the default report queue ("open")
-- keeps a taken report in front of the moderator, a warning is visible to the warned user and restricts nothing,
-- unbanning works, the app error log is readable by admins only, every audit-log filter group has rows.
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
create or replace function pg_temp.expect_error(p_sql text, p_name text, p_code text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_code is not null and sqlstate <> p_code then
      raise exception 'FAILED (wrong error % %): %', sqlstate, sqlerrm, p_name;
    end if;
    raise notice 'ok - % (%)', p_name, sqlerrm;
    return;
  end;
  raise exception 'FAILED (no error): %', p_name;
end $$;

-- ---------- fixtures ----------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000c0a1', 'boss@test', now()),
  ('00000000-0000-0000-0000-00000000c0b1', 'target@test', now()),
  ('00000000-0000-0000-0000-00000000c0b2', 'reporter@test', now()),
  ('00000000-0000-0000-0000-00000000c0c1', 'confirmed@test', now()),
  ('00000000-0000-0000-0000-00000000c0c2', 'unconfirmed@test', null);
insert into public.profiles (id, display_name, age, gender, seeking, intent, country, city, onboarding_done,
  terms_accepted_at, adult_confirmed_at, sensitive_consent_at, bio) values
  ('00000000-0000-0000-0000-00000000c0a1', 'Boss', 30, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-00000000c0b1', 'Target', 25, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-00000000c0b2', 'Reporter', 26, 'woman', 'men', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000c0a1');

-- ---------- discover_recycle: validated ----------
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0b1');
select pg_temp.expect_error($q$select public.admin_config_set('discover_recycle', '{"cooldown_hours":1,"fallback_minutes":1,"max_passes":1}', null)$q$,
  'a regular user cannot change discover_recycle', '42501');
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0a1');
select pg_temp.check((select value ? 'cooldown_hours' and value ? 'fallback_minutes' and value ? 'max_passes'
  from public.app_config where key = 'discover_recycle'), 'discover_recycle has its three default fields');
select pg_temp.expect_error($q$select public.admin_config_set('discover_recycle', '{"cooldown_hours":"x","fallback_minutes":10,"max_passes":5}', null)$q$,
  'cooldown must be a number', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('discover_recycle', '{"cooldown_hours":-1,"fallback_minutes":10,"max_passes":5}', null)$q$,
  'cooldown cannot be negative', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('discover_recycle', '{"cooldown_hours":24.5,"fallback_minutes":10,"max_passes":5}', null)$q$,
  'cooldown must be a whole number', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('discover_recycle', '{"cooldown_hours":24,"fallback_minutes":10,"max_passes":0}', null)$q$,
  'max_passes is at least 1', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('discover_recycle', '{"cooldown_hours":24,"fallback_minutes":10,"max_passes":101}', null)$q$,
  'max_passes is at most 100', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('discover_recycle', '{"cooldown_hours":24,"fallback_minutes":10}', null)$q$,
  'all three fields are required', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('discover_recycle', '{"cooldown_hours":24,"fallback_minutes":10,"max_passes":5,"x":1}', null)$q$,
  'unknown discover_recycle field rejected', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('discover_recycle', '5', null)$q$,
  'discover_recycle must be an object', '22023');
select public.admin_config_set('discover_recycle', '{"cooldown_hours":12,"fallback_minutes":5,"max_passes":3}', 'tune the feed');
select pg_temp.check((select value = '{"cooldown_hours":12,"fallback_minutes":5,"max_passes":3}'::jsonb from public.app_config where key = 'discover_recycle'),
  'valid discover_recycle is saved');
select pg_temp.check((select details->'old'->>'max_passes' = '5' and details->'new'->>'max_passes' = '3' and reason = 'tune the feed'
  from public.admin_actions where action = 'config.set' and target_id = 'discover_recycle'), 'discover_recycle change is logged with old and new value');
reset role;
select pg_temp.check((select cooldown_hours = 12 and fallback_minutes = 5 and max_passes = 3 from public.discover_recycle_settings()),
  'the feed reads the saved discover_recycle values');

-- ---------- only a confirmed account becomes an admin ----------
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0a1');
select pg_temp.expect_error($q$select public.admin_add_admin('unconfirmed@test', 'new moderator')$q$, 'an unconfirmed e-mail cannot be made admin', '22023');
select pg_temp.check(not exists (select 1 from public.admins where user_id = '00000000-0000-0000-0000-00000000c0c2'), 'the unconfirmed account is not an admin');
select pg_temp.check(not exists (select 1 from public.admin_actions where action = 'admin.add' and target_user = '00000000-0000-0000-0000-00000000c0c2'),
  'a refused attempt writes no admin.add record');
select public.admin_add_admin(' Confirmed@Test ', 'second moderator');
select pg_temp.check(exists (select 1 from public.admins where user_id = '00000000-0000-0000-0000-00000000c0c1' and added_by = '00000000-0000-0000-0000-00000000c0a1'),
  'a confirmed account becomes admin (e-mail match ignores case and spaces)');
select pg_temp.check(exists (select 1 from public.admin_actions where action = 'admin.add' and target_user = '00000000-0000-0000-0000-00000000c0c1' and reason = 'second moderator'),
  'adding an admin is logged with the reason');
select pg_temp.expect_error($q$select public.admin_add_admin('confirmed@test', 'again')$q$, 'a second add is a duplicate', '23505');
select public.admin_remove_admin('00000000-0000-0000-0000-00000000c0c1', 'was only a test');
select pg_temp.check(jsonb_array_length(public.admin_list_admins()) = 1 and exists (select 1 from public.admin_actions where action = 'admin.remove'),
  'removing an admin is logged');
select pg_temp.expect_error($q$select public.admin_remove_admin('00000000-0000-0000-0000-00000000c0a1', 'leaving')$q$, 'the last admin cannot be removed', '42501');

-- ---------- warning: a sanction row the user can see, no restriction ----------
select public.admin_sanction_user('00000000-0000-0000-0000-00000000c0b1', 'warning', 'please be polite', null);
select pg_temp.check((select suspended_until is null from public.profiles where id = '00000000-0000-0000-0000-00000000c0b1'), 'a warning restricts nothing');
select pg_temp.check(exists (select 1 from public.admin_actions where action = 'user.warning' and target_user = '00000000-0000-0000-0000-00000000c0b1' and reason = 'please be polite'),
  'warning is in the audit log with its reason');
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0b1');
select pg_temp.check((select count(*) from public.account_sanctions where kind = 'warning') = 1, 'the warned user sees the warning (this is what shows the warning screen)');
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0b2');
select pg_temp.check((select count(*) from public.account_sanctions) = 0, 'other users do not see it');

-- ---------- ban and unban ----------
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0a1');
select public.admin_sanction_user('00000000-0000-0000-0000-00000000c0b1', 'ban', 'scam links', null);
select pg_temp.check((select public.account_status_of(suspended_until) = 'banned' from public.profiles where id = '00000000-0000-0000-0000-00000000c0b1'), 'ban blocks the account');
select public.admin_lift_sanction('00000000-0000-0000-0000-00000000c0b1', 'appeal was right', null);
select pg_temp.check((select public.account_status_of(suspended_until) = 'active' from public.profiles where id = '00000000-0000-0000-0000-00000000c0b1'), 'unban reactivates the account');
select pg_temp.check((public.admin_user_detail('00000000-0000-0000-0000-00000000c0b1')->>'status') = 'active'
  and (select count(*) from jsonb_array_elements(public.admin_user_detail('00000000-0000-0000-0000-00000000c0b1')->'sanctions') s where (s->>'active')::boolean) = 0,
  'user detail shows no active sanction after the unban');

-- ---------- report queue: "open" = new + in review ----------
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0b2');
select set_config('test.r1', (public.report('00000000-0000-0000-0000-00000000c0b1', null, 'scam', 'first')).id::text, true);
select set_config('test.r2', (public.report('00000000-0000-0000-0000-00000000c0b1', null, 'fake', 'second')).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0a1');
select public.admin_report_assign(current_setting('test.r1')::uuid, true);
select pg_temp.check((public.admin_report_queue('new', null, null, null, null, 50, 0)->>'total')::int = 1, '"new" lists only the unassigned report');
select pg_temp.check((public.admin_report_queue('open', null, null, null, null, 50, 0)->>'total')::int = 2, '"open" lists the unassigned and the taken report');
select pg_temp.check((select r->>'state' = 'review' from jsonb_array_elements(public.admin_report_queue('open', null, null, null, null, 50, 0)->'rows') r
  where r->>'id' = current_setting('test.r1')), 'the taken report shows as in review');
select public.admin_report_assign(current_setting('test.r1')::uuid, false);
select pg_temp.check((public.admin_report_queue('new', null, null, null, null, 50, 0)->>'total')::int = 2, 'a released report is back in "new"');
select pg_temp.expect_error(format($q$select public.admin_report_assign(%L, true)$q$, gen_random_uuid()), 'an unknown report cannot be taken', 'P0002');

-- ---------- app error log: admins only ----------
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0b1');
insert into public.error_events (user_id, area, message) values ('00000000-0000-0000-0000-00000000c0b1', 'load', 'boom');
select pg_temp.check((select count(*) from public.error_events) = 0, 'a user cannot read the error log, not even their own entries');
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0a1');
select pg_temp.check((select count(*) from public.error_events where message = 'boom') = 1, 'an admin reads the error log');
select pg_temp.expect_error($q$delete from public.error_events$q$, 'nobody can delete error events from the client');

-- ---------- audit log: every filter group the screen offers has a prefix that matches real actions ----------
select public.admin_correct_identity('00000000-0000-0000-0000-00000000c0b1', '1999-05-04', 'man', 'document check');
select pg_temp.check((public.admin_audit_log('identity.', null, null, 50, 0)->>'total')::int = 1, 'audit filter "identity." finds the correction');
select pg_temp.check((public.admin_audit_log('user.', null, null, 50, 0)->>'total')::int >= 3, 'audit filter "user." finds warning, ban and lift');
select pg_temp.check((public.admin_audit_log('admin.', null, null, 50, 0)->>'total')::int >= 2, 'audit filter "admin." finds add and remove');
select pg_temp.check((public.admin_audit_log('config.', null, null, 50, 0)->>'total')::int >= 1, 'audit filter "config." finds the settings change');
select pg_temp.check((public.admin_audit_log('report.', null, null, 50, 0)->>'total')::int >= 2, 'audit filter "report." finds take and release');
select pg_temp.check((public.admin_audit_log(null, null, '00000000-0000-0000-0000-00000000c0b1', 50, 0)->>'total')::int >= 5, 'audit log filters by the user acted on');

rollback;
\echo ADMIN UI TESTS PASSED
