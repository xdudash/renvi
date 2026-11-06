-- Block M (money): RENVI Plus, rewarded sparks, plan boosts, partner ads. Idempotent.
--
-- Founder decision 2026-11-06: bring back the paid layer shown in the mockup (0029 removed the first version).
-- Everything that gives access is decided HERE, on the server:
--   * subscriptions: written only by plus_set() (service role, called by the plus-sync Edge Function after it has asked
--     RevenueCat). The app only reads its own row through my_tier().
--   * Plus: no spark limit, 10 active plans (Free 2), no ads, the whole Playbook, one free plan boost per 7 days.
--   * Free: daily_spark_limit sparks a day (config; the mockup says 20) + 5 per watched rewarded ad, at most 3 ads a day.
--   * Boost: paid boosts are applied only by plan_boost_apply() (service role, idempotent by the store transaction id).
--   * Ads: rows of public.ads managed by admins; Plus never receives one.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Subscriptions
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  product text,
  trial boolean not null default false,
  expires_at timestamptz,
  store_checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_own_read on public.subscriptions;
create policy subscriptions_own_read on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

create or replace function public.is_plus(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.expires_at > now() from public.subscriptions s where s.user_id = p_uid), false)
$$;

-- Service role only: the store's answer for one user (null expiry = no subscription).
create or replace function public.plus_set(p_user uuid, p_expires timestamptz, p_product text, p_trial boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id, product, trial, expires_at, store_checked_at, updated_at)
  values (p_user, p_product, coalesce(p_trial, false), p_expires, now(), now())
  on conflict (user_id) do update
    set product = excluded.product, trial = excluded.trial, expires_at = excluded.expires_at,
        store_checked_at = now(), updated_at = now();
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Free spark limit, rewarded ads
-- ---------------------------------------------------------------------------------------------------------------
-- The mockup promises 20 sparks a day in Free; move the untouched default (100) to it. A value an admin set stays.
update public.app_config set value = '20'::jsonb, updated_at = now() where key = 'daily_spark_limit' and value = '100'::jsonb;
insert into public.app_config (key, value) values ('ad_reward', '{"sparks": 5, "per_day": 3, "seconds": 15}'::jsonb) on conflict (key) do nothing;

create table if not exists public.ad_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ad_id uuid,
  started_at timestamptz not null default now(),
  claimed_at timestamptz,
  sparks smallint not null default 0
);
create index if not exists ad_rewards_user_day on public.ad_rewards (user_id, claimed_at);
alter table public.ad_rewards enable row level security;
revoke all on public.ad_rewards from anon, authenticated;
grant all on public.ad_rewards to service_role;

create or replace function public.ad_reward_cfg(p_key text, p_default int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> p_key)::int from public.app_config where key = 'ad_reward' and value ? p_key), p_default)
$$;

-- Sparks the person may send today; null = no limit (Plus).
create or replace function public.spark_limit_for(p_uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when public.is_plus(p_uid) then null
    else public.daily_spark_limit() + coalesce((select sum(r.sparks)::int from public.ad_rewards r
                                                 where r.user_id = p_uid and r.claimed_at >= date_trunc('day', now())), 0) end
$$;

-- send_spark(): the limit now comes from spark_limit_for() (Plus = none, Free = base + watched ads).
do $$
declare def text; n int;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'send_spark';
  n := (length(def) - length(replace(def, 'public.daily_spark_limit()', ''))) / length('public.daily_spark_limit()');
  if n = 1 then
    execute replace(def, 'public.daily_spark_limit()', 'coalesce(public.spark_limit_for(me), 2147483647)');
  elsif position('spark_limit_for' in def) = 0 then
    raise exception 'send_spark: expected one daily_spark_limit() call, found %', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Ads (partner cards between people, the video-like card before a rewarded +5)
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (slot in ('people', 'rewarded')),
  partner text not null check (char_length(partner) between 2 and 80),
  title text not null check (char_length(title) between 2 and 120),
  body text check (body is null or char_length(body) <= 300),
  image_url text check (image_url is null or image_url ~ '^https://'),
  link_url text not null check (link_url ~ '^https://'),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  impressions int not null default 0,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.ad_events (
  id bigint generated always as identity primary key,
  ad_id uuid not null references public.ads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('view', 'click')),
  created_at timestamptz not null default now()
);
alter table public.ads enable row level security;
alter table public.ad_events enable row level security;
drop policy if exists ads_admin_all on public.ads;
create policy ads_admin_all on public.ads for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists ad_events_admin_read on public.ad_events;
create policy ad_events_admin_read on public.ad_events for select to authenticated using (public.is_admin());
revoke all on public.ads, public.ad_events from anon, authenticated;
grant select, insert, update, delete on public.ads to authenticated; -- RLS: admins only
grant select on public.ad_events to authenticated;
grant all on public.ads, public.ad_events to service_role;

create or replace function public.ad_pick(p_slot text) returns public.ads
language sql stable security definer set search_path = public as $$
  select a from public.ads a
   where a.slot = p_slot and a.active and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at > now())
   order by random() limit 1
$$;

create or replace function public.ad_json(a public.ads) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', a.id, 'partner', a.partner, 'title', a.title, 'body', a.body, 'image_url', a.image_url, 'link_url', a.link_url)
$$;

-- The next ad for a slot, or null (Plus, no active ad). Counts one impression.
create or replace function public.ad_next(p_slot text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.ads;
begin
  perform public.assert_account_active();
  if p_slot not in ('people', 'rewarded') then raise exception 'bad slot' using errcode = '22023'; end if;
  if public.is_plus(me) then return null; end if;
  a := public.ad_pick(p_slot);
  if a.id is null then return null; end if;
  update public.ads set impressions = impressions + 1 where id = a.id;
  insert into public.ad_events (ad_id, user_id, kind) values (a.id, me, 'view');
  return public.ad_json(a);
end $$;

create or replace function public.ad_click(p_ad uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_account_active();
  if not exists (select 1 from public.ads where id = p_ad) then raise exception 'not available' using errcode = 'P0002'; end if;
  update public.ads set clicks = clicks + 1 where id = p_ad;
  insert into public.ad_events (ad_id, user_id, kind) values (p_ad, auth.uid(), 'click');
end $$;

-- Rewarded +5: start (server picks the ad and remembers the time), claim after the video length.
create or replace function public.ad_reward_start() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.ads; rid uuid; done int;
begin
  perform public.assert_account_active();
  if public.is_plus(me) then raise exception 'plus has no limit' using errcode = 'P0010'; end if;
  select count(*) into done from public.ad_rewards where user_id = me and claimed_at >= date_trunc('day', now());
  if done >= public.ad_reward_cfg('per_day', 3) then raise exception 'reward limit' using errcode = 'P0003'; end if;
  a := public.ad_pick('rewarded');
  if a.id is null then raise exception 'no ad' using errcode = 'P0002'; end if;
  -- an unclaimed start older than a minute is dead weight: drop it so spam cannot pile up
  delete from public.ad_rewards where user_id = me and claimed_at is null and started_at < now() - interval '1 minute';
  insert into public.ad_rewards (user_id, ad_id) values (me, a.id) returning id into rid;
  update public.ads set impressions = impressions + 1 where id = a.id;
  insert into public.ad_events (ad_id, user_id, kind) values (a.id, me, 'view');
  return jsonb_build_object('reward_id', rid, 'seconds', public.ad_reward_cfg('seconds', 15),
                            'sparks', public.ad_reward_cfg('sparks', 5), 'ad', public.ad_json(a));
end $$;

create or replace function public.ad_reward_claim(p_reward uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.ad_rewards; need int := public.ad_reward_cfg('seconds', 15); k int := public.ad_reward_cfg('sparks', 5);
begin
  perform public.assert_account_active();
  select * into r from public.ad_rewards where id = p_reward and user_id = me for update;
  if r.id is null or r.claimed_at is not null then raise exception 'not available' using errcode = 'P0002'; end if;
  -- one second of slack for network jitter
  if now() - r.started_at < make_interval(secs => greatest(need - 1, 1)) then raise exception 'too early' using errcode = 'P0006'; end if;
  update public.ad_rewards set claimed_at = now(), sparks = k where id = r.id;
  return public.my_tier();
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Plans: Plus limit 10, boosts
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.plan_limit_for(p_uid uuid) returns int language sql stable as $$
  select case when public.is_plus(p_uid) then 10 else 2 end
$$;

create table if not exists public.boost_purchases (
  store_tx text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  product text not null,
  hours int not null,
  created_at timestamptz not null default now()
);
create table if not exists public.boost_free_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  used_at timestamptz not null default now()
);
create index if not exists boost_free_log_user on public.boost_free_log (user_id, used_at desc);
alter table public.boost_purchases enable row level security;
alter table public.boost_free_log enable row level security;
revoke all on public.boost_purchases, public.boost_free_log from anon, authenticated;
grant all on public.boost_purchases, public.boost_free_log to service_role;

create or replace function public.plan_boost_extend(p_plan uuid, p_hours int) returns timestamptz
language sql security definer set search_path = public as $$
  update public.plans set boosted_until = greatest(coalesce(boosted_until, now()), now()) + make_interval(hours => p_hours)
   where id = p_plan returning boosted_until
$$;

-- Service role only (boost-sync): a paid boost for a plan of p_user; the same store transaction is never applied twice.
create or replace function public.plan_boost_apply(p_user uuid, p_plan uuid, p_hours int, p_tx text, p_product text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pl public.plans; until timestamptz;
begin
  if p_hours not in (3, 24) then raise exception 'bad boost' using errcode = '22023'; end if;
  if exists (select 1 from public.boost_purchases where store_tx = p_tx) then
    return jsonb_build_object('applied', false, 'already', true);
  end if;
  select * into pl from public.plans where id = p_plan and host_id = p_user;
  if pl.id is null or not public.plan_is_open(pl) then raise exception 'not available' using errcode = 'P0002'; end if;
  insert into public.boost_purchases (store_tx, user_id, plan_id, product, hours) values (p_tx, p_user, p_plan, p_product, p_hours);
  until := public.plan_boost_extend(p_plan, p_hours);
  return jsonb_build_object('applied', true, 'boosted_until', until);
end $$;

-- Plus: one free 3-hour boost every 7 days.
create or replace function public.plan_boost_free(p_plan uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pl public.plans; last_used timestamptz; until timestamptz;
begin
  perform public.assert_account_active();
  if not public.is_plus(me) then raise exception 'plus only' using errcode = '42501', detail = 'plus'; end if;
  select * into pl from public.plans where id = p_plan and host_id = me;
  if pl.id is null or not public.plan_is_open(pl) then raise exception 'not available' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('boost-free:' || me::text, 0));
  select max(used_at) into last_used from public.boost_free_log where user_id = me;
  if last_used is not null and last_used > now() - interval '7 days' then raise exception 'already used this week' using errcode = 'P0005'; end if;
  insert into public.boost_free_log (user_id, plan_id) values (me, p_plan);
  until := public.plan_boost_extend(p_plan, 3);
  return jsonb_build_object('boosted_until', until);
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. my_tier(): what the app needs to draw the paywall, limits and menus
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.my_tier() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); s public.subscriptions; plus boolean; used int; lim int; ads_done int; last_free timestamptz;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into s from public.subscriptions where user_id = me;
  plus := coalesce(s.expires_at > now(), false);
  select count(*) into used from public.sparks where from_id = me and created_at >= date_trunc('day', now());
  lim := public.spark_limit_for(me);
  select count(*) into ads_done from public.ad_rewards where user_id = me and claimed_at >= date_trunc('day', now());
  select max(used_at) into last_free from public.boost_free_log where user_id = me;
  return jsonb_build_object(
    'plus', plus, 'trial', plus and coalesce(s.trial, false), 'expires_at', case when plus then s.expires_at end,
    'spark_limit', lim, 'sparks_used', used, 'sparks_left', case when lim is null then null else greatest(lim - used, 0) end,
    'ads_left', case when plus then 0 else greatest(public.ad_reward_cfg('per_day', 3) - ads_done, 0) end,
    'ad_sparks', public.ad_reward_cfg('sparks', 5),
    'plan_limit', public.plan_limit_for(me),
    'boost_free_at', case when plus and last_free is not null and last_free > now() - interval '7 days' then last_free + interval '7 days' end,
    'boost_free_ready', plus and (last_free is null or last_free <= now() - interval '7 days'));
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Playbook: Plus opens every lesson
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.playbook_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.playbook_progress;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into r from public.playbook_progress where user_id = auth.uid();
  return jsonb_build_object(
    'purchased', coalesce(r.purchased, false) or public.is_plus(auth.uid()),
    'done_lessons', to_jsonb(coalesce(r.done_lessons, '{}'::int[])),
    'trainer_pos', coalesce(r.trainer_pos, 0));
end $$;

create or replace function public.playbook_mark_done(p_lesson int) returns void
language plpgsql security definer set search_path = public as $$
declare bought boolean;
begin
  perform public.assert_account_active();
  if p_lesson is null or p_lesson not between 1 and 8 then raise exception 'bad lesson' using errcode = '22023'; end if;
  select purchased into bought from public.playbook_progress where user_id = auth.uid();
  if p_lesson <> 2 and not (coalesce(bought, false) or public.is_plus(auth.uid())) then
    raise exception 'playbook not purchased' using errcode = '42501', detail = 'playbook';
  end if;
  insert into public.playbook_progress (user_id, done_lessons) values (auth.uid(), array[p_lesson])
  on conflict (user_id) do update
    set done_lessons = (select array_agg(distinct x order by x) from unnest(playbook_progress.done_lessons || p_lesson) x),
        updated_at = now();
end $$;

create or replace function public.playbook_set_trainer(p_pos int) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_account_active();
  if p_pos is null or p_pos not between 0 and 30 then raise exception 'bad position' using errcode = '22023'; end if;
  if not (coalesce((select purchased from public.playbook_progress where user_id = auth.uid()), false) or public.is_plus(auth.uid())) then
    raise exception 'playbook not purchased' using errcode = '42501', detail = 'playbook';
  end if;
  insert into public.playbook_progress (user_id, trainer_pos) values (auth.uid(), p_pos)
  on conflict (user_id) do update set trainer_pos = excluded.trainer_pos, updated_at = now();
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------------------------------------------
revoke all on function public.is_plus(uuid), public.plus_set(uuid, timestamptz, text, boolean), public.ad_reward_cfg(text, int),
  public.spark_limit_for(uuid), public.ad_pick(text), public.ad_json(public.ads), public.plan_boost_extend(uuid, int),
  public.plan_boost_apply(uuid, uuid, int, text, text) from public, anon, authenticated;
grant execute on function public.plus_set(uuid, timestamptz, text, boolean), public.plan_boost_apply(uuid, uuid, int, text, text) to service_role;
revoke all on function public.ad_next(text), public.ad_click(uuid), public.ad_reward_start(), public.ad_reward_claim(uuid),
  public.plan_boost_free(uuid), public.my_tier(), public.playbook_state(), public.playbook_mark_done(int), public.playbook_set_trainer(int) from public, anon;
grant execute on function public.ad_next(text), public.ad_click(uuid), public.ad_reward_start(), public.ad_reward_claim(uuid),
  public.plan_boost_free(uuid), public.my_tier(), public.playbook_state(), public.playbook_mark_done(int), public.playbook_set_trainer(int) to authenticated;
