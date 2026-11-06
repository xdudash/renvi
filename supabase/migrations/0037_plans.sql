-- Block P: plans («Планы») — public meetups with a host, a request-and-approve flow and a group chat.
-- Everything goes through security-definer functions: the table has no client policies, so the exact place of a plan
-- cannot be read by anyone but the host and the people the host accepted.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('market','rink','mountains','thermal','club','quiz','sport','games','cinema','food','culture','trip','meet','other')),
  title text not null check (char_length(title) between 3 and 80),
  starts_at timestamptz not null,
  price_text text check (price_text is null or char_length(price_text) <= 40),
  area text not null check (char_length(area) between 2 and 60),
  place text not null check (char_length(place) between 3 and 120),
  city text,
  country text,
  max_people smallint not null check (max_people between 2 and 30),
  audience text not null default 'all' check (audience in ('all','women','men','couples')),
  age_min smallint check (age_min is null or age_min between 18 and 99),
  age_max smallint check (age_max is null or age_max between 18 and 99),
  description text check (description is null or char_length(description) <= 600),
  bring text[] not null default '{}',
  auto_accept boolean not null default false,
  status text not null default 'active' check (status in ('active','cancelled')),
  boosted_until timestamptz,
  created_at timestamptz not null default now(),
  check (age_min is null or age_max is null or age_min <= age_max)
);
create index if not exists plans_feed_idx on public.plans (status, starts_at);
create index if not exists plans_host_idx on public.plans (host_id, starts_at);
alter table public.plans enable row level security;
revoke all on public.plans from public, anon, authenticated;

create table if not exists public.plan_members (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','going','declined','cancelled','left')),
  message text check (message is null or char_length(message) <= 200),
  arrived_at timestamptz,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (plan_id, user_id)
);
create index if not exists plan_members_user_idx on public.plan_members (user_id, status);
alter table public.plan_members enable row level security;
revoke all on public.plan_members from public, anon, authenticated;

create table if not exists public.plan_ratings (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating text not null check (rating in ('meh','ok','fire')),
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
alter table public.plan_ratings enable row level security;
revoke all on public.plan_ratings from public, anon, authenticated;

create table if not exists public.plan_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists plan_messages_idx on public.plan_messages (plan_id, created_at);
alter table public.plan_messages enable row level security;
revoke all on public.plan_messages from public, anon, authenticated;

-- Hourly limits (see check_rate_limit).
update public.app_config set value = value || '{"plan_create": 6, "plan_request": 30, "plan_message": 200}'::jsonb where key = 'rate_limits';

-- ---- helpers --------------------------------------------------------------------------------------------------

-- Free accounts: 2 active plans at the same time. Plus raises it (patched when entitlements exist).
create or replace function public.plan_limit_for(p_uid uuid) returns int language sql stable as $$ select 2 $$;

-- A plan is "open" while it is active and has not ended (3 hours after the start).
create or replace function public.plan_is_open(p public.plans) returns boolean language sql stable as $$
  select p.status = 'active' and p.starts_at > now() - interval '3 hours'
$$;

create or replace function public.plan_going(p_plan uuid) returns int language sql stable security definer set search_path = public as $$
  select 1 + (select count(*)::int from public.plan_members where plan_id = p_plan and status = 'going')
$$;

create or replace function public.plan_is_member(p_plan uuid, p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plans where id = p_plan and host_id = p_uid)
      or exists (select 1 from public.plan_members where plan_id = p_plan and user_id = p_uid and status = 'going')
$$;

-- May this person see (and ask to join) the plan? Audience, age, blocks and city are all decided here.
create or replace function public.plan_can_see(p public.plans, p_uid uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  if p.host_id = p_uid then return true; end if;
  select * into me from public.profiles where id = p_uid;
  if not found or not me.onboarding_done or me.paused then return false; end if;
  if public.is_blocked_pair(p.host_id, p_uid) then return false; end if;
  if p.audience = 'women' and me.gender is distinct from 'woman' then return false; end if;
  if p.audience = 'men' and me.gender is distinct from 'man' then return false; end if;
  if p.audience = 'couples' and me.relationship_status is distinct from 'couple' then return false; end if;
  if p.age_min is not null and (me.age is null or me.age < p.age_min) then return false; end if;
  if p.age_max is not null and (me.age is null or me.age > p.age_max) then return false; end if;
  if p.city is not null and me.city is not null and lower(p.city) <> lower(me.city) then return false; end if;
  return true;
end $$;

create or replace function public.plan_json(p public.plans, p_uid uuid, p_full boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h public.profiles; mem public.plan_members; seen boolean; faces jsonb;
begin
  select * into h from public.profiles where id = p.host_id;
  select * into mem from public.plan_members where plan_id = p.id and user_id = p_uid;
  seen := p.host_id = p_uid or coalesce(mem.status = 'going', false);
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.display_name) order by x.created_at), '[]'::jsonb) into faces
    from (select pr.id, pr.display_name, m.created_at from public.plan_members m join public.profiles pr on pr.id = m.user_id
           where m.plan_id = p.id and m.status = 'going' order by m.created_at limit 5) x;
  return jsonb_build_object(
    'id', p.id, 'category', p.category, 'title', p.title, 'starts_at', p.starts_at, 'price_text', p.price_text,
    'area', p.area, 'place', case when seen then p.place end, 'place_hidden', not seen,
    'max_people', p.max_people, 'going', public.plan_going(p.id), 'audience', p.audience, 'age_min', p.age_min, 'age_max', p.age_max,
    'description', p.description, 'bring', to_jsonb(p.bring), 'auto_accept', p.auto_accept, 'status', p.status,
    'open', public.plan_is_open(p), 'boosted', coalesce(p.boosted_until > now(), false),
    'host', jsonb_build_object('id', h.id, 'name', h.display_name, 'age', h.age),
    'is_host', p.host_id = p_uid, 'my_status', case when p.host_id = p_uid then 'host' else mem.status end,
    'pending', case when p.host_id = p_uid then (select count(*) from public.plan_members x where x.plan_id = p.id and x.status = 'pending') end,
    'faces', faces);
end $$;

-- ---- feed and detail ------------------------------------------------------------------------------------------

create or replace function public.plans_feed(p_category text default null, p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(public.plan_json(p, me) order by (coalesce(p.boosted_until > now(), false)) desc, p.starts_at)
      from (select * from public.plans
             where status = 'active' and starts_at > now() - interval '3 hours'
               and (p_category is null or category = p_category)
               and (p_from is null or starts_at >= p_from) and (p_to is null or starts_at < p_to)
             order by starts_at limit 200) p
     where public.plan_can_see(p, me)), '[]'::jsonb);
end $$;

create or replace function public.plan_detail(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.plans; stats jsonb;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into p from public.plans where id = p_plan;
  if not found or not (public.plan_can_see(p, me) or public.plan_is_member(p.id, me)
                       or exists (select 1 from public.plan_members where plan_id = p.id and user_id = me)) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  select jsonb_build_object(
    'plans', (select count(*) from public.plans h where h.host_id = p.host_id and h.status = 'active' and h.starts_at < now() - interval '3 hours'),
    'people', (select count(*) from public.plan_members m join public.plans h on h.id = m.plan_id
                where h.host_id = p.host_id and h.status = 'active' and m.status = 'going' and h.starts_at < now() - interval '3 hours')) into stats;
  return public.plan_json(p, me, true) || jsonb_build_object('host_stats', stats);
end $$;

-- ---- create / edit / cancel -----------------------------------------------------------------------------------

create or replace function public.plan_create(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); h public.profiles; r public.plans; n int; t text; pl text;
begin
  perform public.assert_account_active();
  perform public.check_rate_limit('plan_create');
  select * into h from public.profiles where id = me;
  if not found or not h.onboarding_done then raise exception 'profile incomplete' using errcode = '42501'; end if;
  select count(*) into n from public.plans where host_id = me and status = 'active' and starts_at > now() - interval '3 hours';
  if n >= public.plan_limit_for(me) then raise exception 'plan limit' using errcode = 'P0008'; end if;
  t := trim(coalesce(p_data->>'title', ''));
  if char_length(t) < 3 or char_length(t) > 80 then raise exception 'bad title' using errcode = '22023'; end if;
  pl := trim(coalesce(p_data->>'place', ''));
  if (p_data->>'starts_at')::timestamptz <= now() then raise exception 'start must be in the future' using errcode = '22023'; end if;
  insert into public.plans (host_id, category, title, starts_at, price_text, area, place, city, country, max_people, audience, age_min, age_max, description, bring, auto_accept)
  values (me, p_data->>'category', public.filter_words(t), (p_data->>'starts_at')::timestamptz, nullif(trim(p_data->>'price_text'), ''),
          trim(coalesce(p_data->>'area', '')), pl, h.city, h.country, (p_data->>'max_people')::smallint, coalesce(p_data->>'audience', 'all'),
          nullif(p_data->>'age_min', '')::smallint, nullif(p_data->>'age_max', '')::smallint,
          public.filter_words(nullif(trim(p_data->>'description'), '')),
          coalesce(array(select jsonb_array_elements_text(coalesce(p_data->'bring', '[]'::jsonb))), '{}'),
          coalesce((p_data->>'auto_accept')::boolean, false))
  returning * into r;
  return public.plan_json(r, me, true);
end $$;

create or replace function public.plan_set_auto(p_plan uuid, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.plans set auto_accept = p_auto where id = p_plan and host_id = auth.uid();
  if not found then raise exception 'not available' using errcode = 'P0002'; end if;
end $$;

create or replace function public.plan_cancel(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.plans set status = 'cancelled' where id = p_plan and host_id = auth.uid() and status = 'active';
  if not found then raise exception 'not available' using errcode = 'P0002'; end if;
end $$;

-- ---- requests -------------------------------------------------------------------------------------------------

create or replace function public.plan_request(p_plan uuid, p_message text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.plans; m public.plan_members; st text;
begin
  perform public.assert_account_active();
  perform public.check_rate_limit('plan_request');
  select * into p from public.plans where id = p_plan for update;
  if not found or p.host_id = me or not public.plan_is_open(p) or not public.plan_can_see(p, me) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  select * into m from public.plan_members where plan_id = p_plan and user_id = me;
  if found and m.status in ('pending','going') then raise exception 'already requested' using errcode = 'P0005'; end if;
  if found and m.status = 'declined' then raise exception 'not available' using errcode = 'P0002'; end if;
  if public.plan_going(p.id) >= p.max_people then raise exception 'plan is full' using errcode = 'P0009'; end if;
  st := case when p.auto_accept then 'going' else 'pending' end;
  insert into public.plan_members (plan_id, user_id, status, message, decided_at)
    values (p_plan, me, st, public.filter_words(nullif(trim(p_message), '')), case when p.auto_accept then now() end)
    on conflict (plan_id, user_id) do update set status = excluded.status, message = excluded.message, decided_at = excluded.decided_at, created_at = now();
  return jsonb_build_object('status', st);
end $$;

create or replace function public.plan_decide(p_plan uuid, p_user uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.plans;
begin
  select * into p from public.plans where id = p_plan and host_id = me for update;
  if not found then raise exception 'not available' using errcode = 'P0002'; end if;
  if p_accept and public.plan_going(p.id) >= p.max_people then raise exception 'plan is full' using errcode = 'P0009'; end if;
  update public.plan_members set status = case when p_accept then 'going' else 'declined' end, decided_at = now()
    where plan_id = p_plan and user_id = p_user and status = 'pending';
  if not found then raise exception 'not available' using errcode = 'P0002'; end if;
  return jsonb_build_object('going', public.plan_going(p.id));
end $$;

create or replace function public.plan_withdraw(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.plan_members set status = case when status = 'pending' then 'cancelled' else 'left' end, decided_at = now()
    where plan_id = p_plan and user_id = auth.uid() and status in ('pending','going');
  if not found then raise exception 'not available' using errcode = 'P0002'; end if;
end $$;

create or replace function public.plan_requests(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from public.plans where id = p_plan and host_id = me) then raise exception 'not available' using errcode = 'P0002'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', pr.display_name, 'age', pr.age, 'message', m.message,
            'status', pr.relationship_status,
            'plans', (select count(*) from public.plan_members x join public.plans h on h.id = x.plan_id
                       where x.user_id = m.user_id and x.status = 'going' and h.starts_at < now() - interval '3 hours' and h.status = 'active'))
            order by m.created_at)
     from public.plan_members m join public.profiles pr on pr.id = m.user_id
    where m.plan_id = p_plan and m.status = 'pending'), '[]'::jsonb);
end $$;

-- ---- my plans / day of the plan / after ---------------------------------------------------------------------

create or replace function public.plans_mine() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  return jsonb_build_object(
    'going', coalesce((select jsonb_agg(public.plan_json(p, me) order by p.starts_at) from public.plans p
        join public.plan_members m on m.plan_id = p.id and m.user_id = me and m.status in ('going','pending')
        where public.plan_is_open(p)), '[]'::jsonb),
    'hosting', coalesce((select jsonb_agg(public.plan_json(p, me) order by p.starts_at)
        from public.plans p where p.host_id = me and public.plan_is_open(p)), '[]'::jsonb),
    'past', coalesce((select jsonb_agg(public.plan_json(p, me) || jsonb_build_object('my_rating', (select rating from public.plan_ratings r where r.plan_id = p.id and r.user_id = me)) order by p.starts_at desc)
        from (select pl.* from public.plans pl where pl.status = 'active' and pl.starts_at <= now() - interval '3 hours'
               and (pl.host_id = me or exists (select 1 from public.plan_members m where m.plan_id = pl.id and m.user_id = me and m.status = 'going'))
               order by pl.starts_at desc limit 30) p), '[]'::jsonb));
end $$;

create or replace function public.plan_checkin(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.plans;
begin
  select * into p from public.plans where id = p_plan and status = 'active';
  if not found or p.starts_at - interval '2 hours' > now() or p.starts_at + interval '4 hours' < now() then raise exception 'not available' using errcode = 'P0002'; end if;
  if p.host_id = me then return; end if;
  update public.plan_members set arrived_at = coalesce(arrived_at, now()) where plan_id = p_plan and user_id = me and status = 'going';
  if not found then raise exception 'not available' using errcode = 'P0002'; end if;
end $$;

-- Who is already there, for the day-of screen (names only).
create or replace function public.plan_arrivals(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not public.plan_is_member(p_plan, me) then raise exception 'not available' using errcode = 'P0002'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('name', pr.display_name, 'here', m.arrived_at is not null) order by m.created_at)
    from public.plan_members m join public.profiles pr on pr.id = m.user_id where m.plan_id = p_plan and m.status = 'going'), '[]'::jsonb);
end $$;

create or replace function public.plan_rate(p_plan uuid, p_rating text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.plans;
begin
  if p_rating not in ('meh','ok','fire') then raise exception 'bad rating' using errcode = '22023'; end if;
  select * into p from public.plans where id = p_plan;
  if not found or p.starts_at > now() or not public.plan_is_member(p_plan, me) then raise exception 'not available' using errcode = 'P0002'; end if;
  insert into public.plan_ratings (plan_id, user_id, rating) values (p_plan, me, p_rating)
    on conflict (plan_id, user_id) do update set rating = excluded.rating, created_at = now();
end $$;

-- People of a finished plan (host + accepted), so they can be remembered.
create or replace function public.plan_people(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not public.plan_is_member(p_plan, me) then raise exception 'not available' using errcode = 'P0002'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', x.id, 'name', x.display_name, 'age', x.age, 'host', x.host, 'came', x.came) order by x.host desc, x.display_name)
    from (select pr.id, pr.display_name, pr.age, true as host, true as came from public.plans p join public.profiles pr on pr.id = p.host_id where p.id = p_plan and pr.id <> me
          union all
          select pr.id, pr.display_name, pr.age, false, m.arrived_at is not null from public.plan_members m join public.profiles pr on pr.id = m.user_id
           where m.plan_id = p_plan and m.status = 'going' and pr.id <> me) x), '[]'::jsonb);
end $$;

-- ---- group chat -----------------------------------------------------------------------------------------------

create or replace function public.plan_chat(p_plan uuid, p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not public.plan_is_member(p_plan, me) then raise exception 'not available' using errcode = 'P0002'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'user_id', x.user_id, 'name', x.display_name, 'host', x.host, 'body', x.body, 'created_at', x.created_at) order by x.created_at)
    from (select m.id, m.user_id, pr.display_name, (p.host_id = m.user_id) as host, m.body, m.created_at
            from public.plan_messages m join public.profiles pr on pr.id = m.user_id join public.plans p on p.id = m.plan_id
           where m.plan_id = p_plan and not public.is_blocked_pair(me, m.user_id)
           order by m.created_at desc limit greatest(1, least(coalesce(p_limit, 100), 200))) x), '[]'::jsonb);
end $$;

create or replace function public.plan_chat_send(p_plan uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b text := trim(coalesce(p_body, ''));
begin
  perform public.assert_account_active();
  if not public.plan_is_member(p_plan, me) then raise exception 'not available' using errcode = 'P0002'; end if;
  if b = '' or char_length(b) > 1000 then raise exception 'bad message' using errcode = '22023'; end if;
  perform public.check_rate_limit('plan_message');
  insert into public.plan_messages (plan_id, user_id, body) values (p_plan, me, public.filter_words(b));
end $$;

-- Members read the chat live; the policy only answers "is this person in the plan".
create policy plan_messages_read on public.plan_messages for select to authenticated using (public.plan_is_member(plan_id, auth.uid()));
grant select on public.plan_messages to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_messages') then
    execute 'alter publication supabase_realtime add table public.plan_messages';
  end if;
end $$;

-- ---- grants ---------------------------------------------------------------------------------------------------
revoke all on function public.plan_limit_for(uuid), public.plan_is_open(public.plans), public.plan_going(uuid), public.plan_is_member(uuid, uuid),
  public.plan_can_see(public.plans, uuid), public.plan_json(public.plans, uuid, boolean) from public, anon, authenticated;
grant execute on function public.plan_is_member(uuid, uuid) to authenticated; -- used by the chat read policy
revoke all on function public.plans_feed(text, timestamptz, timestamptz), public.plan_detail(uuid), public.plan_create(jsonb), public.plan_set_auto(uuid, boolean),
  public.plan_cancel(uuid), public.plan_request(uuid, text), public.plan_decide(uuid, uuid, boolean), public.plan_withdraw(uuid), public.plan_requests(uuid),
  public.plans_mine(), public.plan_checkin(uuid), public.plan_arrivals(uuid), public.plan_rate(uuid, text), public.plan_people(uuid),
  public.plan_chat(uuid, int), public.plan_chat_send(uuid, text) from public, anon;
grant execute on function public.plans_feed(text, timestamptz, timestamptz), public.plan_detail(uuid), public.plan_create(jsonb), public.plan_set_auto(uuid, boolean),
  public.plan_cancel(uuid), public.plan_request(uuid, text), public.plan_decide(uuid, uuid, boolean), public.plan_withdraw(uuid), public.plan_requests(uuid),
  public.plans_mine(), public.plan_checkin(uuid), public.plan_arrivals(uuid), public.plan_rate(uuid, text), public.plan_people(uuid),
  public.plan_chat(uuid, int), public.plan_chat_send(uuid, text) to authenticated;
