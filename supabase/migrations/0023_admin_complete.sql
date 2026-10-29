-- Web admin, complete: audit log of every admin action, sanction history with lifting, report queue with
-- assignment and resolution notes, appeal decisions with a user-visible reason, verification decisions with a
-- reason, validated config editing, per-country dashboard and admin management (never below one admin).
--
-- Rules for every admin RPC below: security definer, pinned search_path, admin_guard() (is_admin()) first,
-- every write is recorded in public.admin_actions, EXECUTE only for `authenticated` (non-admins get 42501).
-- Paid tiers are never granted from the admin: subscriptions stay owned by the store webhook.

-- ---------- 1. Audit log ----------
create table if not exists public.admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user uuid,            -- no FK: the record outlives a deleted account
  target_id text,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_idx on public.admin_actions (target_user, created_at desc);
create index if not exists admin_actions_action_idx on public.admin_actions (action, created_at desc);
alter table public.admin_actions enable row level security;
create policy admin_actions_read on public.admin_actions for select to authenticated using (public.is_admin());
revoke all on public.admin_actions from public, anon, authenticated;
grant select on public.admin_actions to authenticated;
grant all on public.admin_actions to service_role;

-- ---------- 2. New columns ----------
alter table public.admins add column if not exists added_by uuid references auth.users(id) on delete set null;

alter table public.account_sanctions
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists note text,
  add column if not exists lifted_at timestamptz,
  add column if not exists lifted_by uuid references auth.users(id) on delete set null,
  add column if not exists lift_reason text;

-- Queue state is derived: new = open and unassigned, in review = open and assigned, resolved = actioned/dismissed.
-- (The status values stay as they are: the reporter's status screen relies on them.)
alter table public.reports
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolution_note text;
create index if not exists reports_status_created_idx on public.reports (status, created_at);
create index if not exists reports_target_idx on public.reports (target_profile_id);

alter table public.appeals
  add column if not exists decision_reason text,          -- shown to the user
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references auth.users(id) on delete set null;

alter table public.verification_requests
  add column if not exists decision_reason text,          -- shown to the user
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references auth.users(id) on delete set null;

create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);

-- Users read their own rows, but never internal moderator notes or which admin decided.
revoke select on public.reports from authenticated;
grant select (id, reporter_id, target_profile_id, target_message_id, reason, details, message_snapshot, status, decision,
  created_at, decided_at) on public.reports to authenticated;
revoke select on public.account_sanctions from authenticated;
grant select (id, user_id, kind, reason, until, created_at, lifted_at) on public.account_sanctions to authenticated;
revoke select on public.appeals from authenticated;
grant select (id, report_id, user_id, details, status, created_at, decision_reason, decided_at) on public.appeals to authenticated;
revoke select on public.verification_requests from authenticated;
grant select (id, user_id, storage_path, status, created_at, decision_reason, decided_at) on public.verification_requests to authenticated;

-- Config is written only through admin_config_set() (validated and logged), never directly.
drop policy if exists config_admin on public.app_config;
revoke insert, update, delete, truncate on public.app_config from authenticated;

-- ---------- 3. Internal helpers (not callable by clients) ----------
create or replace function public.admin_guard() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create or replace function public.admin_log(p_action text, p_target_user uuid, p_target_id text, p_reason text,
  p_details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_actions (admin_id, action, target_user, target_id, reason, details)
  values (auth.uid(), p_action, p_target_user, p_target_id, p_reason, coalesce(p_details, '{}'::jsonb))
$$;

create or replace function public.admin_need_reason(p_reason text) returns text
language plpgsql immutable set search_path = public as $$
begin
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'reason required (at least 3 characters)' using errcode = '22023';
  end if;
  if char_length(p_reason) > 1000 then raise exception 'reason too long' using errcode = '22023'; end if;
  return trim(p_reason);
end $$;

create or replace function public.account_status_of(p_until timestamptz) returns text
language sql stable set search_path = public as $$
  select case when p_until is null then 'active'
              when p_until = 'infinity'::timestamptz or extract(year from p_until) > 9000 then 'banned'
              when p_until > now() then 'suspended' else 'active' end
$$;

-- Best available "last activity": last sign-in (Supabase auth), last message, spark, pass or chat read.
create or replace function public.user_last_active(p_user uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    (select (to_jsonb(u) ->> 'last_sign_in_at')::timestamptz from auth.users u where u.id = p_user),
    (select max(m.created_at) from public.messages m where m.sender_id = p_user),
    (select max(s.created_at) from public.sparks s where s.from_id = p_user),
    (select max(x.created_at) from public.passes x where x.from_id = p_user),
    (select max(r.read_at) from public.match_reads r where r.user_id = p_user))
$$;

-- profiles.suspended_until follows the active (not lifted) sanctions: any ban wins, else the latest suspension end.
create or replace function public.admin_recompute_restriction(p_user uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  select case when bool_or(s.kind = 'ban') then 'infinity'::timestamptz else max(s.until) end into v
  from public.account_sanctions s
  where s.user_id = p_user and s.lifted_at is null
    and (s.kind = 'ban' or (s.kind = 'suspension' and s.until > now()));
  update public.profiles set suspended_until = v where id = p_user and suspended_until is distinct from v;
  return v;
end $$;

-- ---------- 4. Dashboard ----------
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.admin_guard(); per jsonb; res jsonb;
begin
  with real_users as (
    select p.* from public.profiles p where not exists (select 1 from public.demo_bots b where b.user_id = p.id)
  ), pu as (
    select country,
      count(*) as users,
      count(*) filter (where onboarding_done) as published,
      count(*) filter (where created_at > now() - interval '7 days') as new_week,
      count(*) filter (where public.user_last_active(id) > now() - interval '24 hours') as active_today,
      count(*) filter (where public.account_status_of(suspended_until) = 'suspended') as suspended,
      count(*) filter (where public.account_status_of(suspended_until) = 'banned') as banned
    from real_users group by country
  ), pr as (
    select t.country, count(*) as n from public.reports r join public.profiles t on t.id = r.target_profile_id
    where r.status = 'open' group by t.country
  ), pa as (
    select p.country, count(*) as n from public.appeals a join public.profiles p on p.id = a.user_id
    where a.status = 'open' group by p.country
  ), pv as (
    select p.country, count(*) as n from public.verification_requests v join public.profiles p on p.id = v.user_id
    where v.status = 'pending' group by p.country
  ), c as (
    select country from pu union select country from pr union select country from pa union select country from pv
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'country', c.country, 'users', coalesce(pu.users, 0), 'published', coalesce(pu.published, 0),
      'new_week', coalesce(pu.new_week, 0), 'active_today', coalesce(pu.active_today, 0),
      'suspended', coalesce(pu.suspended, 0), 'banned', coalesce(pu.banned, 0),
      'reports_open', coalesce(pr.n, 0), 'appeals_open', coalesce(pa.n, 0), 'pending_verifications', coalesce(pv.n, 0))
    order by coalesce(pu.users, 0) desc, c.country), '[]'::jsonb) into per
  from c left join pu on pu.country = c.country left join pr on pr.country = c.country
         left join pa on pa.country = c.country left join pv on pv.country = c.country;

  select jsonb_build_object(
    'countries', per,
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'reports_unassigned', (select count(*) from public.reports where status = 'open' and assigned_to is null),
    'reports_stale', (select count(*) from public.reports where status = 'open' and assigned_to is null
                      and created_at < now() - interval '24 hours'),
    'appeals_open', (select count(*) from public.appeals where status = 'open'),
    'pending_verifications', (select count(*) from public.verification_requests where status = 'pending'),
    'demo_bots', (select count(*) from public.demo_bots),
    'admins', (select count(*) from public.admins),
    'paid_subscribers', (select count(*) from public.subscriptions where tier <> 'free' and not sandbox
                         and (expires_at is null or expires_at > now())),
    'missing_legal_urls', (select coalesce(jsonb_agg(e.key order by e.key), '[]'::jsonb)
                           from public.app_config c, jsonb_each(c.value) e
                           where c.key = 'legal_urls' and jsonb_typeof(c.value) = 'object'
                             and (e.value = 'null'::jsonb or coalesce(e.value #>> '{}', '') = '')),
    'support_email_missing', not exists (select 1 from public.app_config where key = 'support_email'
                                         and jsonb_typeof(value) = 'string' and value #>> '{}' <> '')
  ) into res;
  return res;
end $$;

-- ---------- 5. Users ----------
create or replace function public.admin_user_search(p_query text default null, p_country text default null,
  p_status text default null, p_verification text default null, p_demo boolean default null,
  p_sort text default 'new', p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.admin_guard();
  q text := nullif(trim(coalesce(p_query, '')), '');
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  off int := greatest(coalesce(p_offset, 0), 0);
  res jsonb;
begin
  if p_status is not null and p_status not in ('active','suspended','banned') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  if p_verification is not null and p_verification not in ('none','pending','approved','rejected') then
    raise exception 'bad verification' using errcode = '22023';
  end if;
  if q is not null then q := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  with base as (
    select p.id, u.email, p.display_name, p.age, p.country, p.city, p.verification_status, p.onboarding_done,
      p.suspended_until, public.account_status_of(p.suspended_until) as status,
      coalesce((select s.tier from public.subscriptions s where s.user_id = p.id
                and (s.expires_at is null or s.expires_at > now())), 'free') as tier,
      p.created_at,
      (select count(*) from public.reports r where r.target_profile_id = p.id and r.status = 'open')::int as reports_open,
      (select count(*) from public.reports r where r.target_profile_id = p.id)::int as reports_total,
      exists (select 1 from public.demo_bots b where b.user_id = p.id) as is_demo,
      exists (select 1 from public.admins a where a.user_id = p.id) as is_admin
    from public.profiles p join auth.users u on u.id = p.id
    where (q is null or p.display_name ilike q or u.email ilike q or p.id::text ilike q)
      and (p_country is null or p.country = upper(p_country))
      and (p_verification is null or p.verification_status = p_verification)
  ), filtered as (
    select b.*, public.user_last_active(b.id) as last_active from base b
    where (p_status is null or b.status = p_status) and (p_demo is null or b.is_demo = p_demo)
  ), ordered as (
    select f.*, row_number() over (order by
        case when p_sort = 'reports' then f.reports_open end desc nulls last,
        case when p_sort = 'reports' then f.reports_total end desc nulls last,
        case when p_sort = 'active' then f.last_active end desc nulls last,
        f.created_at desc, f.id) as rn
    from filtered f
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(to_jsonb(o) - 'rn' order by o.rn) from ordered o
                      where o.rn > off and o.rn <= off + lim), '[]'::jsonb)) into res;
  return res;
end $$;

create or replace function public.admin_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.admin_guard(); res jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'email', u.email,
    'last_sign_in_at', to_jsonb(u) ->> 'last_sign_in_at',
    'last_active', public.user_last_active(p.id),
    'status', public.account_status_of(p.suspended_until),
    'is_demo', exists (select 1 from public.demo_bots b where b.user_id = p.id),
    'is_admin', exists (select 1 from public.admins a where a.user_id = p.id),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'storage_path', f.storage_path, 'kind', f.kind,
                 'position', f.position, 'verified', f.verified, 'created_at', f.created_at) order by f.position), '[]'::jsonb)
               from public.profile_photos f where f.profile_id = p.id),
    'prompts', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'question_key', x.question_key, 'answer', x.answer)
                  order by x.position), '[]'::jsonb) from public.profile_prompts x where x.profile_id = p.id),
    'reports_against', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) from (
        select r.id, r.reason, r.details, r.status, r.decision, r.created_at, r.decided_at, r.resolution_note,
               r.message_snapshot, r.reporter_id, rp.display_name as reporter_name
        from public.reports r left join public.profiles rp on rp.id = r.reporter_id
        where r.target_profile_id = p.id order by r.created_at desc limit 100) r),
    'reports_by', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) from (
        select r.id, r.reason, r.details, r.status, r.decision, r.created_at, r.target_profile_id, tp.display_name as target_name
        from public.reports r left join public.profiles tp on tp.id = r.target_profile_id
        where r.reporter_id = p.id order by r.created_at desc limit 100) r),
    'sanctions', (select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb) from (
        select s.id, s.kind, s.reason, s.note, s.until, s.created_at, s.lifted_at, s.lift_reason,
               cu.email as created_by_email, lu.email as lifted_by_email,
               (s.lifted_at is null and (s.kind = 'ban' or (s.kind = 'suspension' and s.until > now()))) as active
        from public.account_sanctions s
        left join auth.users cu on cu.id = s.created_by left join auth.users lu on lu.id = s.lifted_by
        where s.user_id = p.id) s),
    'appeals', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'report_id', a.report_id, 'details', a.details,
                  'status', a.status, 'created_at', a.created_at, 'decision_reason', a.decision_reason, 'decided_at', a.decided_at)
                  order by a.created_at desc), '[]'::jsonb) from public.appeals a where a.user_id = p.id),
    'verification_requests', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'storage_path', v.storage_path,
                  'status', v.status, 'created_at', v.created_at, 'decision_reason', v.decision_reason, 'decided_at', v.decided_at)
                  order by v.created_at desc), '[]'::jsonb) from public.verification_requests v where v.user_id = p.id),
    'subscription', (select jsonb_build_object('tier', s.tier, 'store', s.store, 'expires_at', s.expires_at,
                       'sandbox', s.sandbox, 'updated_at', s.updated_at,
                       'active', s.tier <> 'free' and (s.expires_at is null or s.expires_at > now()))
                     from public.subscriptions s where s.user_id = p.id),
    'stats', jsonb_build_object(
       'matches_active', (select count(*) from public.matches m where (m.user_a = p.id or m.user_b = p.id) and m.ended_at is null),
       'matches_total', (select count(*) from public.matches m where m.user_a = p.id or m.user_b = p.id),
       'sparks_sent', (select count(*) from public.sparks s where s.from_id = p.id),
       'sparks_received', (select count(*) from public.sparks s where s.to_id = p.id),
       'messages_sent', (select count(*) from public.messages x where x.sender_id = p.id),
       'blocked_by', (select count(*) from public.blocks b where b.blocked_id = p.id)),
    'admin_actions', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        select a.id, a.action, a.reason, a.details, a.created_at, au.email as admin_email
        from public.admin_actions a left join auth.users au on au.id = a.admin_id
        where a.target_user = p.id order by a.created_at desc limit 50) x)
  ) into res
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = p_user;
  return res;
end $$;

create or replace function public.admin_sanction_user(p_user uuid, p_kind text, p_reason text, p_days int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := public.admin_need_reason(p_reason); v_until timestamptz; sid uuid; eff timestamptz;
begin
  if p_kind not in ('warning','suspension','ban') then raise exception 'bad kind' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'no such user' using errcode = 'P0002'; end if;
  if p_kind <> 'warning' and exists (select 1 from public.admins where user_id = p_user) then
    raise exception 'cannot restrict an admin (remove admin rights first)' using errcode = '42501';
  end if;
  if p_kind = 'suspension' then
    if p_days is null or p_days < 1 or p_days > 365 then raise exception 'days must be 1..365' using errcode = '22023'; end if;
    v_until := now() + make_interval(days => p_days);
  end if;
  insert into public.account_sanctions (user_id, kind, reason, until, created_by)
    values (p_user, p_kind, why, v_until, me) returning id into sid;
  eff := public.admin_recompute_restriction(p_user);
  perform public.admin_log('user.' || p_kind, p_user, sid::text, why, jsonb_build_object('days', p_days, 'until', v_until));
  return jsonb_build_object('sanction_id', sid, 'suspended_until', eff);
end $$;

-- Lifts one sanction (p_sanction) or every active one; the restriction is recomputed from what remains.
create or replace function public.admin_lift_sanction(p_user uuid, p_reason text, p_sanction uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := public.admin_need_reason(p_reason); n int; eff timestamptz; prev_until timestamptz;
begin
  select suspended_until into prev_until from public.profiles where id = p_user;
  if not found then raise exception 'no such user' using errcode = 'P0002'; end if;
  update public.account_sanctions set lifted_at = now(), lifted_by = me, lift_reason = why
    where user_id = p_user and lifted_at is null and (p_sanction is null or id = p_sanction);
  get diagnostics n = row_count;
  if p_sanction is null then
    -- Lifting everything also clears a restriction set without a sanction record (older data).
    update public.profiles set suspended_until = null where id = p_user and suspended_until is not null;
    eff := null;
  else
    if n = 0 then raise exception 'sanction not found or already lifted' using errcode = 'P0002'; end if;
    eff := public.admin_recompute_restriction(p_user);
  end if;
  perform public.admin_log('user.lift', p_user, p_sanction::text, why,
    jsonb_build_object('lifted', n, 'before', prev_until, 'after', eff));
  return jsonb_build_object('lifted', n, 'suspended_until', eff);
end $$;

-- 'revoked' removes a granted badge (status becomes 'rejected' so the user sees the reason).
create or replace function public.admin_verification_decide(p_user uuid, p_decision text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text; st text; n int;
begin
  if p_decision not in ('approved','rejected','revoked') then raise exception 'bad decision' using errcode = '22023'; end if;
  if p_decision <> 'approved' then why := public.admin_need_reason(p_reason);
  else why := nullif(trim(coalesce(p_reason, '')), ''); end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'no such user' using errcode = 'P0002'; end if;
  st := case when p_decision = 'approved' then 'approved' else 'rejected' end;
  update public.profiles set verification_status = st where id = p_user;
  update public.profile_photos set verified = (st = 'approved') where profile_id = p_user and position = 0;
  update public.verification_requests set status = st, decision_reason = why, decided_at = now(), decided_by = me
    where user_id = p_user and status = 'pending';
  get diagnostics n = row_count;
  if p_decision = 'revoked' then
    update public.verification_requests set decision_reason = why, decided_at = now(), decided_by = me, status = 'rejected'
      where id = (select id from public.verification_requests where user_id = p_user and status = 'approved'
                  order by created_at desc limit 1);
  end if;
  perform public.admin_log('verification.' || case p_decision when 'approved' then 'approve' when 'rejected' then 'reject' else 'revoke' end,
    p_user, null, why, jsonb_build_object('closed_requests', n));
end $$;

-- Only promo/referral time (no store behind it) or an expired/sandbox record can be reset; store subscriptions are
-- managed (cancel/refund) in the store and arrive through the webhook.
create or replace function public.admin_reset_free(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := public.admin_need_reason(p_reason); s public.subscriptions;
begin
  select * into s from public.subscriptions where user_id = p_user for update;
  if not found or s.tier = 'free' then raise exception 'already free' using errcode = '22023'; end if;
  if s.store is not null and not s.sandbox and (s.expires_at is null or s.expires_at > now()) then
    raise exception 'store-managed subscription: cancel or refund it in the store' using errcode = '42501';
  end if;
  update public.subscriptions set tier = 'free', expires_at = null, updated_at = now() where user_id = p_user;
  perform public.admin_log('subscription.reset_free', p_user, null, why,
    jsonb_build_object('tier', s.tier, 'store', s.store, 'expires_at', s.expires_at, 'sandbox', s.sandbox));
end $$;

-- Removes a profile photo record (e.g. after a photo report). The file stays in Storage until cleanup.
create or replace function public.admin_remove_photo(p_photo uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := public.admin_need_reason(p_reason); f public.profile_photos;
begin
  delete from public.profile_photos where id = p_photo returning * into f;
  if not found then raise exception 'photo not found' using errcode = 'P0002'; end if;
  perform public.admin_log('photo.remove', f.profile_id, p_photo::text, why,
    jsonb_build_object('storage_path', f.storage_path, 'position', f.position));
end $$;

-- ---------- 6. Reports ----------
create or replace function public.admin_report_queue(p_state text default 'new', p_reason text default null,
  p_country text default null, p_assigned text default null, p_target uuid default null,
  p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.admin_guard();
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  off int := greatest(coalesce(p_offset, 0), 0);
  res jsonb;
begin
  if p_state is not null and p_state not in ('new','review','open','resolved') then raise exception 'bad state' using errcode = '22023'; end if;
  if p_assigned is not null and p_assigned not in ('me','none','any') then raise exception 'bad assigned' using errcode = '22023'; end if;
  with f as (
    select r.*,
      case when r.status <> 'open' then 'resolved' when r.assigned_to is null then 'new' else 'review' end as state
    from public.reports r left join public.profiles t on t.id = r.target_profile_id
    where (p_reason is null or r.reason = p_reason)
      and (p_country is null or t.country = upper(p_country))
      and (p_target is null or r.target_profile_id = p_target)
      and (p_state is null
           or (p_state = 'new' and r.status = 'open' and r.assigned_to is null)
           or (p_state = 'review' and r.status = 'open' and r.assigned_to is not null)
           or (p_state = 'open' and r.status = 'open')
           or (p_state = 'resolved' and r.status <> 'open'))
      and (p_assigned is null or p_assigned = 'any'
           or (p_assigned = 'me' and r.assigned_to = me) or (p_assigned = 'none' and r.assigned_to is null))
  ), o as (
    select f.*, row_number() over (order by
      case when f.state = 'resolved' then f.decided_at end desc nulls last, f.created_at, f.id) as rn
    from f
  )
  select jsonb_build_object('total', (select count(*) from f), 'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'reason', o.reason, 'details', o.details, 'status', o.status, 'state', o.state, 'decision', o.decision,
      'created_at', o.created_at, 'decided_at', o.decided_at, 'resolution_note', o.resolution_note,
      'assigned_to', o.assigned_to, 'assigned_at', o.assigned_at,
      'assigned_email', (select email from auth.users where id = o.assigned_to),
      'resolved_by_email', (select email from auth.users where id = o.resolved_by),
      'reporter_id', o.reporter_id, 'reporter_name', rp.display_name,
      'target_profile_id', o.target_profile_id, 'target_name', tp.display_name, 'target_country', tp.country,
      'target_status', public.account_status_of(tp.suspended_until),
      'target_reports', (select count(*) from public.reports x where x.target_profile_id = o.target_profile_id),
      'target_message_id', o.target_message_id, 'message_snapshot', o.message_snapshot,
      'message_body', m.body, 'message_photo_path', m.photo_path, 'message_deleted_at', m.deleted_at,
      'message_sender_id', m.sender_id,
      'appeals_open', (select count(*) from public.appeals a where a.report_id = o.id and a.status = 'open')
    ) order by o.rn)
    from o left join public.profiles rp on rp.id = o.reporter_id
           left join public.profiles tp on tp.id = o.target_profile_id
           left join public.messages m on m.id = o.target_message_id
    where o.rn > off and o.rn <= off + lim), '[]'::jsonb)) into res;
  return res;
end $$;

create or replace function public.admin_report_assign(p_report uuid, p_assign boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); prev uuid;
begin
  select assigned_to into prev from public.reports where id = p_report and status = 'open' for update;
  if not found then raise exception 'report not found or already resolved' using errcode = 'P0002'; end if;
  update public.reports set assigned_to = case when p_assign then me end, assigned_at = case when p_assign then now() end
    where id = p_report;
  perform public.admin_log(case when p_assign then 'report.assign' else 'report.unassign' end,
    (select target_profile_id from public.reports where id = p_report), p_report::text, null,
    jsonb_build_object('previous', prev));
end $$;

-- Outcome: dismissed (no violation) | actioned (measures without an account sanction, e.g. message removed)
-- | warning | suspension (p_days) | ban. The sanction reason stays
-- 'report <id>' so the user's appeal is attached to this report; the moderator note is kept separately.
create or replace function public.admin_report_resolve(p_report uuid, p_outcome text, p_note text,
  p_days int default null, p_remove_message boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := public.admin_need_reason(p_note); r public.reports;
  v_until timestamptz; sid uuid; eff timestamptz; removed int := 0;
begin
  if p_outcome not in ('dismissed','actioned','warning','suspension','ban') then raise exception 'bad outcome' using errcode = '22023'; end if;
  select * into r from public.reports where id = p_report for update;
  if not found then raise exception 'no such report' using errcode = 'P0002'; end if;
  if r.status <> 'open' then raise exception 'report already resolved' using errcode = '22023'; end if;
  if p_outcome in ('warning','suspension','ban') then
    if r.target_profile_id is null then raise exception 'reported profile no longer exists' using errcode = '22023'; end if;
    if p_outcome <> 'warning' and exists (select 1 from public.admins where user_id = r.target_profile_id) then
      raise exception 'cannot restrict an admin (remove admin rights first)' using errcode = '42501';
    end if;
  end if;
  if p_outcome = 'suspension' then
    if p_days is null or p_days < 1 or p_days > 365 then raise exception 'days must be 1..365' using errcode = '22023'; end if;
    v_until := now() + make_interval(days => p_days);
  end if;
  update public.reports set
    status = case when p_outcome = 'dismissed' then 'dismissed' else 'actioned' end,
    decision = case when p_outcome in ('dismissed','actioned') then null else p_outcome end,
    decided_at = now(), resolved_by = me, resolution_note = why,
    assigned_to = coalesce(assigned_to, me), assigned_at = coalesce(assigned_at, now())
  where id = p_report;
  if p_outcome in ('warning','suspension','ban') then
    insert into public.account_sanctions (user_id, kind, reason, until, created_by, note)
      values (r.target_profile_id, p_outcome, 'report ' || r.id, v_until, me, why) returning id into sid;
    eff := public.admin_recompute_restriction(r.target_profile_id);
  end if;
  if p_remove_message and r.target_message_id is not null then
    update public.messages set deleted_at = now() where id = r.target_message_id and deleted_at is null;
    get diagnostics removed = row_count;
  end if;
  perform public.admin_log('report.resolve', r.target_profile_id, p_report::text, why,
    jsonb_build_object('outcome', p_outcome, 'days', p_days, 'sanction_id', sid, 'message_removed', removed > 0));
  return jsonb_build_object('sanction_id', sid, 'suspended_until', eff, 'message_removed', removed > 0);
end $$;

-- ---------- 7. Appeals ----------
create or replace function public.admin_appeal_queue(p_status text default 'open', p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.admin_guard();
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  off int := greatest(coalesce(p_offset, 0), 0);
  res jsonb;
begin
  if p_status is not null and p_status not in ('open','accepted','rejected') then raise exception 'bad status' using errcode = '22023'; end if;
  with f as (
    select a.*, row_number() over (order by case when a.status = 'open' then a.created_at end, a.decided_at desc nulls last, a.id) as rn
    from public.appeals a where p_status is null or a.status = p_status
  )
  select jsonb_build_object('total', (select count(*) from f), 'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'details', f.details, 'status', f.status, 'created_at', f.created_at,
      'decision_reason', f.decision_reason, 'decided_at', f.decided_at,
      'decided_by_email', (select email from auth.users where id = f.decided_by),
      'user_id', f.user_id, 'user_name', p.display_name, 'user_email', u.email,
      'user_status', public.account_status_of(p.suspended_until), 'user_suspended_until', p.suspended_until,
      'role', case when r.target_profile_id = f.user_id then 'target' else 'reporter' end,
      'report', jsonb_build_object('id', r.id, 'reason', r.reason, 'details', r.details, 'status', r.status,
                 'decision', r.decision, 'resolution_note', r.resolution_note, 'message_snapshot', r.message_snapshot,
                 'created_at', r.created_at, 'decided_at', r.decided_at),
      'active_sanctions', (select count(*) from public.account_sanctions s where s.user_id = f.user_id
                           and s.reason = 'report ' || r.id and s.lifted_at is null and s.kind in ('suspension','ban'))
    ) order by f.rn)
    from f join public.profiles p on p.id = f.user_id join auth.users u on u.id = f.user_id
         join public.reports r on r.id = f.report_id
    where f.rn > off and f.rn <= off + lim), '[]'::jsonb)) into res;
  return res;
end $$;

-- Accept: the sanctions from that report are lifted (restriction recomputed); an appeal by the reporter against a
-- dismissal re-opens the report. Reject: everything stays. The reason is visible to the user.
create or replace function public.admin_appeal_decide(p_appeal uuid, p_accept boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := public.admin_need_reason(p_reason); a public.appeals; r public.reports;
  n int := 0; eff timestamptz; reopened boolean := false;
begin
  if p_accept is null then raise exception 'decision required' using errcode = '22023'; end if;
  select * into a from public.appeals where id = p_appeal for update;
  if not found then raise exception 'no such appeal' using errcode = 'P0002'; end if;
  if a.status <> 'open' then raise exception 'appeal already decided' using errcode = '22023'; end if;
  select * into r from public.reports where id = a.report_id;
  update public.appeals set status = case when p_accept then 'accepted' else 'rejected' end,
    decision_reason = why, decided_at = now(), decided_by = me where id = p_appeal;
  select suspended_until into eff from public.profiles where id = a.user_id;
  if p_accept then
    if r.target_profile_id = a.user_id then
      update public.account_sanctions set lifted_at = now(), lifted_by = me, lift_reason = 'appeal: ' || why
        where user_id = a.user_id and reason = 'report ' || r.id and lifted_at is null;
      get diagnostics n = row_count;
      eff := public.admin_recompute_restriction(a.user_id);
    elsif r.status <> 'open' then
      update public.reports set status = 'open', decision = null, decided_at = null, resolved_by = null,
        assigned_to = null, assigned_at = null where id = r.id;
      reopened := true;
    end if;
  end if;
  perform public.admin_log(case when p_accept then 'appeal.accept' else 'appeal.reject' end, a.user_id, p_appeal::text, why,
    jsonb_build_object('report_id', r.id, 'lifted', n, 'suspended_until', eff, 'report_reopened', reopened));
  return jsonb_build_object('lifted', n, 'suspended_until', eff, 'report_reopened', reopened);
end $$;

-- ---------- 8. Verification queue ----------
create or replace function public.admin_verification_queue(p_status text default 'pending', p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.admin_guard();
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  off int := greatest(coalesce(p_offset, 0), 0);
  res jsonb;
begin
  if p_status is not null and p_status not in ('pending','approved','rejected') then raise exception 'bad status' using errcode = '22023'; end if;
  with f as (
    select v.*, row_number() over (order by case when v.status = 'pending' then v.created_at end, v.decided_at desc nulls last, v.id) as rn
    from public.verification_requests v where p_status is null or v.status = p_status
  )
  select jsonb_build_object('total', (select count(*) from f), 'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'user_id', f.user_id, 'storage_path', f.storage_path, 'status', f.status, 'created_at', f.created_at,
      'decision_reason', f.decision_reason, 'decided_at', f.decided_at,
      'name', p.display_name, 'age', p.age, 'country', p.country, 'city', p.city, 'verification_status', p.verification_status,
      'previous_requests', (select count(*) from public.verification_requests x where x.user_id = f.user_id and x.id <> f.id),
      'photos', (select coalesce(jsonb_agg(ph.storage_path order by ph.position), '[]'::jsonb)
                 from public.profile_photos ph where ph.profile_id = f.user_id and ph.kind = 'photo')
    ) order by f.rn)
    from f left join public.profiles p on p.id = f.user_id
    where f.rn > off and f.rn <= off + lim), '[]'::jsonb)) into res;
  return res;
end $$;

-- ---------- 9. Config (validated) ----------
create or replace function public.admin_cfg_int(p_value jsonb, p_path text, p_lo int, p_hi int) returns void
language plpgsql immutable set search_path = public as $$
declare v jsonb := p_value -> p_path;
begin
  if v is null or jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric)
     or (v #>> '{}')::numeric < p_lo or (v #>> '{}')::numeric > p_hi then
    raise exception 'invalid config: % must be a whole number %..%', p_path, p_lo, p_hi using errcode = '22023';
  end if;
end $$;

create or replace function public.admin_config_validate(p_key text, p_value jsonb) returns void
language plpgsql stable set search_path = public as $$
declare e record; t record; existing jsonb;
begin
  if p_value is null then raise exception 'invalid config: value required' using errcode = '22023'; end if;
  case p_key
  when 'prices_preliminary' then
    raise exception 'prices_preliminary is read-only: real prices are set in App Store Connect / Google Play' using errcode = '42501';
  when 'tier_limits' then
    if jsonb_typeof(p_value) <> 'object' or not (p_value ?& array['free','plus','premium']) then
      raise exception 'invalid config: tier_limits needs free, plus and premium' using errcode = '22023';
    end if;
    for t in select key, value from jsonb_each(p_value) loop
      if t.key not in ('free','plus','premium') or jsonb_typeof(t.value) <> 'object' then
        raise exception 'invalid config: tier_limits.% is not a tier object', t.key using errcode = '22023';
      end if;
      perform public.admin_cfg_int(t.value, 'daily_likes', 0, 100000);
      for e in select key, value from jsonb_each(t.value) where key <> 'daily_likes' loop
        if jsonb_typeof(e.value) not in ('boolean','number') then
          raise exception 'invalid config: tier_limits.%.% must be true/false or a number', t.key, e.key using errcode = '22023';
        end if;
      end loop;
    end loop;
  when 'banned_words' then
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 5000 then
      raise exception 'invalid config: banned_words must be a list (max 5000)' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(p_value) w
               where jsonb_typeof(w) <> 'string' or char_length(trim(w #>> '{}')) not between 2 and 64) then
      raise exception 'invalid config: every banned word must be 2..64 characters' using errcode = '22023';
    end if;
  when 'legal_urls' then
    if jsonb_typeof(p_value) <> 'object' then raise exception 'invalid config: legal_urls must be an object' using errcode = '22023'; end if;
    for e in select key, value from jsonb_each(p_value) loop
      if e.key not in ('privacy','terms','community','subscriptions','moderation') then
        raise exception 'invalid config: unknown legal document %', e.key using errcode = '22023';
      end if;
      if e.value <> 'null'::jsonb and (jsonb_typeof(e.value) <> 'string'
          or (e.value #>> '{}') !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]+)?(/[^\s]*)?$'
          or char_length(e.value #>> '{}') > 500) then
        raise exception 'invalid config: legal_urls.% must be an https:// link', e.key using errcode = '22023';
      end if;
    end loop;
  when 'support_email' then
    if p_value <> 'null'::jsonb and (jsonb_typeof(p_value) <> 'string'
        or (p_value #>> '{}') !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') then
      raise exception 'invalid config: support_email must be an e-mail address' using errcode = '22023';
    end if;
  when 'referral' then
    if jsonb_typeof(p_value) <> 'object' then raise exception 'invalid config: referral must be an object' using errcode = '22023'; end if;
    perform public.admin_cfg_int(p_value, 'goal', 1, 1000);
    perform public.admin_cfg_int(p_value, 'reward_days', 1, 365);
  when 'rate_limits' then
    if jsonb_typeof(p_value) <> 'object' then raise exception 'invalid config: rate_limits must be an object' using errcode = '22023'; end if;
    for e in select key from jsonb_each(p_value) loop
      perform public.admin_cfg_int(p_value, e.key, 1, 100000);
    end loop;
  when 'digest' then
    if jsonb_typeof(p_value) <> 'object' or jsonb_typeof(p_value -> 'enabled') is distinct from 'boolean' then
      raise exception 'invalid config: digest.enabled must be true/false' using errcode = '22023';
    end if;
    perform public.admin_cfg_int(p_value, 'weekday', 0, 6);
    perform public.admin_cfg_int(p_value, 'hour_utc', 0, 23);
  when 'demo_bots' then
    if jsonb_typeof(p_value) <> 'object' then raise exception 'invalid config: demo_bots must be an object' using errcode = '22023'; end if;
    perform public.admin_cfg_int(p_value, 'match_every', 1, 100);
    perform public.admin_cfg_int(p_value, 'welcome_sparks', 0, 20);
  when 'launch_countries', 'countries' then
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0
       or exists (select 1 from jsonb_array_elements(p_value) c where jsonb_typeof(c) <> 'string' or (c #>> '{}') !~ '^[A-Z]{2}$') then
      raise exception 'invalid config: % must be a non-empty list of 2-letter country codes', p_key using errcode = '22023';
    end if;
    if p_key = 'launch_countries' and exists (
        select 1 from jsonb_array_elements_text(p_value) c
        where not exists (select 1 from public.app_config k, jsonb_array_elements_text(k.value) a where k.key = 'countries' and a = c)) then
      raise exception 'invalid config: launch country is not in countries' using errcode = '22023';
    end if;
  else
    -- Keys added by later features (video, voice, ...): only existing keys, same JSON type as before.
    select value into existing from public.app_config where key = p_key;
    if not found then raise exception 'invalid config: unknown key %', p_key using errcode = '22023'; end if;
    if jsonb_typeof(existing) <> jsonb_typeof(p_value) and existing <> 'null'::jsonb then
      raise exception 'invalid config: % must stay a JSON %', p_key, jsonb_typeof(existing) using errcode = '22023';
    end if;
  end case;
end $$;

create or replace function public.admin_config_set(p_key text, p_value jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); old_value jsonb;
begin
  perform public.admin_config_validate(p_key, p_value);
  select value into old_value from public.app_config where key = p_key for update;
  if old_value is not distinct from p_value then return p_value; end if;
  insert into public.app_config (key, value) values (p_key, p_value)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.admin_log('config.set', null, p_key, nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object('key', p_key, 'old', old_value, 'new', p_value));
  return p_value;
end $$;

-- ---------- 10. Audit log and admins ----------
create or replace function public.admin_audit_log(p_action text default null, p_admin uuid default null,
  p_target uuid default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.admin_guard();
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  off int := greatest(coalesce(p_offset, 0), 0);
  res jsonb;
begin
  with f as (
    select a.* from public.admin_actions a
    where (p_action is null or a.action like p_action || '%')
      and (p_admin is null or a.admin_id = p_admin)
      and (p_target is null or a.target_user = p_target)
  )
  select jsonb_build_object('total', (select count(*) from f), 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'created_at', x.created_at, 'action', x.action, 'admin_id', x.admin_id,
      'admin_email', au.email, 'target_user', x.target_user, 'target_name', tp.display_name, 'target_email', tu.email,
      'target_id', x.target_id, 'reason', x.reason, 'details', x.details) order by x.created_at desc, x.id desc)
    from (select * from f order by created_at desc, id desc limit lim offset off) x
    left join auth.users au on au.id = x.admin_id
    left join auth.users tu on tu.id = x.target_user
    left join public.profiles tp on tp.id = x.target_user), '[]'::jsonb)) into res;
  return res;
end $$;

create or replace function public.admin_list_admins() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.admin_guard();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email, 'name', p.display_name,
    'created_at', a.created_at, 'added_by_email', ab.email, 'is_me', a.user_id = me) order by a.created_at), '[]'::jsonb)
    from public.admins a join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id left join auth.users ab on ab.id = a.added_by);
end $$;

create or replace function public.admin_add_admin(p_email text, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := public.admin_need_reason(p_reason); uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(coalesce(p_email, ''))) limit 1;
  if uid is null then raise exception 'no account with this e-mail (the person must sign up first)' using errcode = 'P0002'; end if;
  if exists (select 1 from public.admins where user_id = uid) then raise exception 'already an admin' using errcode = '23505'; end if;
  if exists (select 1 from public.demo_bots where user_id = uid) then raise exception 'demo bots cannot be admins' using errcode = '42501'; end if;
  insert into public.admins (user_id, added_by) values (uid, me);
  perform public.admin_log('admin.add', uid, null, why, jsonb_build_object('email', lower(trim(p_email))));
  return uid;
end $$;

create or replace function public.admin_remove_admin(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := public.admin_need_reason(p_reason);
begin
  lock table public.admins in share row exclusive mode;
  if not exists (select 1 from public.admins where user_id = p_user) then raise exception 'not an admin' using errcode = 'P0002'; end if;
  if (select count(*) from public.admins) <= 1 then raise exception 'cannot remove the last admin' using errcode = '42501'; end if;
  delete from public.admins where user_id = p_user;
  perform public.admin_log('admin.remove', p_user, null, why, jsonb_build_object('self', p_user = me));
end $$;

-- Safety net for any other path (SQL editor, account deletion cascade): never leave the project without an admin.
create or replace function public.admins_keep_one() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from old_rows) and not exists (select 1 from public.admins) then
    raise exception 'cannot remove the last admin' using errcode = '42501';
  end if;
  return null;
end $$;
drop trigger if exists admins_keep_one on public.admins;
create trigger admins_keep_one after delete on public.admins referencing old table as old_rows
  for each statement execute function public.admins_keep_one();

-- ---------- 11. Older admin RPCs: same signatures, now validated and logged ----------
create or replace function public.admin_set_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  perform public.admin_config_set(p_key, p_value, null);
end $$;

create or replace function public.admin_sanction(p_user uuid, p_kind text, p_reason text, p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'admin'); sid uuid;
begin
  if p_kind not in ('warning','suspension','ban','lift') then raise exception 'bad kind' using errcode = '22023'; end if;
  if char_length(why) < 3 then why := why || ' (admin)'; end if;
  if p_kind = 'lift' then perform public.admin_lift_sanction(p_user, why, null); return; end if;
  if p_kind <> 'warning' and exists (select 1 from public.admins where user_id = p_user) then
    raise exception 'cannot restrict an admin (remove admin rights first)' using errcode = '42501';
  end if;
  insert into public.account_sanctions (user_id, kind, reason, until, created_by)
    values (p_user, p_kind, why, case when p_kind = 'suspension' then p_until end, me) returning id into sid;
  perform public.admin_recompute_restriction(p_user);
  perform public.admin_log('user.' || p_kind, p_user, sid::text, why, jsonb_build_object('until', p_until));
end $$;

create or replace function public.admin_set_verification(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  if p_status not in ('approved','rejected','pending') then raise exception 'bad status' using errcode = '22023'; end if;
  if p_status = 'pending' then
    update public.profiles set verification_status = 'pending' where id = p_user;
    perform public.admin_log('verification.reset_pending', p_user, null, null, '{}'::jsonb);
  elsif p_status = 'approved' then
    perform public.admin_verification_decide(p_user, 'approved', null);
  else
    perform public.admin_verification_decide(p_user, 'rejected', 'rejected by moderator');
  end if;
end $$;

create or replace function public.admin_decide_report(p_report uuid, p_decision text, p_sanction text, p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare d int;
begin
  perform public.admin_guard();
  if p_decision not in ('actioned','dismissed') then raise exception 'bad decision' using errcode = '22023'; end if;
  if p_decision = 'dismissed' then
    perform public.admin_report_resolve(p_report, 'dismissed', 'no violation found', null, false);
  elsif p_sanction is null or p_sanction not in ('warning','suspension','ban') then
    perform public.admin_report_resolve(p_report, 'actioned', 'decided from the report list', null, false);
  else
    d := case when p_sanction = 'suspension' then greatest(1, ceil(extract(epoch from (p_until - now())) / 86400)::int) end;
    perform public.admin_report_resolve(p_report, p_sanction, 'decided from the report list', d, false);
  end if;
end $$;

create or replace function public.admin_decide_appeal(p_appeal uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  perform public.admin_appeal_decide(p_appeal, p_accept,
    case when p_accept then 'appeal accepted' else 'appeal rejected' end);
end $$;

create or replace function public.admin_decide_referral(p_invited uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); owner uuid; days int; n int;
begin
  update public.referral_signups set status = case when p_approve then 'rewarded' else 'rejected' end
    where invited_user = p_invited and status = 'verified';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'referral is not awaiting a decision' using errcode = '22023'; end if;
  select r.user_id into owner from public.referral_signups s join public.referral_codes r on r.code = s.code where s.invited_user = p_invited;
  if p_approve then
    select (value->>'reward_days')::int into days from public.app_config where key = 'referral';
    insert into public.subscriptions (user_id, tier, expires_at) values (owner, 'plus', now() + make_interval(days => coalesce(days, 7)))
      on conflict (user_id) do update set
        tier = case when public.subscriptions.tier = 'premium' then 'premium' else 'plus' end,
        expires_at = greatest(coalesce(public.subscriptions.expires_at, now()), now()) + make_interval(days => coalesce(days, 7)),
        updated_at = now()
      where public.subscriptions.store is null or public.subscriptions.tier = 'free';
  end if;
  perform public.admin_log(case when p_approve then 'referral.reward' else 'referral.reject' end, owner, p_invited::text, null,
    jsonb_build_object('invited_user', p_invited, 'reward_days', days));
end $$;

-- ---------- 12. Privileges ----------
revoke all on function public.admin_guard(), public.admin_log(text, uuid, text, text, jsonb), public.admin_need_reason(text),
  public.user_last_active(uuid), public.admin_recompute_restriction(uuid),
  public.admin_cfg_int(jsonb, text, int, int), public.admin_config_validate(text, jsonb), public.admins_keep_one()
  from public, anon, authenticated;

revoke all on function
  public.admin_dashboard(), public.admin_user_search(text, text, text, text, boolean, text, int, int),
  public.admin_user_detail(uuid), public.admin_sanction_user(uuid, text, text, int), public.admin_lift_sanction(uuid, text, uuid),
  public.admin_verification_decide(uuid, text, text), public.admin_reset_free(uuid, text), public.admin_remove_photo(uuid, text),
  public.admin_report_queue(text, text, text, text, uuid, int, int), public.admin_report_assign(uuid, boolean),
  public.admin_report_resolve(uuid, text, text, int, boolean), public.admin_appeal_queue(text, int, int),
  public.admin_appeal_decide(uuid, boolean, text), public.admin_verification_queue(text, int, int),
  public.admin_config_set(text, jsonb, text), public.admin_audit_log(text, uuid, uuid, int, int),
  public.admin_list_admins(), public.admin_add_admin(text, text), public.admin_remove_admin(uuid, text),
  public.admin_set_config(text, jsonb), public.admin_sanction(uuid, text, text, timestamptz),
  public.admin_set_verification(uuid, text), public.admin_decide_report(uuid, text, text, timestamptz),
  public.admin_decide_appeal(uuid, boolean), public.admin_decide_referral(uuid, boolean)
  from public, anon;

grant execute on function
  public.admin_dashboard(), public.admin_user_search(text, text, text, text, boolean, text, int, int),
  public.admin_user_detail(uuid), public.admin_sanction_user(uuid, text, text, int), public.admin_lift_sanction(uuid, text, uuid),
  public.admin_verification_decide(uuid, text, text), public.admin_reset_free(uuid, text), public.admin_remove_photo(uuid, text),
  public.admin_report_queue(text, text, text, text, uuid, int, int), public.admin_report_assign(uuid, boolean),
  public.admin_report_resolve(uuid, text, text, int, boolean), public.admin_appeal_queue(text, int, int),
  public.admin_appeal_decide(uuid, boolean, text), public.admin_verification_queue(text, int, int),
  public.admin_config_set(text, jsonb, text), public.admin_audit_log(text, uuid, uuid, int, int),
  public.admin_list_admins(), public.admin_add_admin(text, text), public.admin_remove_admin(uuid, text),
  public.admin_set_config(text, jsonb), public.admin_sanction(uuid, text, text, timestamptz),
  public.admin_set_verification(uuid, text), public.admin_decide_report(uuid, text, text, timestamptz),
  public.admin_decide_appeal(uuid, boolean), public.admin_decide_referral(uuid, boolean)
  to authenticated;
-- Pure helper (status label from a timestamp), harmless for clients.
revoke all on function public.account_status_of(timestamptz) from public, anon;
grant execute on function public.account_status_of(timestamptz) to authenticated;
grant execute on all functions in schema public to service_role;
