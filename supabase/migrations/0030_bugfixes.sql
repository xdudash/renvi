-- Bug hunt 2026-10-29 (docs/BUGFIX_LOG.md, section "Server"). Tests: supabase/tests/bugfixes.sql.

-- ============================================================================================================
-- S1. Hot-path indexes. Lookups by the SECOND column of a composite key, or by a column without any index:
--   matches.user_b          list_matches / discover / incoming_sparks "user_a = me or user_b = me" (user_a is covered
--                           by the (user_a, user_b) unique key, user_b was a sequential scan)
--   blocks.blocked_id       is_blocked_pair(a, b) checks both directions, the reverse one had no index
--   sparks (from_id, time)  likes_today() and the daily-limit count in send_spark()
--   passes (from_id, time)  undo_last_pass() "order by created_at desc limit 1"
--   reports.reporter_id     report-status (RLS reporter_id = auth.uid(), newest first)
--   appeals.report_id/user  AppealOutcome per report, admin appeal queue joins
--   account_sanctions.user  Gate reads the newest warning on every session; account_restricted() on every action
--   push_tokens.user_id     push fan-out per recipient, sign-out unlink
--   opening_moves.profile   match_context() / opening-moves screen
-- ============================================================================================================
create index if not exists matches_user_b_idx on public.matches (user_b);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id, blocker_id);
create index if not exists sparks_from_created_idx on public.sparks (from_id, created_at desc);
create index if not exists passes_from_created_idx on public.passes (from_id, created_at desc);
create index if not exists reports_reporter_created_idx on public.reports (reporter_id, created_at desc);
create index if not exists appeals_report_idx on public.appeals (report_id);
create index if not exists appeals_user_idx on public.appeals (user_id, created_at desc);
create index if not exists account_sanctions_user_idx on public.account_sanctions (user_id, created_at desc);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
create index if not exists opening_moves_profile_idx on public.opening_moves (profile_id, position);

-- ============================================================================================================
-- S2. incoming_sparks(): the item list took "limit 100" WITHOUT an order, so with more than 100 sparks an arbitrary
-- 100 were returned and the newest could be missing; ordering happened only after the cut. Items now also carry the
-- sender's cover photo and verification, so the likes list no longer calls profile_card() once per row (N+1).
-- Same visibility rules and email check as the current definition (0014 + 0026).
-- ============================================================================================================
create or replace function public.incoming_sparks() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); total int; items jsonb;
begin
  perform public.assert_email_confirmed();
  select count(*) into total from public.sparks s
  where s.to_id = me and public.profile_is_visible(s.from_id) and not public.is_blocked_pair(s.from_id, me)
    and not exists (select 1 from public.passes x where x.from_id = me and x.to_id = s.from_id)
    and not exists (select 1 from public.sparks mine where mine.from_id = me and mine.to_id = s.from_id)
    and not exists (select 1 from public.matches m where m.ended_at is null
                    and ((m.user_a = me and m.user_b = s.from_id) or (m.user_b = me and m.user_a = s.from_id)));
  -- Free for everyone (0029): no plan gate on the list.
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', x.from_id, 'name', x.display_name, 'age', x.age, 'city', x.city,
           'comment', x.comment, 'target_kind', x.target_kind, 'target_ref', x.target_ref,
           'created_at', x.created_at,
           'photo', (select ph.storage_path from public.profile_photos ph
                     where ph.profile_id = x.from_id and ph.kind = 'photo' order by ph.position limit 1),
           'verified', x.verification_status = 'approved') order by x.created_at desc), '[]'::jsonb)
    into items
  from (select s.*, p.display_name, public.profile_age(p.id) as age, p.city, p.verification_status
        from public.sparks s
        join public.profiles p on p.id = s.from_id
        where s.to_id = me and public.profile_is_visible(s.from_id) and not public.is_blocked_pair(s.from_id, me)
          and not exists (select 1 from public.passes x where x.from_id = me and x.to_id = s.from_id)
          and not exists (select 1 from public.sparks mine where mine.from_id = me and mine.to_id = s.from_id)
          and not exists (select 1 from public.matches m where m.ended_at is null
                          and ((m.user_a = me and m.user_b = s.from_id) or (m.user_b = me and m.user_a = s.from_id)))
        order by s.created_at desc
        limit 100) x;
  return jsonb_build_object('count', total, 'items', items);
end $$;

-- ============================================================================================================
-- S3. list_matches(): no ORDER BY (the client sorted, but any other caller got an arbitrary order), the last message
-- was looked up twice per row, and the chat list then called profile_card() once per conversation for the avatar
-- and the verified tick (N+1). Adds partner_photo / partner_verified and orders by last activity. Same filters as
-- the current definition (0002 + 0026: confirmed email, active match, no block).
-- ============================================================================================================
drop function if exists public.list_matches();
create function public.list_matches() returns table (
  match_id uuid, partner_id uuid, partner_name text, partner_age smallint, last_body text, last_at timestamptz,
  unread int, muted boolean, archived boolean, created_at timestamptz, partner_photo text, partner_verified boolean)
language sql stable security definer set search_path = public as $$
  select m.id, p.id, p.display_name, public.profile_age(p.id), lm.body, lm.created_at,
         (select count(*)::int from public.messages x where x.match_id = m.id and x.sender_id <> auth.uid()
            and x.created_at > coalesce((select r.read_at from public.match_reads r where r.match_id = m.id and r.user_id = auth.uid()), 'epoch')),
         coalesce(s.muted, false), coalesce(s.archived, false), m.created_at,
         (select ph.storage_path from public.profile_photos ph where ph.profile_id = p.id and ph.kind = 'photo' order by ph.position limit 1),
         p.verification_status = 'approved'
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  left join public.match_settings s on s.match_id = m.id and s.user_id = auth.uid()
  left join lateral (select x.body, x.created_at from public.messages x
                     where x.match_id = m.id order by x.created_at desc limit 1) lm on true
  where public.my_email_confirmed() and m.ended_at is null and (m.user_a = auth.uid() or m.user_b = auth.uid())
    and not public.is_blocked_pair(m.user_a, m.user_b)
  order by coalesce(lm.created_at, m.created_at) desc, m.id
$$;
revoke all on function public.list_matches() from public, anon;
grant execute on function public.list_matches() to authenticated;

-- ============================================================================================================
-- S4. Prompt answers and opening moves were saved by the client as "delete all, then insert": when the insert failed
-- (network drop, a constraint) every saved answer was gone. One transaction each now; validation matches the tables.
-- ============================================================================================================
create or replace function public.save_prompts(p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 3 then
    raise exception 'prompts: up to 3 answers' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
             where jsonb_typeof(e -> 'question_key') is distinct from 'string'
                or jsonb_typeof(e -> 'answer') is distinct from 'string'
                or char_length(trim(e ->> 'question_key')) not between 1 and 200
                or char_length(trim(e ->> 'answer')) not between 1 and 300) then
    raise exception 'prompts: every answer needs a question and 1..300 characters' using errcode = '22023';
  end if;
  delete from public.profile_prompts where profile_id = me;
  insert into public.profile_prompts (profile_id, question_key, answer, position)
    select me, e ->> 'question_key', trim(e ->> 'answer'), (o - 1)::smallint
    from jsonb_array_elements(p_items) with ordinality as t(e, o);
end $$;

create or replace function public.save_opening_moves(p_texts text[]) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if coalesce(cardinality(p_texts), 0) > 3 then raise exception 'opening moves: up to 3' using errcode = '22023'; end if;
  if exists (select 1 from unnest(coalesce(p_texts, '{}')) v where v is null or char_length(trim(v)) not between 3 and 140) then
    raise exception 'opening moves: 3..140 characters each' using errcode = '22023';
  end if;
  delete from public.opening_moves where profile_id = me;
  insert into public.opening_moves (profile_id, text, position)
    select me, trim(v), (o - 1)::smallint from unnest(coalesce(p_texts, '{}')) with ordinality as t(v, o);
end $$;
revoke all on function public.save_prompts(jsonb), public.save_opening_moves(text[]) from public, anon;
grant execute on function public.save_prompts(jsonb), public.save_opening_moves(text[]) to authenticated;

-- ============================================================================================================
-- S5. send_message() accepted p_body = null together with p_photo_path = null (the empty check only looked at a
-- non-null blank body) and stored an empty message. Patched in the CURRENT definition so other changes are kept.
-- ============================================================================================================
do $$
declare body text := pg_get_functiondef('public.send_message(uuid,uuid,text,text)'::regprocedure);
  old_check constant text := 'if p_body is not null and char_length(trim(p_body)) = 0 and p_photo_path is null then';
begin
  if position(old_check in body) = 0 then
    raise exception '0030: send_message empty-message check not found; review the migration';
  end if;
  execute replace(body, old_check, 'if coalesce(char_length(trim(p_body)), 0) = 0 and p_photo_path is null then');
end $$;

-- ============================================================================================================
-- S6. respond_date() read the row without a lock: accept and decline (two devices, a double tap) or a concurrent
-- cancel could both pass the "still pending" check and the last writer won. The row is now locked first.
-- ============================================================================================================
do $$
declare body text := pg_get_functiondef('public.respond_date(uuid,text)'::regprocedure);
  old_read constant text := 'select * into d from public.dates where id = p_date;';
begin
  if position(old_read in body) = 0 then
    raise exception '0030: respond_date read not found; review the migration';
  end if;
  execute replace(body, old_read, 'select * into d from public.dates where id = p_date for update;');
end $$;

-- ============================================================================================================
-- S7. save_filters(): an empty intents array was stored as-is and discover() then matched nobody ("no one nearby"
-- forever); a null age bound passed the range check (null comparisons) and failed on the NOT NULL column with a raw
-- 23502. Empty / null intents now mean "all", unknown intents are ignored, a missing bound is a clear 22023.
-- ============================================================================================================
create or replace function public.save_filters(p_age_min int, p_age_max int, p_distance int, p_verified boolean, p_intents text[])
returns void language plpgsql security definer set search_path = public as $$
declare all_intents constant text[] := '{serious,casual,friends,unsure}'; picked text[];
begin
  if p_age_min is null or p_age_max is null or p_age_min < 18 or p_age_max > 99 or p_age_min > p_age_max then
    raise exception 'bad age range' using errcode = '22023';
  end if;
  picked := array(select distinct i from unnest(coalesce(p_intents, '{}')) i where i = any (all_intents) order by i);
  if cardinality(picked) = 0 then picked := all_intents; end if;
  update public.profiles set
    filter_age_min = p_age_min, filter_age_max = p_age_max,
    filter_distance_km = greatest(5, least(100, coalesce(p_distance, 100))),
    filter_verified_only = coalesce(p_verified, false), -- free for everyone (0029)
    filter_intents = picked
  where id = auth.uid();
end $$;
