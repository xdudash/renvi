-- RENVI ships free: no Plus/Premium, no in-app purchases, no RevenueCat (founder decision, docs/RELEASE_4_NO_SUBSCRIPTIONS.md).
--
-- 1. Every former paid feature is open to everyone: the full incoming-sparks list (who sparked you), undo of the
--    last pass, incognito and the verified-only filter. The server tier checks are removed from the RPCs and guards.
-- 2. One anti-abuse limit stays: app_config.daily_spark_limit (default 100 sparks per user per UTC day), the same
--    for everyone, enforced by send_spark() (error 'daily limit', SQLSTATE P0003) and editable from the admin panel.
-- 3. public.subscriptions, public.billing_events, billing_commit(), guard_subscription_write(), my_tier(),
--    tier_flag(), daily_like_limit() and admin_reset_free() are dropped; tier_limits / prices_preliminary config keys
--    are deleted; referral approval no longer grants promo days; admin/analytics/export lose the subscription data.
--
-- Bodies of large functions that earlier migrations already rewrote in place (0026 patches them through
-- pg_get_functiondef) are edited the same way here; every edit must match exactly once or the migration fails.

-- ============================================================================================================
-- 1. Configuration: one neutral spark limit instead of per-tier limits and prices.
-- ============================================================================================================
insert into public.app_config (key, value) values ('daily_spark_limit', '100') on conflict (key) do nothing;
delete from public.app_config where key in ('tier_limits', 'prices_preliminary');
update public.app_config set value = value - 'subscriptions', updated_at = now() where key = 'legal_urls' and value ? 'subscriptions';
update public.app_config set value = value - 'reward_days', updated_at = now() where key = 'referral' and value ? 'reward_days';

-- Anti-abuse limit, the same for every account. A missing or malformed value falls back to 100, never to "no limit".
create or replace function public.daily_spark_limit() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (c.value #>> '{}')::numeric::int from public.app_config c
    where c.key = 'daily_spark_limit' and jsonb_typeof(c.value) = 'number' and (c.value #>> '{}')::numeric >= 1), 100)
$$;
revoke all on function public.daily_spark_limit() from public, anon;
grant execute on function public.daily_spark_limit() to authenticated;

-- ============================================================================================================
-- 2. RPCs: no tier checks.
-- ============================================================================================================
create or replace function public.send_spark(p_to uuid, p_kind text, p_ref uuid, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid; a uuid; b uuid; prev_end timestamptz;
begin
  perform public.assert_account_active();
  if p_kind not in ('profile','photo','prompt') then raise exception 'bad target' using errcode = '22023'; end if;
  if not public.profile_is_visible(p_to) or public.is_blocked_pair(me, p_to) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  if (select count(*) from public.sparks where from_id = me and created_at >= date_trunc('day', now())) >= public.daily_spark_limit() then
    raise exception 'daily limit' using errcode = 'P0003';
  end if;
  a := least(me, p_to); b := greatest(me, p_to);
  perform pg_advisory_xact_lock(hashtextextended('match-pair:' || a::text || ':' || b::text, 0));
  select ended_at into prev_end from public.matches where user_a = a and user_b = b;
  insert into public.sparks (from_id, to_id, target_kind, target_ref, comment, created_at)
    values (me, p_to, p_kind, p_ref, public.filter_words(nullif(trim(p_comment), '')), clock_timestamp())
    on conflict (from_id, to_id) do update
      set target_kind = excluded.target_kind, target_ref = excluded.target_ref,
          comment = excluded.comment, created_at = clock_timestamp()
      where prev_end is not null and public.sparks.created_at <= prev_end;
  if not exists (select 1 from public.sparks
                 where from_id = p_to and to_id = me and (prev_end is null or created_at > prev_end)) then
    return jsonb_build_object('status', 'sent');
  end if;
  insert into public.matches (user_a, user_b) values (a, b)
    on conflict (user_a, user_b) do update set ended_at = null, ended_by = null
    returning id into mid;
  return jsonb_build_object('status', 'match', 'match_id', mid);
end $$;

-- Everyone sees who sparked them (same visibility, block, pass and match rules as before; at most 100 rows).
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
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', x.from_id, 'name', x.display_name, 'age', x.age, 'city', x.city,
           'comment', x.comment, 'target_kind', x.target_kind, 'target_ref', x.target_ref,
           'created_at', x.created_at) order by x.created_at desc), '[]'::jsonb)
    into items
  from (select s.*, p.display_name, public.profile_age(p.id) as age, p.city from public.sparks s
        join public.profiles p on p.id = s.from_id
        where s.to_id = me and public.profile_is_visible(s.from_id) and not public.is_blocked_pair(s.from_id, me)
          and not exists (select 1 from public.passes x where x.from_id = me and x.to_id = s.from_id)
          and not exists (select 1 from public.sparks mine where mine.from_id = me and mine.to_id = s.from_id)
          and not exists (select 1 from public.matches m where m.ended_at is null
                          and ((m.user_a = me and m.user_b = s.from_id) or (m.user_b = me and m.user_a = s.from_id)))
        limit 100) x;
  return jsonb_build_object('count', total, 'items', items);
end $$;

create or replace function public.undo_last_pass() returns uuid
language plpgsql security definer set search_path = public as $$
declare last_to uuid;
begin
  perform public.assert_account_active();
  select to_id into last_to from public.passes where from_id = auth.uid() order by created_at desc limit 1;
  if last_to is null then return null; end if;
  delete from public.passes where from_id = auth.uid() and to_id = last_to;
  return last_to;
end $$;

create or replace function public.save_filters(p_age_min int, p_age_max int, p_distance int, p_verified boolean, p_intents text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_age_min < 18 or p_age_max > 99 or p_age_min > p_age_max then raise exception 'bad age range' using errcode = '22023'; end if;
  update public.profiles set
    filter_age_min = p_age_min, filter_age_max = p_age_max,
    filter_distance_km = greatest(5, least(100, p_distance)),
    filter_verified_only = coalesce(p_verified, false),
    filter_intents = coalesce(p_intents, '{serious,casual,friends,unsure}')
  where id = auth.uid();
end $$;

-- Incognito and verified-only are ordinary own settings now; the other protected fields stay server-only.
create or replace function public.guard_profile_update() returns trigger language plpgsql as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') or public.is_admin() then
    return new;
  end if;
  if new.blocked_until is distinct from old.blocked_until
     or new.suspended_until is distinct from old.suspended_until
     or new.verification_status is distinct from old.verification_status
     or new.onboarding_done is distinct from old.onboarding_done
     or new.terms_accepted_at is distinct from old.terms_accepted_at
     or new.adult_confirmed_at is distinct from old.adult_confirmed_at
     or new.sensitive_consent_at is distinct from old.sensitive_consent_at
     or new.age is distinct from old.age then
    raise exception 'protected field' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.guard_profile_insert() returns trigger language plpgsql as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') or public.is_admin() then
    return new;
  end if;
  if new.blocked_until is not null or new.suspended_until is not null
     or new.verification_status <> 'none' or new.onboarding_done
     or new.terms_accepted_at is not null or new.adult_confirmed_at is not null
     or new.sensitive_consent_at is not null or new.age is not null then
    raise exception 'protected field' using errcode = '42501';
  end if;
  return new;
end $$;

-- Referrals stay (invites, progress, admin review). Approval only marks the invite counted: no promo days.
create or replace function public.admin_decide_referral(p_invited uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); owner uuid; n int;
begin
  update public.referral_signups set status = case when p_approve then 'rewarded' else 'rejected' end
    where invited_user = p_invited and status = 'verified';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'referral is not awaiting a decision' using errcode = '22023'; end if;
  select r.user_id into owner from public.referral_signups s join public.referral_codes r on r.code = s.code where s.invited_user = p_invited;
  perform public.admin_log(case when p_approve then 'referral.approve' else 'referral.reject' end, owner, p_invited::text, null,
    jsonb_build_object('invited_user', p_invited));
end $$;

-- Config validation: tier_limits / prices_preliminary are gone (unknown keys are refused by the else branch);
-- daily_spark_limit is a whole number 1..100000; legal_urls has no "subscriptions" document; referral has only a goal.
create or replace function public.admin_config_validate(p_key text, p_value jsonb) returns void
language plpgsql stable set search_path = public as $$
declare e record; existing jsonb;
begin
  if p_value is null then raise exception 'invalid config: value required' using errcode = '22023'; end if;
  case p_key
  when 'daily_spark_limit' then
    perform public.admin_cfg_int(jsonb_build_object('daily_spark_limit', p_value), 'daily_spark_limit', 1, 100000);
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
      if e.key not in ('privacy','terms','community','moderation') then
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
    if exists (select 1 from jsonb_object_keys(p_value) k where k <> 'goal') then
      raise exception 'invalid config: referral has only "goal" (no rewards)' using errcode = '22023';
    end if;
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

-- ============================================================================================================
-- 3. In-place edits of large functions (admin dashboard/search/detail, analytics, export, onboarding).
-- ============================================================================================================
do $migr$
declare
  edits text[][] := array[
    ['public.save_onboarding(jsonb)',
     $r$incognito = case when public.tier_flag('incognito') then coalesce((p_patch->>'incognito')::boolean, incognito) else incognito end$r$,
     $r$incognito = coalesce((p_patch->>'incognito')::boolean, incognito)$r$],
    ['public.admin_dashboard()',
     $r$    'paid_subscribers', (select count(*) from public.subscriptions where tier <> 'free' and not sandbox
                         and (expires_at is null or expires_at > now())),
$r$, ''],
    ['public.admin_stats(text)',
     $r$    'paid_subscribers', (select count(*) from public.subscriptions where tier <> 'free' and not sandbox
                         and (expires_at is null or expires_at > now())),
$r$, ''],
    ['public.admin_user_search(text,text,text,text,boolean,text,integer,integer)',
     $r$      coalesce((select s.tier from public.subscriptions s where s.user_id = p.id
                and (s.expires_at is null or s.expires_at > now())), 'free') as tier,
$r$, ''],
    ['public.admin_user_detail(uuid)',
     $r$    'subscription', (select jsonb_build_object('tier', s.tier, 'store', s.store, 'expires_at', s.expires_at,
                       'sandbox', s.sandbox, 'updated_at', s.updated_at,
                       'active', s.tier <> 'free' and (s.expires_at is null or s.expires_at > now()))
                     from public.subscriptions s where s.user_id = p.id),
$r$, ''],
    ['public.admin_analytics(integer)',
     $r$coalesce(case when s.expires_at is null or s.expires_at>now() then s.tier end,'free') as tier,count(*) as users from population p left join public.subscriptions s on s.user_id=p.id group by 1,2,3,4)$r$,
     $r$count(*) as users from population p group by 1,2,3)$r$],
    ['public.export_my_data()',
     $r$    'subscription', (select to_jsonb(s) from public.subscriptions s where s.user_id = auth.uid()),
$r$, '']
  ];
  i int; body text; hits int;
begin
  for i in 1 .. array_length(edits, 1) loop
    body := pg_get_functiondef(edits[i][1]::regprocedure);
    hits := (length(body) - length(replace(body, edits[i][2], ''))) / length(edits[i][2]);
    if hits <> 1 then
      raise exception '0029: expected exactly one match in %, found %', edits[i][1], hits;
    end if;
    execute replace(body, edits[i][2], edits[i][3]);
  end loop;
end $migr$;

-- Legacy admin list (0009): its result type had a tier column, so it is recreated without it.
drop function public.admin_users(text, text);
create function public.admin_users(p_query text default null, p_country text default null)
returns table (id uuid, email text, display_name text, age smallint, country text, city text, verification_status text,
               onboarding_done boolean, suspended_until timestamptz, created_at timestamptz, reports int)
language sql stable security definer set search_path = public as $$
  select p.id, u.email, p.display_name, public.profile_age(p.id), p.country, p.city, p.verification_status, p.onboarding_done, p.suspended_until,
         p.created_at,
         (select count(*)::int from public.reports r where r.target_profile_id = p.id)
  from public.profiles p join auth.users u on u.id = p.id
  where public.is_admin()
    and (p_country is null or p.country = p_country)
    and (p_query is null or p.display_name ilike '%' || p_query || '%' or u.email ilike '%' || p_query || '%')
  order by p.created_at desc limit 200
$$;
revoke all on function public.admin_users(text, text) from public, anon;
grant execute on function public.admin_users(text, text) to authenticated;

-- ============================================================================================================
-- 4. Drop billing objects. Nothing above references them any more (checked below).
-- ============================================================================================================
drop function public.admin_reset_free(uuid, text);
drop function public.billing_commit(jsonb, jsonb, jsonb);
drop table public.billing_events;
drop table public.subscriptions;            -- also drops trigger subscriptions_guard and policy subs_own
drop function public.guard_subscription_write();
drop function public.daily_like_limit();
drop function public.tier_flag(text);
drop function public.my_tier();

do $$
declare bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname) into bad
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.prosrc ~* '\y(subscriptions|billing_events|tier_flag|my_tier|daily_like_limit|tier_limits|prices_preliminary|paid_subscribers|reward_days)\y';
  if bad is not null then
    raise exception '0029: functions still reference subscriptions or tiers: %', bad;
  end if;
end $$;
