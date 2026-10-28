-- Extra admin tools: direct sanctions, user search, referral reward decisions.
create or replace function public.admin_sanction(p_user uuid, p_kind text, p_reason text, p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_kind not in ('warning','suspension','ban','lift') then raise exception 'bad kind' using errcode = '22023'; end if;
  if p_kind = 'lift' then
    update public.profiles set suspended_until = null where id = p_user;
    return;
  end if;
  insert into public.account_sanctions (user_id, kind, reason, until) values (p_user, p_kind, coalesce(p_reason, 'admin'), p_until);
  if p_kind = 'suspension' then update public.profiles set suspended_until = p_until where id = p_user;
  elsif p_kind = 'ban' then update public.profiles set suspended_until = 'infinity' where id = p_user; end if;
end $$;

create or replace function public.admin_users(p_query text default null, p_country text default null)
returns table (id uuid, email text, display_name text, age smallint, country text, city text, verification_status text,
               onboarding_done boolean, suspended_until timestamptz, tier text, created_at timestamptz, reports int)
language sql stable security definer set search_path = public as $$
  select p.id, u.email, p.display_name, p.age, p.country, p.city, p.verification_status, p.onboarding_done, p.suspended_until,
         coalesce(s.tier, 'free'), p.created_at,
         (select count(*)::int from public.reports r where r.target_profile_id = p.id)
  from public.profiles p join auth.users u on u.id = p.id
  left join public.subscriptions s on s.user_id = p.id
  where public.is_admin()
    and (p_country is null or p.country = p_country)
    and (p_query is null or p.display_name ilike '%' || p_query || '%' or u.email ilike '%' || p_query || '%')
  order by p.created_at desc limit 200
$$;

create or replace function public.admin_decide_referral(p_invited uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid; days int;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.referral_signups set status = case when p_approve then 'rewarded' else 'rejected' end
    where invited_user = p_invited and status = 'verified';
  if p_approve then
    select r.user_id into owner from public.referral_signups s join public.referral_codes r on r.code = s.code where s.invited_user = p_invited;
    select (value->>'reward_days')::int into days from public.app_config where key = 'referral';
    insert into public.subscriptions (user_id, tier, expires_at) values (owner, 'plus', now() + make_interval(days => coalesce(days, 7)))
      on conflict (user_id) do update set
        tier = case when public.subscriptions.tier = 'premium' then 'premium' else 'plus' end,
        expires_at = greatest(coalesce(public.subscriptions.expires_at, now()), now()) + make_interval(days => coalesce(days, 7)),
        updated_at = now()
      where public.subscriptions.store is null or public.subscriptions.tier = 'free';
  end if;
end $$;

create or replace function public.admin_referrals() returns table (invited_user uuid, code text, status text, created_at timestamptz, owner_name text)
language sql stable security definer set search_path = public as $$
  select s.invited_user, s.code, s.status, s.created_at, p.display_name
  from public.referral_signups s join public.referral_codes r on r.code = s.code join public.profiles p on p.id = r.user_id
  where public.is_admin() order by s.created_at desc limit 200
$$;

revoke all on function public.admin_sanction, public.admin_users, public.admin_decide_referral, public.admin_referrals from public;
grant execute on function public.admin_sanction, public.admin_users, public.admin_decide_referral, public.admin_referrals to authenticated;

-- Client error journal: authenticated users may add (not read) entries.
grant insert on public.error_events to authenticated;

-- Selfie decision also closes the pending request.
create or replace function public.admin_set_verification(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_status not in ('approved','rejected','pending') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.profiles set verification_status = p_status where id = p_user;
  update public.profile_photos set verified = (p_status = 'approved') where profile_id = p_user and position = 0;
  if p_status <> 'pending' then
    update public.verification_requests set status = p_status where user_id = p_user and status = 'pending';
  end if;
end $$;
