-- "RENVI для всех" block A: goals, relationship status, where a person is visible (modes), couple profiles.
-- Dating (the existing feed and sparks) is open only to people whose status is "single"; the rule is enforced here,
-- not in the app. Changing back to "single" opens dating after 7 days, so the app is not used for cheating.

alter table public.profiles
  add column if not exists goals text[] not null default '{}',
  add column if not exists relationship_status text not null default 'single',
  add column if not exists status_changed_at timestamptz,
  add column if not exists dating_open_at timestamptz,
  add column if not exists vis_dating boolean not null default true,
  add column if not exists vis_company boolean not null default true,
  add column if not exists company_audience text not null default 'all';
do $$ begin
  alter table public.profiles add constraint profiles_goals_chk check (goals <@ array['company','dating','couple','look']::text[]);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_status_chk check (relationship_status in ('single','relationship','married','couple'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_audience_chk check (company_audience in ('all','women','men'));
exception when duplicate_object then null; end $$;
-- Everyone who exists today came for dating.
update public.profiles set goals = array['dating'] where goals = '{}' and onboarding_done;

-- Is this person in the dating pool right now?
create or replace function public.dating_eligible(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = p_id and p.relationship_status = 'single' and p.vis_dating
      and (p.dating_open_at is null or p.dating_open_at <= now()))
$$;
revoke all on function public.dating_eligible(uuid) from public, anon;
grant execute on function public.dating_eligible(uuid) to authenticated;

create or replace function public.set_goals(p_goals text[]) returns void
language plpgsql security definer set search_path = public as $$
declare g text[];
begin
  perform public.assert_account_active();
  select coalesce(array_agg(distinct x order by x), '{}') into g from unnest(coalesce(p_goals, '{}')) x;
  if cardinality(g) < 1 or not (g <@ array['company','dating','couple','look']::text[]) then
    raise exception 'invalid goals' using errcode = '22023';
  end if;
  update public.profiles set goals = g, updated_at = now() where id = auth.uid();
  if not found then raise exception 'profile missing' using errcode = 'P0002'; end if;
end $$;

-- Status change. While the profile is still being created the choice is free; afterwards leaving "single" takes
-- dating away at once, and coming back to "single" opens it only after 7 days.
create or replace function public.set_relationship_status(p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles; opens timestamptz;
begin
  perform public.assert_account_active();
  if p_status not in ('single','relationship','married','couple') then raise exception 'invalid status' using errcode = '22023'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'profile missing' using errcode = 'P0002'; end if;
  if me.relationship_status = p_status then
    return jsonb_build_object('status', me.relationship_status, 'dating_open_at', me.dating_open_at);
  end if;
  if p_status = 'single' and me.relationship_status <> 'single' and me.onboarding_done then
    opens := now() + interval '7 days';
  else
    opens := null;
  end if;
  if me.relationship_status = 'couple' and p_status <> 'couple' then
    update public.couples set status = 'ended', ended_at = now()
      where status in ('pending','active') and (user_a = me.id or user_b = me.id);
  end if;
  update public.profiles set relationship_status = p_status, status_changed_at = now(), dating_open_at = opens,
    updated_at = now() where id = me.id;
  return jsonb_build_object('status', p_status, 'dating_open_at', opens);
end $$;

create or replace function public.set_visibility(p_dating boolean, p_company boolean, p_audience text, p_paused boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  perform public.assert_account_active();
  if p_audience not in ('all','women','men') then raise exception 'invalid audience' using errcode = '22023'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'profile missing' using errcode = 'P0002'; end if;
  if p_dating and me.relationship_status <> 'single' then
    raise exception 'dating requires status single' using errcode = 'P0007';
  end if;
  update public.profiles set vis_dating = p_dating, vis_company = p_company, company_audience = p_audience,
    paused = p_paused, updated_at = now() where id = me.id;
end $$;

create or replace function public.my_modes() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', p.relationship_status, 'goals', to_jsonb(p.goals), 'dating', p.vis_dating,
    'company', p.vis_company, 'audience', p.company_audience, 'paused', p.paused,
    'dating_open', public.dating_eligible(p.id), 'dating_open_at', p.dating_open_at, 'status_changed_at', p.status_changed_at)
  from public.profiles p where p.id = auth.uid()
$$;
revoke all on function public.set_goals(text[]), public.set_relationship_status(text),
  public.set_visibility(boolean, boolean, text, boolean), public.my_modes() from public, anon;
grant execute on function public.set_goals(text[]), public.set_relationship_status(text),
  public.set_visibility(boolean, boolean, text, boolean), public.my_modes() to authenticated;

-- ---- couple profiles ----------------------------------------------------------------------------------------------
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,   -- who invited
  user_b uuid references auth.users(id) on delete cascade,            -- who accepted
  code text not null unique,
  status text not null default 'pending' check (status in ('pending','active','ended')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  ended_at timestamptz,
  check (user_b is null or user_b <> user_a)
);
create unique index if not exists couples_one_active_a on public.couples (user_a) where status = 'active';
create unique index if not exists couples_one_active_b on public.couples (user_b) where status = 'active';
alter table public.couples enable row level security;
-- No direct access: everything goes through the functions below.
create table if not exists public.couple_attempts (user_id uuid not null, at timestamptz not null default now());
alter table public.couple_attempts enable row level security;

create or replace function public.couple_code() returns text language plpgsql volatile as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; s text := ''; i int;
begin
  for i in 1..6 loop s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
  return substr(s, 1, 3) || '-' || substr(s, 4, 3);
end $$;
revoke all on function public.couple_code() from public, anon, authenticated;

create or replace function public.couple_create_code() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.couples; tries int := 0;
begin
  perform public.assert_account_active();
  if (select relationship_status from public.profiles where id = me) is distinct from 'couple' then
    raise exception 'status must be couple' using errcode = 'P0007';
  end if;
  if exists (select 1 from public.couples where status = 'active' and (user_a = me or user_b = me)) then
    raise exception 'already paired' using errcode = 'P0005';
  end if;
  update public.couples set status = 'ended', ended_at = now() where user_a = me and status = 'pending' and expires_at <= now();
  select * into c from public.couples where user_a = me and status = 'pending' and expires_at > now();
  if not found then
    loop
      begin
        insert into public.couples (user_a, code, expires_at) values (me, public.couple_code(), now() + interval '48 hours') returning * into c;
        exit;
      exception when unique_violation then
        tries := tries + 1; if tries > 8 then raise; end if;
      end;
    end loop;
  end if;
  return jsonb_build_object('code', c.code, 'expires_at', c.expires_at);
end $$;

create or replace function public.couple_attempt_guard() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.couple_attempts where at < now() - interval '1 day';
  if (select count(*) from public.couple_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 8 then
    raise exception 'too many attempts' using errcode = 'P0006';
  end if;
  insert into public.couple_attempts (user_id) values (auth.uid());
end $$;
revoke all on function public.couple_attempt_guard() from public, anon, authenticated;

-- Who is behind a code (name and age only), so the invitee can confirm before linking.
create or replace function public.couple_preview(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.couples; p public.profiles;
begin
  perform public.assert_account_active();
  perform public.couple_attempt_guard();
  select * into c from public.couples where code = upper(trim(p_code)) and status = 'pending' and expires_at > now();
  -- A wrong code returns found=false instead of raising, so the attempt stays counted.
  if not found or c.user_a = auth.uid() then return jsonb_build_object('found', false); end if;
  select * into p from public.profiles where id = c.user_a;
  return jsonb_build_object('found', true, 'name', p.display_name, 'age', p.age);
end $$;

create or replace function public.couple_accept(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.couples;
begin
  perform public.assert_account_active();
  perform public.couple_attempt_guard();
  select * into c from public.couples where code = upper(trim(p_code)) and status = 'pending' and expires_at > now() for update;
  if not found or c.user_a = me then return jsonb_build_object('found', false); end if;
  if exists (select 1 from public.couples where status = 'active' and (user_a in (me, c.user_a) or user_b in (me, c.user_a))) then
    raise exception 'already paired' using errcode = 'P0005';
  end if;
  if public.is_blocked_pair(me, c.user_a) then return jsonb_build_object('found', false); end if;
  update public.couples set user_b = me, status = 'active', confirmed_at = now() where id = c.id;
  update public.profiles set relationship_status = 'couple', status_changed_at = now(), dating_open_at = null, updated_at = now()
    where id in (me, c.user_a) and relationship_status <> 'couple';
  return jsonb_build_object('found', true, 'couple_id', c.id, 'partner_id', c.user_a);
end $$;

create or replace function public.my_couple() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.couples; pid uuid;
begin
  select * into c from public.couples where status in ('active','pending') and (user_a = me or user_b = me)
    order by (status = 'active') desc, created_at desc limit 1;
  if not found then return null; end if;
  if c.status = 'pending' and c.expires_at <= now() then return null; end if;
  pid := case when c.user_a = me then c.user_b else c.user_a end;
  return jsonb_build_object('couple_id', c.id, 'status', c.status, 'code', case when c.status = 'pending' and c.user_a = me then c.code end,
    'expires_at', c.expires_at,
    'partner', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'age', p.age) from public.profiles p where p.id = pid));
end $$;

create or replace function public.couple_leave() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.couples;
begin
  perform public.assert_account_active();
  select * into c from public.couples where status in ('active','pending') and (user_a = me or user_b = me) order by created_at desc limit 1;
  if not found then return; end if;
  update public.couples set status = 'ended', ended_at = now() where id = c.id;
  -- Both people get a neutral status back; nobody lands in the dating pool by accident.
  update public.profiles set relationship_status = 'relationship', status_changed_at = now(), updated_at = now()
    where id in (c.user_a, c.user_b) and relationship_status = 'couple';
end $$;
revoke all on function public.couple_create_code(), public.couple_preview(text), public.couple_accept(text),
  public.my_couple(), public.couple_leave() from public, anon;
grant execute on function public.couple_create_code(), public.couple_preview(text), public.couple_accept(text),
  public.my_couple(), public.couple_leave() to authenticated;

-- ---- enforce on the dating feed and sparks --------------------------------------------------------------------------
do $migr$
declare body text;
begin
  body := pg_get_functiondef('public.discover(integer)'::regprocedure);
  if position('and p.onboarding_done and not p.paused' in body) = 0 then raise exception 'discover(): anchor not found'; end if;
  body := replace(body, 'and p.onboarding_done and not p.paused',
    'and p.onboarding_done and not p.paused and public.dating_eligible(p.id) and public.dating_eligible(me.id)');
  execute body;
  body := pg_get_functiondef('public.send_spark(uuid,text,uuid,text)'::regprocedure);
  if position('perform public.assert_account_active();' in body) = 0 then raise exception 'send_spark(): anchor not found'; end if;
  body := replace(body, 'perform public.assert_account_active();',
    E'perform public.assert_account_active();\n  if not public.dating_eligible(me) or not public.dating_eligible(p_to) then raise exception ''dating closed'' using errcode = ''P0007''; end if;');
  execute body;
end $migr$;

-- Onboarding got two steps in front (goals, status): people who are in the middle of it keep their place.
update public.profiles set onboarding_step = onboarding_step + 2 where not onboarding_done and onboarding_step < 99;
update public.profiles set goals = array['dating'] where goals = '{}' and not onboarding_done and onboarding_step > 2;
