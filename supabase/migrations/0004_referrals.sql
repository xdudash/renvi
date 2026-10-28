-- Referral programme: personal code, signups through the code, reward in days of Plus after verification.
create table public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.referral_signups (
  invited_user uuid primary key references auth.users(id) on delete cascade,
  code text not null references public.referral_codes(code) on delete cascade,
  status text not null default 'registered' check (status in ('registered','verified','rewarded','rejected')),
  created_at timestamptz not null default now()
);
insert into public.app_config (key, value) values ('referral', '{"goal":5,"reward_days":7}');

alter table public.referral_codes enable row level security;
alter table public.referral_signups enable row level security;
create policy refcodes_own on public.referral_codes for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy refsignups_own on public.referral_signups for select to authenticated
  using (public.is_admin() or code in (select code from public.referral_codes where user_id = auth.uid()));
grant select on public.referral_codes, public.referral_signups to authenticated;

create or replace function public.my_referral() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text; done int; goal int;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select code into c from public.referral_codes where user_id = auth.uid();
  if c is null then
    loop
      c := upper(substr(coalesce((select display_name from public.profiles where id = auth.uid()), 'RE'), 1, 2))
           || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
      begin
        insert into public.referral_codes (user_id, code) values (auth.uid(), c);
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end if;
  select count(*) into done from public.referral_signups where code = c and status in ('verified','rewarded');
  select (value->>'goal')::int into goal from public.app_config where key = 'referral';
  return jsonb_build_object('code', c, 'verified', done, 'goal', coalesce(goal, 5));
end $$;

-- Public lookup for the invite landing page: returns only the inviter's first name.
create or replace function public.referral_lookup(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', p.display_name)
  from public.referral_codes r join public.profiles p on p.id = r.user_id
  where r.code = upper(trim(p_code)) and not r.blocked
$$;

create or replace function public.attach_referral() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
begin
  if c <> '' and exists (select 1 from public.referral_codes where code = c and not blocked and user_id <> new.id) then
    insert into public.referral_signups (invited_user, code) values (new.id, c) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_referral after insert on auth.users for each row execute function public.attach_referral();

-- When a moderator approves the selfie, the referral counts as verified.
create or replace function public.referral_on_verify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status = 'approved' and old.verification_status is distinct from 'approved' then
    update public.referral_signups set status = 'verified' where invited_user = new.id and status = 'registered';
  end if;
  return new;
end $$;
create trigger profiles_referral_verify after update on public.profiles for each row execute function public.referral_on_verify();

revoke all on function public.my_referral, public.referral_lookup from public;
grant execute on function public.my_referral to authenticated;
grant execute on function public.referral_lookup to anon, authenticated;

-- Selfie verification requests (the selfie never becomes a profile photo).
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.verification_requests enable row level security;
create policy verif_own on public.verification_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
grant select on public.verification_requests to authenticated;

create or replace function public.request_verification(p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_path not like auth.uid()::text || '/verify/%' then raise exception 'bad path' using errcode = '42501'; end if;
  insert into public.verification_requests (user_id, storage_path) values (auth.uid(), p_path);
  update public.profiles set verification_status = 'pending' where id = auth.uid();
end $$;
revoke all on function public.request_verification from public;
grant execute on function public.request_verification to authenticated;
