-- Admin panel (0023): every admin RPC is closed to non-admins, every action is logged, sanctions are lifted
-- through appeals, config is validated, the last admin cannot be removed.
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

-- Expects an error; with p_code also checks the SQLSTATE.
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

create or replace function pg_temp.logged(p_action text, p_target uuid) returns boolean language sql as $$
  select exists (select 1 from public.admin_actions where action = p_action
                 and (p_target is null or target_user = p_target)
                 and admin_id = '00000000-0000-0000-0000-0000000000a1')
$$;

-- ---------- catalog ----------
select pg_temp.check(not exists (
  select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'admin\_%'
    and has_function_privilege('authenticated', p.oid, 'execute')
    and (not p.prosecdef
         or not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
         or (p.prosrc not like '%is_admin()%' and p.prosrc not like '%admin_guard()%'))),
  'every client-callable admin_* function is security definer, pins search_path and checks is_admin()');
select pg_temp.check(not exists (
  select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'admin\_%'
    and has_function_privilege('anon', p.oid, 'execute')), 'anon can execute no admin_* function');
select pg_temp.check(not has_function_privilege('authenticated', 'public.admin_log(text, uuid, text, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_recompute_restriction(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.user_last_active(uuid)', 'execute'),
  'internal helpers (log, recompute, last activity) are not callable by clients');
select pg_temp.check(not has_table_privilege('authenticated', 'public.admin_actions', 'insert')
  and not has_table_privilege('authenticated', 'public.admin_actions', 'update')
  and not has_table_privilege('authenticated', 'public.admin_actions', 'delete'), 'admin_actions is read-only for clients');

-- ---------- fixtures ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'founder@test'),
  ('00000000-0000-0000-0000-0000000000a2', 'mod@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'target@test'),
  ('00000000-0000-0000-0000-0000000000b2', 'reporter@test');
insert into public.profiles (id, display_name, age, gender, seeking, intent, country, city, onboarding_done,
  terms_accepted_at, adult_confirmed_at, sensitive_consent_at, bio) values
  ('00000000-0000-0000-0000-0000000000a1', 'Founder', 30, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-0000000000a2', 'Mod', 30, 'woman', 'men', 'serious', 'CZ', 'Praha', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-0000000000b1', 'Target', 25, 'man', 'women', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x'),
  ('00000000-0000-0000-0000-0000000000b2', 'Reporter', 26, 'woman', 'men', 'serious', 'SK', 'Bratislava', true, now(), now(), now(), 'x');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.matches (user_a, user_b) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
insert into public.messages (client_id, match_id, sender_id, body)
  select gen_random_uuid(), id, '00000000-0000-0000-0000-0000000000b1', 'rude message' from public.matches
  where user_a = '00000000-0000-0000-0000-0000000000b1';
select set_config('test.msg', (select id::text from public.messages where body = 'rude message'), true);

-- ---------- non-admins are denied every admin RPC ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect_error(q, 'non-admin denied: ' || q, '42501') from unnest(array[
  $q$select public.admin_dashboard()$q$,
  $q$select public.admin_user_search(null, null, null, null, null, 'new', 50, 0)$q$,
  $q$select public.admin_user_detail('00000000-0000-0000-0000-0000000000b1')$q$,
  $q$select public.admin_sanction_user('00000000-0000-0000-0000-0000000000b1', 'ban', 'spam spam', null)$q$,
  $q$select public.admin_lift_sanction('00000000-0000-0000-0000-0000000000b1', 'mistake', null)$q$,
  $q$select public.admin_verification_decide('00000000-0000-0000-0000-0000000000b2', 'approved', null)$q$,
  $q$select public.admin_remove_photo(gen_random_uuid(), 'bad photo')$q$,
  $q$select public.admin_report_queue('new', null, null, null, null, 50, 0)$q$,
  $q$select public.admin_report_assign(gen_random_uuid(), true)$q$,
  $q$select public.admin_report_resolve(gen_random_uuid(), 'dismissed', 'nothing here', null, false)$q$,
  $q$select public.admin_appeal_queue('open', 50, 0)$q$,
  $q$select public.admin_appeal_decide(gen_random_uuid(), true, 'fine then')$q$,
  $q$select public.admin_verification_queue('pending', 50, 0)$q$,
  $q$select public.admin_config_set('support_email', '"x@y.sk"', null)$q$,
  $q$select public.admin_audit_log(null, null, null, 50, 0)$q$,
  $q$select public.admin_list_admins()$q$,
  $q$select public.admin_add_admin('reporter@test', 'make me admin')$q$,
  $q$select public.admin_remove_admin('00000000-0000-0000-0000-0000000000a1', 'take over')$q$,
  $q$select public.admin_set_config('support_email', '"x@y.sk"')$q$,
  $q$select public.admin_sanction('00000000-0000-0000-0000-0000000000b1', 'lift', 'x', null)$q$,
  $q$select public.admin_set_verification('00000000-0000-0000-0000-0000000000b2', 'approved')$q$,
  $q$select public.admin_decide_report(gen_random_uuid(), 'dismissed', null, null)$q$,
  $q$select public.admin_decide_appeal(gen_random_uuid(), true)$q$,
  $q$select public.admin_decide_referral(gen_random_uuid(), true)$q$,
  $q$select public.admin_stats(null)$q$
]) q;
select pg_temp.expect_error($q$update public.app_config set value = '"x@y.sk"' where key = 'support_email'$q$,
  'regular user cannot write app_config directly');
select pg_temp.check((select count(*) from public.admin_actions) = 0, 'non-admin reads no audit log');

-- ---------- direct sanctions ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error($q$select public.admin_sanction_user('00000000-0000-0000-0000-0000000000b1', 'suspension', '', 3)$q$,
  'sanction without a reason is rejected', '22023');
select pg_temp.expect_error($q$select public.admin_sanction_user('00000000-0000-0000-0000-0000000000b1', 'suspension', 'spam', 0)$q$,
  'suspension needs 1..365 days', '22023');
select public.admin_sanction_user('00000000-0000-0000-0000-0000000000b1', 'suspension', 'spam in chats', 3);
select pg_temp.check((select suspended_until between now() + interval '2 days 23 hours' and now() + interval '3 days 1 hour'
  from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'suspension for N days sets suspended_until');
select pg_temp.check(pg_temp.logged('user.suspension', '00000000-0000-0000-0000-0000000000b1'), 'suspension is logged');
select pg_temp.expect_error($q$select public.admin_lift_sanction('00000000-0000-0000-0000-0000000000b1', ' ', null)$q$,
  'lifting needs a reason', '22023');
select public.admin_lift_sanction('00000000-0000-0000-0000-0000000000b1', 'mistake, sorry', null);
select pg_temp.check((select suspended_until is null from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'lift clears the restriction');
select pg_temp.check((select s->>'lift_reason' = 'mistake, sorry' and s->>'lifted_by_email' = 'founder@test' and not (s->>'active')::boolean
  from jsonb_array_elements(public.admin_user_detail('00000000-0000-0000-0000-0000000000b1')->'sanctions') s
  where s->>'kind' = 'suspension'), 'lift is recorded on the sanction');
select pg_temp.check(pg_temp.logged('user.lift', '00000000-0000-0000-0000-0000000000b1'), 'lift is logged');
select public.admin_sanction_user('00000000-0000-0000-0000-0000000000b1', 'ban', 'scam links', null);
select public.admin_sanction_user('00000000-0000-0000-0000-0000000000b1', 'suspension', 'also spam', 5);
select pg_temp.check((select public.account_status_of(suspended_until) = 'banned' from public.profiles
  where id = '00000000-0000-0000-0000-0000000000b1'), 'ban wins over a suspension');
select public.admin_lift_sanction('00000000-0000-0000-0000-0000000000b1', 'ban was too harsh',
  (select id from public.account_sanctions where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'ban'));
select pg_temp.check((select public.account_status_of(suspended_until) = 'suspended' from public.profiles
  where id = '00000000-0000-0000-0000-0000000000b1'), 'lifting only the ban leaves the remaining suspension');
select public.admin_lift_sanction('00000000-0000-0000-0000-0000000000b1', 'clean slate', null);
select pg_temp.expect_error($q$select public.admin_sanction_user('00000000-0000-0000-0000-0000000000a1', 'ban', 'self ban', null)$q$,
  'admins cannot be suspended or banned', '42501');
select public.admin_sanction('00000000-0000-0000-0000-0000000000b2', 'warning', 'admin', null);
select pg_temp.check(pg_temp.logged('user.warning', '00000000-0000-0000-0000-0000000000b2'), 'legacy admin_sanction is logged too');

-- ---------- users list and detail ----------
select pg_temp.check((public.admin_user_search('target@', null, null, null, null, 'new', 50, 0)->>'total')::int = 1, 'search by e-mail');
select pg_temp.check((public.admin_user_search('00000000-0000-0000-0000-0000000000b2', null, null, null, null, 'new', 50, 0)->>'total')::int = 1, 'search by id');
select pg_temp.check((public.admin_user_search(null, 'CZ', null, null, null, 'new', 50, 0)->>'total')::int = 1, 'filter by country');
select pg_temp.check((public.admin_user_search(null, null, null, null, null, 'new', 2, 0)->'rows' ->> 1) is not null
  and jsonb_array_length(public.admin_user_search(null, null, null, null, null, 'new', 2, 0)->'rows') = 2, 'paging limits the page');
select pg_temp.check(jsonb_array_length(public.admin_user_detail('00000000-0000-0000-0000-0000000000b1')->'sanctions') = 3,
  'user detail lists sanction history');

-- ---------- reports: queue, assign, resolve ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select set_config('test.rep', (public.report('00000000-0000-0000-0000-0000000000b1', current_setting('test.msg')::uuid, 'harassment', 'insults')).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((public.admin_report_queue('new', null, null, null, null, 50, 0)->'rows'->0->>'message_body') = 'rude message',
  'new report is in the queue with the reported message');
select public.admin_report_assign(current_setting('test.rep')::uuid, true);
select pg_temp.check((public.admin_report_queue('review', null, null, 'me', null, 50, 0)->>'total')::int = 1, 'assigned report moves to "in review"');
select pg_temp.check(pg_temp.logged('report.assign', '00000000-0000-0000-0000-0000000000b1'), 'assignment is logged');
select pg_temp.expect_error(format($q$select public.admin_report_resolve(%L, 'suspension', '', 7, false)$q$, current_setting('test.rep')),
  'resolving needs a note', '22023');
select public.admin_report_resolve(current_setting('test.rep')::uuid, 'suspension', 'insults confirmed', 7, true);
select pg_temp.check((select r->>'status' = 'actioned' and r->>'decision' = 'suspension' and r->>'resolution_note' = 'insults confirmed'
  and r->>'resolved_by_email' = 'founder@test'
  from jsonb_array_elements(public.admin_report_queue('resolved', null, null, null, null, 50, 0)->'rows') r
  where r->>'id' = current_setting('test.rep')), 'report resolved with outcome and note');
select pg_temp.check((select deleted_at is not null from public.messages where id = current_setting('test.msg')::uuid), 'reported message removed');
select pg_temp.check((select public.account_status_of(suspended_until) = 'suspended' from public.profiles
  where id = '00000000-0000-0000-0000-0000000000b1'), 'report outcome suspends the target');
select pg_temp.check(pg_temp.logged('report.resolve', '00000000-0000-0000-0000-0000000000b1'), 'resolution is logged');
select pg_temp.expect_error(format($q$select public.admin_report_resolve(%L, 'dismissed', 'again', null, false)$q$, current_setting('test.rep')),
  'a resolved report cannot be resolved twice', '22023');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.check((select status from public.reports where id = current_setting('test.rep')::uuid) = 'actioned', 'reporter sees the outcome');
select pg_temp.expect_error($q$select resolution_note from public.reports$q$, 'reporter cannot read the moderator note');

-- ---------- appeals: accept lifts the sanction ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select set_config('test.appeal', (public.submit_appeal(current_setting('test.rep')::uuid, 'I was provoked, sorry')).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((public.admin_appeal_queue('open', 50, 0)->'rows'->0->>'role') = 'target', 'appeal queue shows the appellant role');
select pg_temp.expect_error(format($q$select public.admin_appeal_decide(%L, true, '')$q$, current_setting('test.appeal')),
  'appeal decision needs a reason', '22023');
select public.admin_appeal_decide(current_setting('test.appeal')::uuid, true, 'first offence, suspension lifted');
select pg_temp.check((select suspended_until is null from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'accepted appeal lifts the suspension');
select pg_temp.check((select lifted_at is not null from public.account_sanctions
  where reason = 'report ' || current_setting('test.rep')), 'accepted appeal marks the sanction lifted');
select pg_temp.check(pg_temp.logged('appeal.accept', '00000000-0000-0000-0000-0000000000b1'), 'appeal decision is logged');
select pg_temp.expect_error(format($q$select public.admin_appeal_decide(%L, false, 'changed my mind')$q$, current_setting('test.appeal')),
  'an appeal is decided once', '22023');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select status = 'accepted' and decision_reason = 'first offence, suspension lifted' from public.appeals
  where id = current_setting('test.appeal')::uuid), 'user sees the appeal outcome and reason');

-- ---------- appeals: reject keeps the sanction ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select set_config('test.rep2', (public.report('00000000-0000-0000-0000-0000000000b1', null, 'scam', 'asks for money')).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.admin_report_resolve(current_setting('test.rep2')::uuid, 'ban', 'scam confirmed', null, false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select set_config('test.appeal2', (public.submit_appeal(current_setting('test.rep2')::uuid, 'not a scam really')).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.admin_appeal_decide(current_setting('test.appeal2')::uuid, false, 'evidence is clear');
select pg_temp.check((select public.account_status_of(suspended_until) = 'banned' from public.profiles
  where id = '00000000-0000-0000-0000-0000000000b1'), 'rejected appeal keeps the ban');

-- ---------- appeals: reporter's appeal against a dismissal re-opens the report ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select set_config('test.rep3', (public.report('00000000-0000-0000-0000-0000000000a2', null, 'fake', 'stolen photos')).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.admin_report_resolve(current_setting('test.rep3')::uuid, 'dismissed', 'photos look genuine', null, false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select set_config('test.appeal3', (public.submit_appeal(current_setting('test.rep3')::uuid, 'here is the original source')).id::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.admin_appeal_decide(current_setting('test.appeal3')::uuid, true, 'new evidence, re-checking');
select pg_temp.check((public.admin_report_queue('new', null, null, null, '00000000-0000-0000-0000-0000000000a2', 50, 0)->'rows'->0->>'id')
  = current_setting('test.rep3'), 'accepted reporter appeal re-opens the report (back to "new")');

-- ---------- verification ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select public.request_verification('00000000-0000-0000-0000-0000000000b2/verify/selfie.jpg');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((public.admin_verification_queue('pending', 50, 0)->>'total')::int = 1, 'pending selfie is in the queue');
select pg_temp.expect_error($q$select public.admin_verification_decide('00000000-0000-0000-0000-0000000000b2', 'rejected', null)$q$,
  'rejection needs a reason', '22023');
select public.admin_verification_decide('00000000-0000-0000-0000-0000000000b2', 'rejected', 'face not visible');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.check((select status = 'rejected' and decision_reason = 'face not visible' from public.verification_requests),
  'user sees the rejection reason');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.admin_verification_decide('00000000-0000-0000-0000-0000000000b2', 'approved', null);
select pg_temp.check((select verification_status from public.profiles where id = '00000000-0000-0000-0000-0000000000b2') = 'approved',
  'verification can be approved');
select public.admin_verification_decide('00000000-0000-0000-0000-0000000000b2', 'revoked', 'photos replaced');
select pg_temp.check((select verification_status from public.profiles where id = '00000000-0000-0000-0000-0000000000b2') = 'rejected'
  and pg_temp.logged('verification.revoke', '00000000-0000-0000-0000-0000000000b2'), 'verification can be revoked (logged)');

-- ---------- no plans (0029): nothing to grant or reset ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check(to_regprocedure('public.admin_reset_free(uuid,text)') is null, 'there is no reset-to-Free admin action');
select pg_temp.check(not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
  and proname ~ '^admin_.*(grant|tier|subscription|reset_free)'), 'no admin RPC deals with tiers or subscriptions');
select pg_temp.check(not (public.admin_dashboard() ? 'paid_subscribers'), 'dashboard has no paid-subscriber tile');
select pg_temp.check(not (public.admin_user_detail('00000000-0000-0000-0000-0000000000b1') ? 'subscription'), 'user detail has no subscription section');
select pg_temp.check(not exists (select 1 from jsonb_array_elements(public.admin_user_search(null, null, null, null, null, 'new', 50, 0)->'rows') r where r ? 'tier'),
  'user list has no tier column');

-- ---------- config ----------
select pg_temp.expect_error($q$select public.admin_config_set('legal_urls', '{"privacy":"http://renvi.app/p"}', null)$q$,
  'legal URL must be https', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('legal_urls', '{"cookies":"https://renvi.app/c"}', null)$q$,
  'unknown legal document rejected', '22023');
select public.admin_config_set('legal_urls', '{"privacy":"https://renvi.app/privacy","terms":"https://renvi.app/terms","community":null,"moderation":null}', 'fill links');
select pg_temp.expect_error($q$select public.admin_config_set('legal_urls', '{"subscriptions":"https://renvi.app/s"}', null)$q$,
  'there is no subscriptions document any more', '22023');
select pg_temp.check((select value->>'privacy' from public.app_config where key = 'legal_urls') = 'https://renvi.app/privacy', 'legal URL saved');
select pg_temp.check((select details->'new'->>'privacy' = 'https://renvi.app/privacy' and details->'old'->'privacy' = 'null'::jsonb
  from public.admin_actions where action = 'config.set' and target_id = 'legal_urls'), 'config change is logged with old and new value');
select pg_temp.expect_error($q$select public.admin_config_set('support_email', '"not-an-email"', null)$q$, 'support e-mail validated', '22023');
select public.admin_config_set('support_email', '"help@renvi.app"', null);
select pg_temp.expect_error($q$select public.admin_config_set('prices_preliminary', '{}', null)$q$, 'prices key no longer exists', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('tier_limits', '{"free":{"daily_likes":5}}', null)$q$,
  'tier_limits key no longer exists', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('daily_spark_limit', '0', null)$q$, 'spark limit must be at least 1', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('daily_spark_limit', '2.5', null)$q$, 'spark limit must be a whole number', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('daily_spark_limit', '{"free":5}', null)$q$, 'spark limit is one number, not per tier', '22023');
select public.admin_config_set('daily_spark_limit', '150', 'raise limit');
select pg_temp.check((select value from public.app_config where key = 'daily_spark_limit') = '150'::jsonb
  and pg_temp.logged('config.set', null), 'spark limit is editable by an admin (logged)');
select pg_temp.expect_error($q$select public.admin_config_set('referral', '{"goal":0}', null)$q$, 'referral goal validated', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('referral', '{"goal":5,"reward_days":7}', null)$q$, 'referral has no reward days', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('digest', '{"enabled":true,"weekday":9,"hour_utc":17}', null)$q$, 'digest weekday validated', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('whatever', '1', null)$q$, 'unknown config key rejected', '22023');
select pg_temp.expect_error($q$select public.admin_config_set('launch_countries', '["XX"]', null)$q$, 'launch country must be known', '22023');
select public.admin_config_set('banned_words', '["spamword"]', null);
select pg_temp.expect_error($q$update public.app_config set value = '[]' where key = 'banned_words'$q$,
  'admin cannot bypass the validated RPC with a direct write');
select public.admin_set_config('rate_limits', '{"report": 10, "submit_appeal": 5}');
select pg_temp.check(pg_temp.logged('config.set', null) and (select count(*) from public.admin_actions where action = 'config.set') >= 3,
  'legacy admin_set_config is validated and logged');

-- ---------- dashboard and audit log ----------
select pg_temp.check(jsonb_typeof(public.admin_dashboard()->'countries') = 'array'
  and (public.admin_dashboard()->>'demo_bots') is not null
  and (public.admin_dashboard()->'missing_legal_urls') ? 'community', 'dashboard has per-country rows, demo-bot count and missing links');
select pg_temp.check(exists (select 1 from jsonb_array_elements(public.admin_dashboard()->'countries') c
  where c->>'country' = 'SK' and (c->>'users')::int >= 3 and (c->>'reports_open')::int >= 0), 'dashboard counts users per country');
select pg_temp.check((public.admin_audit_log('report.', null, null, 50, 0)->>'total')::int >= 3, 'audit log filters by action');
select pg_temp.check((public.admin_audit_log(null, null, null, 1, 0)->'rows'->0->>'admin_email') = 'founder@test', 'audit log shows who acted');

-- ---------- admin management ----------
select pg_temp.expect_error($q$select public.admin_remove_admin('00000000-0000-0000-0000-0000000000a1', 'leaving')$q$,
  'the last admin cannot be removed', '42501');
select pg_temp.expect_error($q$select public.admin_add_admin('nobody@test', 'new moderator')$q$, 'unknown e-mail cannot become admin', 'P0002');
select public.admin_add_admin('MOD@test', 'new moderator');
select pg_temp.check(jsonb_array_length(public.admin_list_admins()) = 2 and pg_temp.logged('admin.add', '00000000-0000-0000-0000-0000000000a2'),
  'admin added by an existing admin (logged)');
select pg_temp.expect_error($q$select public.admin_add_admin('mod@test', 'again')$q$, 'duplicate admin rejected', '23505');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.admin_remove_admin('00000000-0000-0000-0000-0000000000a1', 'founder handed over');
select pg_temp.check(jsonb_array_length(public.admin_list_admins()) = 1, 'an admin can remove another admin');
select pg_temp.expect_error($q$select public.admin_remove_admin('00000000-0000-0000-0000-0000000000a2', 'bye')$q$,
  'the new last admin cannot remove themselves', '42501');
reset role;
select pg_temp.expect_error($q$delete from public.admins$q$, 'even the database owner cannot delete the last admin row', '42501');

rollback;
\echo ALL ADMIN TESTS PASSED
