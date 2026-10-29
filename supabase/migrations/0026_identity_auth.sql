-- Identity fields lock on their first non-null choice, including existing accounts.
alter table public.profiles add column gender_locked_at timestamptz;
alter table public.private_profile add column birthdate_locked_at timestamptz;
update public.profiles set gender_locked_at=now() where gender is not null;
update public.private_profile set birthdate_locked_at=now() where birthdate is not null;

create function public.age_on_utc_date(p_birthdate date,p_today date default (now() at time zone 'UTC')::date)
returns smallint language sql immutable set search_path=public as $$
  select extract(year from age(p_today,p_birthdate))::smallint
$$;
-- Recompute on every exposed RPC read, so UTC birthdays do not depend on cron or another profile edit.
create function public.profile_age(p_user uuid) returns smallint
language sql stable security definer set search_path=public as $$
  select case when pp.birthdate is null then p.age else public.age_on_utc_date(pp.birthdate,(now() at time zone 'UTC')::date) end
  from public.profiles p left join public.private_profile pp on pp.user_id=p.id where p.id=p_user
$$;
create function public.assert_email_confirmed() returns void
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'email confirmation required' using errcode='42501',detail='email_unverified';
  end if;
end $$;
create or replace function public.assert_account_active() returns void
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.assert_email_confirmed();
  if public.account_restricted(auth.uid()) then raise exception 'account restricted' using errcode='42501',detail='sanction'; end if;
end $$;
revoke all on function public.assert_email_confirmed() from public,anon,authenticated;

-- A private, transaction-bound capability: clients cannot forge a correction context with set_config().
create table public.identity_correction_context(tx bigint primary key,admin_id uuid not null,target_id uuid not null);
alter table public.identity_correction_context enable row level security;
revoke all on public.identity_correction_context from public,anon,authenticated,service_role;
create function public.identity_correction_allowed(p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.is_admin() and exists(select 1 from public.identity_correction_context where tx=txid_current() and admin_id=auth.uid() and target_id=p_user)
$$;
revoke all on function public.identity_correction_allowed(uuid) from public,anon,authenticated;

create function public.guard_identity() returns trigger
language plpgsql security definer set search_path=public as $$
declare allowed boolean; today date := (now() at time zone 'UTC')::date;
begin
  if tg_table_name='profiles' then
    allowed:=public.identity_correction_allowed(new.id);
    if tg_op='UPDATE' and old.gender is not null and new.gender is distinct from old.gender and not allowed then
      raise exception 'gender is immutable; contact support' using errcode='42501';
    end if;
    if tg_op='UPDATE' then new.gender_locked_at:=old.gender_locked_at; else new.gender_locked_at:=null; end if;
    if new.gender is not null and new.gender_locked_at is null then new.gender_locked_at:=now(); end if;
    if tg_op='UPDATE' and new.age is distinct from old.age and new.age is distinct from public.profile_age(new.id) then
      raise exception 'age is derived from birthdate' using errcode='42501';
    end if;
  else
    allowed:=public.identity_correction_allowed(new.user_id);
    if tg_op='UPDATE' and old.birthdate is not null and new.birthdate is distinct from old.birthdate and not allowed then
      raise exception 'birthdate is immutable; contact support' using errcode='42501';
    end if;
    if new.birthdate is not null and (not isfinite(new.birthdate) or new.birthdate>today or public.age_on_utc_date(new.birthdate,today)<18 or public.age_on_utc_date(new.birthdate,today)>120) then
      raise exception 'birthdate must be valid and age between 18 and 120' using errcode='22023';
    end if;
    if tg_op='UPDATE' then new.birthdate_locked_at:=old.birthdate_locked_at; else new.birthdate_locked_at:=null; end if;
    if new.birthdate is not null and new.birthdate_locked_at is null then new.birthdate_locked_at:=now(); end if;
  end if;
  return new;
end $$;
create trigger identity_profile_guard before insert or update on public.profiles for each row execute function public.guard_identity();
create trigger identity_private_guard before insert or update on public.private_profile for each row execute function public.guard_identity();

create function public.my_identity() returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('birthdate',pp.birthdate,'birthdate_locked_at',pp.birthdate_locked_at,'gender',p.gender,'gender_locked_at',p.gender_locked_at,'age',public.profile_age(p.id))
  from public.profiles p left join public.private_profile pp on pp.user_id=p.id where p.id=auth.uid()
$$;

create function public.admin_correct_identity(p_user uuid,p_birthdate date,p_gender text,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare why text; before_values jsonb;
begin
  perform public.admin_guard();
  why:=public.admin_need_reason(p_reason);
  if p_birthdate is null or p_gender is null then raise exception 'birthdate and gender required' using errcode='22023'; end if;
  perform 1 from public.profiles where id=p_user for update;
  if not found then raise exception 'profile not found' using errcode='22023'; end if;
  select jsonb_build_object('birthdate',pp.birthdate,'gender',p.gender) into before_values
    from public.profiles p left join public.private_profile pp on pp.user_id=p.id where p.id=p_user;
  insert into public.identity_correction_context values(txid_current(),auth.uid(),p_user);
  insert into public.private_profile(user_id,birthdate) values(p_user,p_birthdate)
    on conflict(user_id) do update set birthdate=excluded.birthdate;
  update public.profiles set gender=p_gender,age=public.age_on_utc_date(p_birthdate,(now() at time zone 'UTC')::date) where id=p_user;
  perform public.admin_log('identity.correct',p_user,null,why,jsonb_build_object('before',before_values,'after',jsonb_build_object('birthdate',p_birthdate,'gender',p_gender)));
  delete from public.identity_correction_context where tx=txid_current();
end $$;
revoke all on function public.my_identity(),public.admin_correct_identity(uuid,date,text,text),public.profile_age(uuid),public.age_on_utc_date(date,date) from public,anon;
grant execute on function public.my_identity(),public.admin_correct_identity(uuid,date,text,text),public.age_on_utc_date(date,date) to authenticated,service_role;
revoke execute on function public.profile_age(uuid) from authenticated;

revoke delete on public.private_profile from authenticated;

-- Keep existing RPC contracts; insert verification and fresh ages in the current authoritative definitions.
do $$
declare f record; body text;
begin
  for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('publish_profile','discover','profile_card','incoming_sparks','list_matches','match_context','digest_new_count','admin_users','admin_user_search','admin_user_detail','admin_support_detail')
  loop
    body:=pg_get_functiondef(f.oid);
    if f.proname='publish_profile' then body:=replace(body,'begin','begin' || E'\n  perform public.assert_email_confirmed();' || E'\n  if not exists(select 1 from public.private_profile where user_id=auth.uid() and birthdate is not null) or not exists(select 1 from public.profiles where id=auth.uid() and gender is not null) then raise exception ''birthdate and gender required'' using errcode=''22023''; end if;'); end if;
    body:=replace(body,'p.age','public.profile_age(p.id)');
    body:=replace(body,'select s.*, p.display_name, public.profile_age(p.id), p.city','select s.*, p.display_name, public.profile_age(p.id) as age, p.city');
    execute body;
  end loop;
end $$;
revoke all on function public.guard_identity() from public,anon,authenticated;
-- Accept only unambiguous ISO Gregorian input, and calculate the saved age in UTC as well.
do $$
declare body text;
begin
  body:=pg_get_functiondef('public.save_onboarding(jsonb)'::regprocedure);
  body:=replace(body, 'if p_patch ? ''birthdate'' then', 'if p_patch ? ''birthdate'' then' || E'\n    if coalesce(p_patch->>''birthdate'','''') !~ ''^[0-9]{4}-[0-9]{2}-[0-9]{2}$'' then raise exception ''invalid birthdate format'' using errcode=''22023''; end if;');
  body:=replace(body,'extract(year from age(bd))::smallint','public.age_on_utc_date(bd,(now() at time zone ''UTC'')::date)');
  body:=replace(body,'bd > current_date - interval ''18 years''','public.age_on_utc_date(bd,(now() at time zone ''UTC'')::date)<18');
  execute body;
end $$;
-- Verification also applies to reads using an already-issued, unverified session.
create function public.my_email_confirmed() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
$$;
revoke all on function public.my_email_confirmed() from public,anon;
grant execute on function public.my_email_confirmed() to authenticated,service_role;
do $$
declare body text; f record; table_name text;
begin
  body:=pg_get_functiondef('public.profile_is_visible(uuid)'::regprocedure);
  body:=replace(body,'where p.id = p_id and', 'where public.my_email_confirmed() and exists(select 1 from auth.users u where u.id=p_id and u.email_confirmed_at is not null) and p.id = p_id and');
  execute body;
  for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('list_matches','list_messages','match_context','incoming_sparks')
  loop
    body:=pg_get_functiondef(f.oid);
    if f.proname in ('match_context','incoming_sparks') then
      body:=replace(body,'begin','begin' || E'\n  perform public.assert_email_confirmed();');
    elsif f.proname='list_matches' then
      body:=replace(body,'where m.ended_at is null','where public.my_email_confirmed() and m.ended_at is null');
    else
      body:=replace(body,'where m.match_id = p_match','where public.my_email_confirmed() and m.match_id = p_match');
    end if;
    execute body;
  end loop;
  foreach table_name in array array['matches','messages','sparks','dates','photo_consents','video_calls'] loop
    execute format('create policy verified_email_read on public.%I as restrictive for select to authenticated using (public.my_email_confirmed())',table_name);
  end loop;
  body:=pg_get_functiondef('public.admin_user_detail(uuid)'::regprocedure);
  body:=replace(body,'''profile'', to_jsonb(p)', '''profile'', to_jsonb(p) || jsonb_build_object(''age'',public.profile_age(p.id))');
  execute body;
end $$;
