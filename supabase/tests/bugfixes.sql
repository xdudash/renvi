-- Bug hunt 2026-10-29 (0030_bugfixes.sql, docs/BUGFIX_LOG.md "Server"). Runs as the app's database roles.
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
create or replace function pg_temp.expect_error(p_sql text, p_name text, p_like text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_like is not null and sqlerrm not like p_like and sqlstate not like p_like then
      raise exception 'FAILED: % (wrong error: % %)', p_name, sqlstate, sqlerrm;
    end if;
    raise notice 'ok - % (%)', p_name, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % (no error)', p_name;
end $$;
create or replace function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000007' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function pg_temp.has_index(p_table text, p_cols text) returns boolean language sql stable as $$
  -- an index on p_table whose leading columns are exactly p_cols (comma separated, no spaces)
  select exists (
    select 1 from pg_index i join pg_class t on t.oid = i.indrelid
    where t.relname = p_table and t.relnamespace = 'public'::regnamespace
      and (select string_agg(a.attname, ',' order by k.ord)
           from unnest(i.indkey::int2[]) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
           where k.ord <= array_length(string_to_array(p_cols, ','), 1)) = p_cols)
$$;

-- ---------- fixtures (database owner) ----------
-- 01 Ada woman (receiver) · 02..05 men who spark Ada · 06 Ben man, matched with Ada · 07 Cleo woman
insert into auth.users (id, email) select pg_temp.uid(n), 'b' || n || '@bugfix.test' from generate_series(1, 7) as g(n);
insert into public.profiles (id, display_name, age, gender, seeking, intent, country, city, onboarding_done,
                             terms_accepted_at, adult_confirmed_at, sensitive_consent_at, verification_status)
select pg_temp.uid(n), 'P' || n, 30, case when n in (1, 7) then 'woman' else 'man' end,
       case when n in (1, 7) then 'men' else 'women' end, 'serious', 'SK', 'Bratislava', true, now(), now(), now(),
       case when n = 2 then 'approved' else 'none' end
from generate_series(1, 7) as g(n);
-- P2: a video first, then the cover photo (an avatar must never point at a video file)
insert into public.profile_photos (profile_id, storage_path, kind, position) values
  (pg_temp.uid(2), pg_temp.uid(2)::text || '/profile/clip.mp4', 'video', 0),
  (pg_temp.uid(2), pg_temp.uid(2)::text || '/profile/cover.jpg', 'photo', 1),
  (pg_temp.uid(6), pg_temp.uid(6)::text || '/profile/ben.jpg', 'photo', 0);
-- Sparks to Ada with distinct ages: P5 newest, P2 oldest
insert into public.sparks (from_id, to_id, created_at) values
  (pg_temp.uid(2), pg_temp.uid(1), now() - interval '4 hours'),
  (pg_temp.uid(3), pg_temp.uid(1), now() - interval '3 hours'),
  (pg_temp.uid(4), pg_temp.uid(1), now() - interval '2 hours'),
  (pg_temp.uid(5), pg_temp.uid(1), now() - interval '1 hour');
insert into public.matches (user_a, user_b, created_at) values (pg_temp.uid(1), pg_temp.uid(6), now() - interval '1 day');
insert into public.matches (user_a, user_b, created_at) values (pg_temp.uid(1), pg_temp.uid(7), now() - interval '2 days');
select set_config('t.m_ben', (select id::text from public.matches where user_b = pg_temp.uid(6)), false);
select set_config('t.m_cleo', (select id::text from public.matches where user_b = pg_temp.uid(7)), false);
-- Only the older match has a recent message: it must come first.
insert into public.messages (client_id, match_id, sender_id, body, created_at)
values (gen_random_uuid(), current_setting('t.m_cleo')::uuid, pg_temp.uid(7), 'hello', now() - interval '5 minutes');

-- ================= S1 indexes on hot lookups =================
select pg_temp.check(pg_temp.has_index('matches', 'user_b'), 'S1 matches(user_b) index for "user_a = me or user_b = me"');
select pg_temp.check(pg_temp.has_index('blocks', 'blocked_id'), 'S1 blocks(blocked_id) index for the reverse block check');
select pg_temp.check(pg_temp.has_index('sparks', 'from_id,created_at'), 'S1 sparks(from_id, created_at) for likes_today / daily limit');
select pg_temp.check(pg_temp.has_index('passes', 'from_id,created_at'), 'S1 passes(from_id, created_at) for undo_last_pass');
select pg_temp.check(pg_temp.has_index('reports', 'reporter_id'), 'S1 reports(reporter_id) for report status');
select pg_temp.check(pg_temp.has_index('appeals', 'report_id'), 'S1 appeals(report_id)');
select pg_temp.check(pg_temp.has_index('account_sanctions', 'user_id'), 'S1 account_sanctions(user_id) for gate / restrictions');
select pg_temp.check(pg_temp.has_index('push_tokens', 'user_id'), 'S1 push_tokens(user_id) for push fan-out');
select pg_temp.check(pg_temp.has_index('opening_moves', 'profile_id'), 'S1 opening_moves(profile_id)');

-- ================= S2 incoming_sparks: newest first before the limit, photo + verified =================
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check((public.incoming_sparks()->'items'->0->>'profile_id')::uuid = pg_temp.uid(5), 'S2 newest incoming spark is first');
select pg_temp.check((public.incoming_sparks()->>'count')::int = 4 and jsonb_array_length(public.incoming_sparks()->'items') = 4, 'S2 count and items agree');
select pg_temp.check((select (e->>'verified')::boolean and e->>'photo' = pg_temp.uid(2)::text || '/profile/cover.jpg'
                      from jsonb_array_elements(public.incoming_sparks()->'items') e where (e->>'profile_id')::uuid = pg_temp.uid(2)),
  'S2 items carry the cover PHOTO (not the video) and the verified flag');
select pg_temp.check(position('order by s.created_at desc' in pg_get_functiondef('public.incoming_sparks'::regproc)) > 0
  and position('order by s.created_at desc' in pg_get_functiondef('public.incoming_sparks'::regproc))
      < position('limit 100' in pg_get_functiondef('public.incoming_sparks'::regproc)),
  'S2 the 100-item cut happens after ordering by recency');

-- ================= S3 list_matches: ordered by activity, partner photo / verified =================
select pg_temp.check((select array_agg(partner_id) from public.list_matches()) = array[pg_temp.uid(7), pg_temp.uid(6)],
  'S3 the conversation with the latest message comes first');
select pg_temp.check((select partner_photo from public.list_matches() where partner_id = pg_temp.uid(6)) = pg_temp.uid(6)::text || '/profile/ben.jpg'
  and (select partner_photo from public.list_matches() where partner_id = pg_temp.uid(7)) is null
  and not (select partner_verified from public.list_matches() where partner_id = pg_temp.uid(6)),
  'S3 partner photo and verification come with the list');
select pg_temp.check((select unread from public.list_matches() where partner_id = pg_temp.uid(7)) = 1
  and (select last_body from public.list_matches() where partner_id = pg_temp.uid(7)) = 'hello', 'S3 unread count and last message unchanged');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(not exists (select 1 from public.list_matches()), 'S3 strangers still see none of these matches');

-- ================= S4 atomic prompts / opening moves =================
select pg_temp.as_user(pg_temp.uid(1));
select public.save_prompts('[{"question_key":"q1","answer":"first"},{"question_key":"q2","answer":"second"}]');
select pg_temp.check((select array_agg(answer order by position) from public.profile_prompts where profile_id = pg_temp.uid(1)) = array['first', 'second'],
  'S4 save_prompts stores answers in order');
select pg_temp.expect_error($q$select public.save_prompts('[{"question_key":"q1","answer":"keep?"},{"question_key":"q2","answer":""}]')$q$,
  'S4 an invalid answer is rejected', '22023');
select pg_temp.check((select count(*) from public.profile_prompts where profile_id = pg_temp.uid(1)) = 2,
  'S4 a rejected save keeps the previous answers (no delete-then-fail)');
select pg_temp.expect_error($q$select public.save_prompts('[{"question_key":"a","answer":"1"},{"question_key":"b","answer":"2"},{"question_key":"c","answer":"3"},{"question_key":"d","answer":"4"}]')$q$,
  'S4 more than 3 answers are rejected', '22023');
select public.save_prompts('[]');
select pg_temp.check(not exists (select 1 from public.profile_prompts where profile_id = pg_temp.uid(1)), 'S4 an empty list clears the answers');
select public.save_opening_moves(array['Coffee or a walk?', 'Best view in town?']);
select pg_temp.check((select array_agg(text order by position) from public.opening_moves where profile_id = pg_temp.uid(1)) = array['Coffee or a walk?', 'Best view in town?'],
  'S4 save_opening_moves stores topics in order');
select pg_temp.expect_error($q$select public.save_opening_moves(array['ok topic', 'x'])$q$, 'S4 a too short topic is rejected', '22023');
select pg_temp.check((select count(*) from public.opening_moves where profile_id = pg_temp.uid(1)) = 2, 'S4 a rejected save keeps the previous topics');
select pg_temp.as_user(pg_temp.uid(7));
select public.save_opening_moves(array['Mine only']);
select pg_temp.check((select count(*) from public.opening_moves where profile_id = pg_temp.uid(1)) = 2,
  'S4 saving replaces only the caller''s own topics');
select pg_temp.as_user(null);
select pg_temp.expect_error($q$select public.save_prompts('[]')$q$, 'S4 anonymous callers cannot save prompts');

-- ================= S5 send_message rejects a message with neither text nor photo =================
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.expect_error(format('select public.send_message(%L, gen_random_uuid(), null, null)', current_setting('t.m_ben')),
  'S5 null body and no photo is rejected', '22023');
select pg_temp.expect_error(format('select public.send_message(%L, gen_random_uuid(), %L, null)', current_setting('t.m_ben'), '   '),
  'S5 blank body is still rejected', '22023');
select pg_temp.check((public.send_message(current_setting('t.m_ben')::uuid, gen_random_uuid(), 'hi Ben', null)).body = 'hi Ben',
  'S5 a normal message is still sent');

-- ================= S6 respond_date locks the invitation =================
select pg_temp.as_user(pg_temp.uid(6));
select set_config('t.date', (public.propose_date(current_setting('t.m_ben')::uuid, 'eurovea', null, current_date + 1, '16:00', null)).id::text, false);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check((public.respond_date(current_setting('t.date')::uuid, 'accept')).status = 'accepted', 'S6 the invitee accepts');
select pg_temp.expect_error(format('select public.respond_date(%L, ''decline'')', current_setting('t.date')),
  'S6 a second answer to the same invitation is refused', '%cannot respond%');
select pg_temp.check(position('where id = p_date for update' in pg_get_functiondef('public.respond_date(uuid,text)'::regprocedure)) > 0,
  'S6 the row is read FOR UPDATE (concurrent accept / decline / cancel serialize)');

-- ================= S7 save_filters: empty intents mean all, null bounds are a clear error =================
select public.save_filters(25, 40, 50, false, array[]::text[]);
select pg_temp.check((select filter_intents from public.profiles where id = pg_temp.uid(1)) @> array['serious','casual','friends','unsure'],
  'S7 an empty intents list is stored as "all" (discover no longer matches nobody)');
select public.save_filters(25, 40, null, false, array['casual', 'nonsense', 'casual']);
select pg_temp.check((select filter_intents from public.profiles where id = pg_temp.uid(1)) = array['casual']
  and (select filter_distance_km from public.profiles where id = pg_temp.uid(1)) = 100,
  'S7 unknown / duplicate intents are dropped, a missing distance is the maximum');
select pg_temp.expect_error($q$select public.save_filters(null, 40, 50, false, null)$q$, 'S7 a missing age bound is a 22023, not a NOT NULL crash', '22023');

rollback;
