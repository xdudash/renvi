-- Block S: «Компания» (friends and company, a «привет» instead of a spark) and «Пары» (couples meet couples).
-- A mutual «привет» opens an ordinary chat (a matches row of kind 'company' / 'couples').

alter table public.matches add column if not exists kind text not null default 'dating' check (kind in ('dating','company','couples'));
alter table public.profiles add column if not exists company_look text[] not null default '{}' check (cardinality(company_look) <= 8);

create table if not exists public.company_hellos (
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('company','couples')),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, mode),
  check (from_id <> to_id)
);
create index if not exists company_hellos_to_idx on public.company_hellos (to_id, mode);
create table if not exists public.company_passes (
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('company','couples')),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, mode)
);
alter table public.company_hellos enable row level security;
alter table public.company_passes enable row level security;
revoke all on public.company_hellos, public.company_passes from public, anon, authenticated;

update public.app_config set value = value || '{"company_hello": 60}'::jsonb where key = 'rate_limits';

-- What a person is looking for in company: plan categories.
create or replace function public.set_company_look(p_look text[]) returns void
language plpgsql security definer set search_path = public as $$
declare x text;
begin
  perform public.assert_account_active();
  if p_look is null or cardinality(p_look) > 8 then raise exception 'too many' using errcode = '22023'; end if;
  foreach x in array p_look loop
    if x not in ('market','rink','mountains','thermal','club','quiz','sport','games','cinema','food','culture','trip','meet') then
      raise exception 'bad category' using errcode = '22023';
    end if;
  end loop;
  update public.profiles set company_look = (select coalesce(array_agg(distinct v), '{}') from unnest(p_look) v), updated_at = now() where id = auth.uid();
end $$;

-- May this person use the company mode (and be shown in it)?
create or replace function public.company_open(p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.onboarding_done and not p.paused and p.vis_company and p.relationship_status <> 'couple'
                          and (p.suspended_until is null or p.suspended_until < now())
                     from public.profiles p where p.id = p_uid), false)
$$;

create or replace function public.plans_attended(p_uid uuid) returns int language sql stable security definer set search_path = public as $$
  select (select count(*)::int from public.plan_members m join public.plans pl on pl.id = m.plan_id
           where m.user_id = p_uid and m.status = 'going' and pl.status = 'active' and pl.starts_at < now() - interval '3 hours')
       + (select count(*)::int from public.plans pl where pl.host_id = p_uid and pl.status = 'active' and pl.starts_at < now() - interval '3 hours')
$$;

create or replace function public.company_feed(p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  perform public.assert_account_active();
  select * into me from public.profiles where id = auth.uid();
  if not public.company_open(me.id) then raise exception 'company closed' using errcode = 'P0007'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.rank) from (
      select jsonb_build_object('id', p.id, 'name', p.display_name, 'age', p.age, 'status', p.relationship_status, 'city', p.city,
               'about', p.bio, 'look', to_jsonb(p.company_look),
               'photo', (select ph.storage_path from public.profile_photos ph where ph.profile_id = p.id and ph.kind = 'photo' order by ph.position limit 1),
               'common', coalesce((select count(*) from unnest(p.interests) i where i = any (me.interests)), 0),
               'plans', public.plans_attended(p.id),
               'said_hello', exists (select 1 from public.company_hellos h where h.from_id = p.id and h.to_id = me.id and h.mode = 'company')) as j,
             (case when exists (select 1 from public.company_hellos h where h.from_id = p.id and h.to_id = me.id and h.mode = 'company') then 0 else 1 end,
              -(coalesce((select count(*) from unnest(p.interests) i where i = any (me.interests)), 0)), random()) as rank
        from public.profiles p
       where p.id <> me.id and public.company_open(p.id)
         and p.country is not distinct from me.country
         and (me.city is null or p.city is null or lower(p.city) = lower(me.city))
         and (p.company_audience = 'all' or (p.company_audience = 'women' and me.gender = 'woman') or (p.company_audience = 'men' and me.gender = 'man'))
         and not public.is_blocked_pair(p.id, me.id)
         and not exists (select 1 from public.matches m where m.ended_at is null and ((m.user_a = me.id and m.user_b = p.id) or (m.user_b = me.id and m.user_a = p.id)))
         and not exists (select 1 from public.company_hellos h where h.from_id = me.id and h.to_id = p.id and h.mode = 'company')
         and not exists (select 1 from public.company_passes c where c.from_id = me.id and c.to_id = p.id and c.mode = 'company' and c.created_at > now() - interval '14 days')
       order by rank limit least(greatest(coalesce(p_limit, 20), 1), 50)) x), '[]'::jsonb);
end $$;

create or replace function public.company_pass(p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_account_active();
  if not public.company_open(auth.uid()) then raise exception 'company closed' using errcode = 'P0007'; end if;
  insert into public.company_passes (from_id, to_id, mode) values (auth.uid(), p_to, 'company')
    on conflict (from_id, to_id, mode) do update set created_at = now();
end $$;

-- «Привет» is not a like: only a mutual one opens a chat.
create or replace function public.company_hello(p_to uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a uuid; b uuid; mid uuid;
begin
  perform public.assert_account_active();
  perform public.check_rate_limit('company_hello');
  if p_to is null or p_to = me then raise exception 'not available' using errcode = 'P0002'; end if;
  if not public.company_open(me) then raise exception 'company closed' using errcode = 'P0007'; end if;
  if not public.company_open(p_to) or public.is_blocked_pair(me, p_to) then raise exception 'not available' using errcode = 'P0002'; end if;
  insert into public.company_hellos (from_id, to_id, mode) values (me, p_to, 'company') on conflict do nothing;
  if not exists (select 1 from public.company_hellos where from_id = p_to and to_id = me and mode = 'company') then
    return jsonb_build_object('connected', false);
  end if;
  a := least(me, p_to); b := greatest(me, p_to);
  perform pg_advisory_xact_lock(hashtextextended('match-pair:' || a::text || ':' || b::text, 0));
  insert into public.matches (user_a, user_b, kind) values (a, b, 'company')
    on conflict (user_a, user_b) do update set ended_at = null, ended_by = null, kind = case when public.matches.ended_at is null then public.matches.kind else 'company' end
    returning id into mid;
  return jsonb_build_object('connected', true, 'match_id', mid);
end $$;

-- ---- couples ---------------------------------------------------------------------------------------------------

create or replace function public.couple_of(p_uid uuid) returns public.couples language sql stable security definer set search_path = public as $$
  select * from public.couples where status = 'active' and (user_a = p_uid or user_b = p_uid) limit 1
$$;

create or replace function public.couples_feed(p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles; mine public.couples;
begin
  perform public.assert_account_active();
  select * into me from public.profiles where id = auth.uid();
  select * into mine from public.couple_of(me.id);
  if mine.id is null or me.relationship_status <> 'couple' or me.paused then raise exception 'couples closed' using errcode = 'P0007'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.r) from (
      select jsonb_build_object('couple_id', c.id,
               'people', jsonb_build_array(
                 jsonb_build_object('id', pa.id, 'name', pa.display_name, 'age', pa.age, 'photo', (select ph.storage_path from public.profile_photos ph where ph.profile_id = pa.id and ph.kind = 'photo' order by ph.position limit 1)),
                 jsonb_build_object('id', pb.id, 'name', pb.display_name, 'age', pb.age, 'photo', (select ph.storage_path from public.profile_photos ph where ph.profile_id = pb.id and ph.kind = 'photo' order by ph.position limit 1))),
               'city', coalesce(pa.city, pb.city), 'about', coalesce(nullif(pa.bio, ''), pb.bio),
               'tags', (select coalesce(jsonb_agg(distinct i), '[]'::jsonb) from (select unnest(pa.interests || pb.interests) i limit 6) q),
               'said_hello', exists (select 1 from public.company_hellos h where h.mode = 'couples' and h.from_id in (pa.id, pb.id) and h.to_id in (mine.user_a, mine.user_b))) as j,
             random() as r
        from public.couples c join public.profiles pa on pa.id = c.user_a join public.profiles pb on pb.id = c.user_b
       where c.status = 'active' and c.id <> mine.id
         and pa.onboarding_done and pb.onboarding_done and not pa.paused and not pb.paused
         and pa.country is not distinct from me.country
         and (me.city is null or pa.city is null or lower(pa.city) = lower(me.city))
         and not public.is_blocked_pair(pa.id, me.id) and not public.is_blocked_pair(pb.id, me.id)
         and not public.is_blocked_pair(pa.id, case when me.id = mine.user_a then mine.user_b else mine.user_a end)
         and not public.is_blocked_pair(pb.id, case when me.id = mine.user_a then mine.user_b else mine.user_a end)
         and not exists (select 1 from public.company_hellos h where h.mode = 'couples' and h.from_id in (mine.user_a, mine.user_b) and h.to_id in (pa.id, pb.id))
         and not exists (select 1 from public.company_passes cp where cp.mode = 'couples' and cp.from_id in (mine.user_a, mine.user_b) and cp.to_id in (pa.id, pb.id) and cp.created_at > now() - interval '14 days')
       order by r limit least(greatest(coalesce(p_limit, 20), 1), 50)) x), '[]'::jsonb);
end $$;

create or replace function public.couples_pass(p_couple uuid) returns void
language plpgsql security definer set search_path = public as $$
declare mine public.couples; c public.couples;
begin
  perform public.assert_account_active();
  select * into mine from public.couple_of(auth.uid());
  select * into c from public.couples where id = p_couple and status = 'active';
  if mine.id is null or c.id is null then raise exception 'not available' using errcode = 'P0002'; end if;
  insert into public.company_passes (from_id, to_id, mode) values (auth.uid(), c.user_a, 'couples')
    on conflict (from_id, to_id, mode) do update set created_at = now();
end $$;

-- A couple says «позвать вчетвером»; if the other couple has already said it, the two people who pressed get a chat.
create or replace function public.couples_hello(p_couple uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mine public.couples; c public.couples; other uuid; a uuid; b uuid; mid uuid;
begin
  perform public.assert_account_active();
  perform public.check_rate_limit('company_hello');
  select * into mine from public.couple_of(me);
  select * into c from public.couples where id = p_couple and status = 'active';
  if mine.id is null then raise exception 'couples closed' using errcode = 'P0007'; end if;
  if c.id is null or c.id = mine.id or public.is_blocked_pair(me, c.user_a) or public.is_blocked_pair(me, c.user_b) then raise exception 'not available' using errcode = 'P0002'; end if;
  insert into public.company_hellos (from_id, to_id, mode) values (me, c.user_a, 'couples') on conflict do nothing;
  select h.from_id into other from public.company_hellos h
   where h.mode = 'couples' and h.from_id in (c.user_a, c.user_b) and h.to_id in (mine.user_a, mine.user_b) order by h.created_at limit 1;
  if other is null then return jsonb_build_object('connected', false); end if;
  a := least(me, other); b := greatest(me, other);
  perform pg_advisory_xact_lock(hashtextextended('match-pair:' || a::text || ':' || b::text, 0));
  insert into public.matches (user_a, user_b, kind) values (a, b, 'couples')
    on conflict (user_a, user_b) do update set ended_at = null, ended_by = null, kind = case when public.matches.ended_at is null then public.matches.kind else 'couples' end
    returning id into mid;
  return jsonb_build_object('connected', true, 'match_id', mid);
end $$;

-- «Где меня видно» also shows what the person looks for in company.
create or replace function public.my_modes() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', p.relationship_status, 'goals', to_jsonb(p.goals), 'dating', p.vis_dating,
    'company', p.vis_company, 'audience', p.company_audience, 'paused', p.paused,
    'dating_open', public.dating_eligible(p.id), 'dating_open_at', p.dating_open_at, 'status_changed_at', p.status_changed_at,
    'company_look', to_jsonb(p.company_look))
  from public.profiles p where p.id = auth.uid()
$$;

revoke all on function public.company_open(uuid), public.plans_attended(uuid), public.couple_of(uuid) from public, anon, authenticated;
revoke all on function public.set_company_look(text[]), public.company_feed(int), public.company_pass(uuid), public.company_hello(uuid),
  public.couples_feed(int), public.couples_pass(uuid), public.couples_hello(uuid) from public, anon;
grant execute on function public.set_company_look(text[]), public.company_feed(int), public.company_pass(uuid), public.company_hello(uuid),
  public.couples_feed(int), public.couples_pass(uuid), public.couples_hello(uuid) to authenticated;
