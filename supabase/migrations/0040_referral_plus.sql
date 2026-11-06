-- Invitations give both people a week of Plus (the invite screen of the mockup promises it). Idempotent.
--
-- The reward is granted when an administrator approves the invited person (status verified → rewarded), never by the
-- client. It is stored separately from the store subscription (promo_until) so plus-sync, which only knows what
-- RevenueCat says, can never erase it.

alter table public.subscriptions add column if not exists promo_until timestamptz;

create or replace function public.plus_until(p_uid uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(s.expires_at, s.promo_until) from public.subscriptions s where s.user_id = p_uid
$$;

create or replace function public.is_plus(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.plus_until(p_uid) > now(), false)
$$;

-- Service role / internal: add days of promo Plus on top of whatever is left.
create or replace function public.plus_grant_days(p_user uuid, p_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id, promo_until, store_checked_at)
  values (p_user, now() + make_interval(days => p_days), now())
  on conflict (user_id) do update
    set promo_until = greatest(coalesce(subscriptions.promo_until, now()), now()) + make_interval(days => p_days), updated_at = now();
end $$;
revoke all on function public.plus_until(uuid), public.plus_grant_days(uuid, int) from public, anon, authenticated;
grant execute on function public.plus_grant_days(uuid, int) to service_role;

-- plus_set (store answer) must not touch promo_until: it only writes the store columns (already true); it also must
-- not create a row with a null expiry that hides the promo.
create or replace function public.my_tier() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); s public.subscriptions; until timestamptz; plus boolean; store_plus boolean; used int; lim int; ads_done int; last_free timestamptz;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into s from public.subscriptions where user_id = me;
  until := greatest(s.expires_at, s.promo_until);
  plus := coalesce(until > now(), false);
  store_plus := coalesce(s.expires_at > now(), false);
  select count(*) into used from public.sparks where from_id = me and created_at >= date_trunc('day', now());
  lim := public.spark_limit_for(me);
  select count(*) into ads_done from public.ad_rewards where user_id = me and claimed_at >= date_trunc('day', now());
  select max(used_at) into last_free from public.boost_free_log where user_id = me;
  return jsonb_build_object(
    'plus', plus, 'trial', store_plus and coalesce(s.trial, false), 'promo', plus and not store_plus,
    'expires_at', case when plus then until end,
    'spark_limit', lim, 'sparks_used', used, 'sparks_left', case when lim is null then null else greatest(lim - used, 0) end,
    'ads_left', case when plus then 0 else greatest(public.ad_reward_cfg('per_day', 3) - ads_done, 0) end,
    'ad_sparks', public.ad_reward_cfg('sparks', 5),
    'plan_limit', public.plan_limit_for(me),
    'free_sparks', public.daily_spark_limit(), 'free_plans', 2,
    'boost_free_at', case when plus and last_free is not null and last_free > now() - interval '7 days' then last_free + interval '7 days' end,
    'boost_free_ready', plus and (last_free is null or last_free <= now() - interval '7 days'));
end $$;
revoke all on function public.my_tier() from public, anon;
grant execute on function public.my_tier() to authenticated;

-- Approving an invitation: both people get 7 days of Plus. Rejecting changes nothing.
create or replace function public.admin_decide_referral(p_invited uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); owner uuid; n int;
begin
  update public.referral_signups set status = case when p_approve then 'rewarded' else 'rejected' end
    where invited_user = p_invited and status = 'verified';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'referral is not awaiting a decision' using errcode = '22023'; end if;
  select r.user_id into owner from public.referral_signups s join public.referral_codes r on r.code = s.code where s.invited_user = p_invited;
  if p_approve then
    perform public.plus_grant_days(owner, 7);
    perform public.plus_grant_days(p_invited, 7);
  end if;
  perform public.admin_log(case when p_approve then 'referral.approve' else 'referral.reject' end, owner, p_invited::text, null,
    jsonb_build_object('invited_user', p_invited, 'plus_days', case when p_approve then 7 else 0 end));
end $$;
