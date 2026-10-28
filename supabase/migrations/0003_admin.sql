-- Admin RPCs (every function checks is_admin(); none is callable by anonymous users).

create or replace function public.admin_set_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  insert into public.app_config (key, value) values (p_key, p_value)
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

create or replace function public.admin_set_verification(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_status not in ('approved','rejected','pending') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.profiles set verification_status = p_status where id = p_user;
  update public.profile_photos set verified = (p_status = 'approved') where profile_id = p_user and position = 0;
end $$;

create or replace function public.admin_decide_report(p_report uuid, p_decision text, p_sanction text, p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_decision not in ('actioned','dismissed') then raise exception 'bad decision' using errcode = '22023'; end if;
  select target_profile_id into target from public.reports where id = p_report;
  update public.reports set status = p_decision, decision = p_sanction, decided_at = now() where id = p_report;
  if p_decision = 'actioned' and target is not null and p_sanction in ('warning','suspension','ban') then
    insert into public.account_sanctions (user_id, kind, reason, until)
      values (target, p_sanction, 'report ' || p_report, case when p_sanction = 'suspension' then p_until end);
    if p_sanction = 'suspension' then
      update public.profiles set suspended_until = p_until where id = target;
    elsif p_sanction = 'ban' then
      update public.profiles set suspended_until = 'infinity' where id = target;
    end if;
  end if;
end $$;

create or replace function public.admin_decide_appeal(p_appeal uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.appeals set status = case when p_accept then 'accepted' else 'rejected' end
    where id = p_appeal returning user_id into uid;
  if p_accept and uid is not null then
    update public.profiles set suspended_until = null where id = uid;
  end if;
end $$;

create or replace function public.admin_stats(p_country text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'profiles', (select count(*) from public.profiles where onboarding_done and (p_country is null or country = p_country)),
    'sparks', (select count(*) from public.sparks s join public.profiles p on p.id = s.from_id
               where (p_country is null or p.country = p_country)),
    'matches', (select count(*) from public.matches m join public.profiles p on p.id = m.user_a
               where m.ended_at is null and (p_country is null or p.country = p_country)),
    'messages', (select count(*) from public.messages x join public.profiles p on p.id = x.sender_id
               where (p_country is null or p.country = p_country)),
    'dates', (select count(*) from public.dates d join public.profiles p on p.id = d.proposer_id
               where (p_country is null or p.country = p_country)),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'paid_subscribers', (select count(*) from public.subscriptions where tier <> 'free' and not sandbox
                         and (expires_at is null or expires_at > now())),
    'pending_verification', (select count(*) from public.profiles where verification_status = 'pending')
  );
end $$;

create or replace function public.admin_list_reports(p_status text default 'open')
returns setof public.reports language sql stable security definer set search_path = public as $$
  select r.* from public.reports r
  where public.is_admin() and (p_status is null or r.status = p_status)
  order by r.created_at desc limit 200
$$;

revoke all on function public.admin_set_config, public.admin_set_verification, public.admin_decide_report,
  public.admin_decide_appeal, public.admin_stats, public.admin_list_reports from public;
grant execute on function public.admin_set_config, public.admin_set_verification, public.admin_decide_report,
  public.admin_decide_appeal, public.admin_stats, public.admin_list_reports to authenticated;

-- Storage: one private bucket. Paths: <uid>/profile/*, <uid>/verify/* (selfie, owner+admin only), <uid>/chat/* (match partner).
create or replace function public.can_read_media(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(p_name, '/'); owner uuid;
begin
  if array_length(parts, 1) < 3 then return false; end if;
  begin owner := parts[1]::uuid; exception when others then return false; end;
  if owner = auth.uid() or public.is_admin() then return true; end if;
  if parts[2] = 'profile' then
    return public.profile_is_visible(owner) and not public.is_blocked_pair(owner, auth.uid());
  elsif parts[2] = 'chat' then
    return exists (select 1 from public.messages m where m.photo_path = p_name and m.deleted_at is null
                   and public.match_partner(m.match_id) is not null);
  end if;
  return false;
end $$;
grant execute on function public.can_read_media to authenticated;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('profile-media', 'profile-media', false)
      on conflict (id) do nothing;
    execute 'create policy media_read on storage.objects for select to authenticated
      using (bucket_id = ''profile-media'' and public.can_read_media(name))';
    execute 'create policy media_write on storage.objects for insert to authenticated
      with check (bucket_id = ''profile-media'' and (storage.foldername(name))[1] = auth.uid()::text)';
    execute 'create policy media_delete on storage.objects for delete to authenticated
      using (bucket_id = ''profile-media'' and (storage.foldername(name))[1] = auth.uid()::text)';
  end if;
end $$;
