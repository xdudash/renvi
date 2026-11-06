-- Plans, round two: the 21:00 «всё ок?» check, polls inside the plan chat, and «позвать в компанию» after a plan.
-- Everything is reached through security-definer functions; the new tables have no client policies.

-- ---- 1. «Всё ок?» in the evening of the plan --------------------------------------------------------------------
-- A push to everyone who is in the plan (host + accepted) at 21:00 local time of the plan's day, or two hours after
-- the start when the plan begins late. One row per (plan, person) is the lock: nobody is asked twice.
alter table public.notification_prefs add column if not exists plan_check boolean not null default true;

create table if not exists public.plan_checks (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  answer text check (answer in ('ok', 'help')),
  answered_at timestamptz,
  primary key (plan_id, user_id)
);
alter table public.plan_checks enable row level security;
revoke all on public.plan_checks from public, anon, authenticated;

create or replace function public.plan_tz(p_country text) returns text language sql immutable as $$
  select case upper(coalesce(p_country, '')) when 'UA' then 'Europe/Kyiv' when 'CZ' then 'Europe/Prague' else 'Europe/Bratislava' end
$$;

create or replace function public.plan_check_due_at(p public.plans) returns timestamptz language sql stable as $$
  select greatest(
    (((p.starts_at at time zone public.plan_tz(p.country))::date + time '21:00') at time zone public.plan_tz(p.country)),
    p.starts_at + interval '2 hours')
$$;

-- Who should be asked right now: due, not older than 6 hours past due, a plan that really had somebody besides the host.
create or replace function public.plan_check_candidates(p_limit int default 500)
returns table (plan_id uuid, user_id uuid, language text)
language sql stable security definer set search_path = public as $$
  select x.plan_id, x.user_id, x.language from (
    select p.id as plan_id, pr.id as user_id, pr.language
      from public.plans p
      cross join lateral (select p.host_id as uid union select m.user_id from public.plan_members m where m.plan_id = p.id and m.status = 'going') who
      join public.profiles pr on pr.id = who.uid
      left join public.notification_prefs np on np.user_id = pr.id
     where p.status = 'active'
       and public.plan_check_due_at(p) <= now() and now() < public.plan_check_due_at(p) + interval '6 hours'
       and exists (select 1 from public.plan_members m where m.plan_id = p.id and m.status = 'going')
       and coalesce(np.plan_check, true)
       and exists (select 1 from public.push_tokens t where t.user_id = pr.id)
       and (pr.suspended_until is null or pr.suspended_until < now())
       and (pr.blocked_until is null or pr.blocked_until < now())
       and not exists (select 1 from public.plan_checks c where c.plan_id = p.id and c.user_id = pr.id)
  ) x
  order by x.plan_id, x.user_id
  limit greatest(1, least(p_limit, 1000))
$$;

-- Claims (plan, user) pairs BEFORE sending, so two overlapping runs never send the same person twice.
create or replace function public.plan_check_claim(p_plans uuid[], p_users uuid[]) returns table (plan_id uuid, user_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('plan_check_claim'));
  return query
    insert into public.plan_checks (plan_id, user_id)
    select x.p, x.u from unnest(p_plans, p_users) as x(p, u)
    on conflict do nothing
    returning plan_checks.plan_id, plan_checks.user_id;
end $$;

-- Has this person been asked, and what did they answer? (null = never asked)
create or replace function public.plan_check_mine(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.plan_checks;
begin
  select * into c from public.plan_checks where plan_id = p_plan and user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object('answer', c.answer, 'sent_at', c.sent_at);
end $$;

create or replace function public.plan_check_answer(p_plan uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_account_active();
  update public.plan_checks set answer = case when p_ok then 'ok' else 'help' end, answered_at = now()
   where plan_id = p_plan and user_id = auth.uid();
  if not found then raise exception 'not available' using errcode = 'P0002'; end if;
end $$;

-- ---- 2. Polls in the plan chat ------------------------------------------------------------------------------------
create table if not exists public.plan_polls (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  question text not null check (char_length(question) between 3 and 120),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists plan_polls_plan_idx on public.plan_polls (plan_id, created_at);
create table if not exists public.plan_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.plan_polls(id) on delete cascade,
  position smallint not null,
  label text not null check (char_length(label) between 1 and 60)
);
create index if not exists plan_poll_options_idx on public.plan_poll_options (poll_id, position);
create table if not exists public.plan_poll_votes (
  poll_id uuid not null references public.plan_polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_id uuid not null references public.plan_poll_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table public.plan_polls enable row level security;
alter table public.plan_poll_options enable row level security;
alter table public.plan_poll_votes enable row level security;
revoke all on public.plan_polls, public.plan_poll_options, public.plan_poll_votes from public, anon, authenticated;

-- Any member of a plan that is not cancelled may ask; at most 3 open polls at a time, 2..6 short options.
create or replace function public.plan_poll_create(p_plan uuid, p_question text, p_options text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); q text := trim(coalesce(p_question, '')); pid uuid; o text; i int := 0; clean text[] := '{}';
begin
  perform public.assert_account_active();
  if not public.plan_is_member(p_plan, me) or not exists (select 1 from public.plans where id = p_plan and status = 'active') then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  foreach o in array coalesce(p_options, '{}') loop
    o := trim(coalesce(o, ''));
    if o <> '' then clean := clean || o; end if;
  end loop;
  if char_length(q) not between 3 and 120 or coalesce(array_length(clean, 1), 0) not between 2 and 6
     or exists (select 1 from unnest(clean) c where char_length(c) > 60) then
    raise exception 'bad poll' using errcode = '22023';
  end if;
  if (select count(*) from public.plan_polls where plan_id = p_plan and closed_at is null) >= 3 then
    raise exception 'too many open polls' using errcode = 'P0006';
  end if;
  perform public.check_rate_limit('plan_message');
  insert into public.plan_polls (plan_id, author_id, question) values (p_plan, me, public.filter_words(q)) returning id into pid;
  foreach o in array clean loop
    i := i + 1;
    insert into public.plan_poll_options (poll_id, position, label) values (pid, i, public.filter_words(o));
  end loop;
  return pid;
end $$;

create or replace function public.plan_poll_vote(p_poll uuid, p_option uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pl public.plan_polls;
begin
  perform public.assert_account_active();
  select * into pl from public.plan_polls where id = p_poll;
  if not found or not public.plan_is_member(pl.plan_id, me) then raise exception 'not available' using errcode = 'P0002'; end if;
  if pl.closed_at is not null then raise exception 'poll closed' using errcode = 'P0007'; end if;
  if not exists (select 1 from public.plan_poll_options where id = p_option and poll_id = p_poll) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  perform public.check_rate_limit('plan_message');
  insert into public.plan_poll_votes (poll_id, user_id, option_id) values (p_poll, me, p_option)
    on conflict (poll_id, user_id) do update set option_id = excluded.option_id, created_at = now();
end $$;

-- The author or the host closes a poll; the result stays visible.
create or replace function public.plan_poll_close(p_poll uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pl public.plan_polls;
begin
  select * into pl from public.plan_polls where id = p_poll;
  if not found or not (pl.author_id = me or exists (select 1 from public.plans where id = pl.plan_id and host_id = me)) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  update public.plan_polls set closed_at = coalesce(closed_at, now()) where id = p_poll;
end $$;

-- Polls of a plan with counts and my own choice. Only members see them; only counts are shown, never who voted what.
create or replace function public.plan_polls_list(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not public.plan_is_member(p_plan, me) then raise exception 'not available' using errcode = 'P0002'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pl.id, 'question', pl.question, 'closed', pl.closed_at is not null, 'mine', pl.author_id = me,
      'author', (select display_name from public.profiles where id = pl.author_id),
      'my_option', (select v.option_id from public.plan_poll_votes v where v.poll_id = pl.id and v.user_id = me),
      'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label,
                    'votes', (select count(*) from public.plan_poll_votes v where v.option_id = o.id)) order by o.position)
                  from public.plan_poll_options o where o.poll_id = pl.id)
    ) order by pl.created_at desc)
    from public.plan_polls pl where pl.plan_id = p_plan), '[]'::jsonb);
end $$;

-- ---- 3. «Позвать в компанию» after a plan ---------------------------------------------------------------------------
-- Both were in the plan, the plan has started, the other person came (or is the host). Then it is an ordinary company
-- hello: only a mutual hello opens a chat, blocks and closed modes are enforced by company_hello itself.
create or replace function public.plan_company_hello(p_plan uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  perform public.assert_account_active();
  if p_user is null or p_user = me
     or not exists (select 1 from public.plans where id = p_plan and starts_at <= now())
     or not public.plan_is_member(p_plan, me) or not public.plan_is_member(p_plan, p_user)
     or not (exists (select 1 from public.plans where id = p_plan and host_id = p_user)
             or exists (select 1 from public.plan_members where plan_id = p_plan and user_id = p_user and status = 'going' and arrived_at is not null)) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  return public.company_hello(p_user);
end $$;

-- ---- grants (service role keeps the sending side; clients only get their own calls) ---------------------------------
revoke all on function public.plan_tz(text), public.plan_check_due_at(public.plans), public.plan_check_candidates(int),
  public.plan_check_claim(uuid[], uuid[]), public.plan_check_mine(uuid), public.plan_check_answer(uuid, boolean),
  public.plan_poll_create(uuid, text, text[]), public.plan_poll_vote(uuid, uuid), public.plan_poll_close(uuid),
  public.plan_polls_list(uuid), public.plan_company_hello(uuid, uuid) from public, anon, authenticated;
grant execute on function public.plan_check_candidates(int), public.plan_check_claim(uuid[], uuid[]) to service_role;
grant execute on function public.plan_check_mine(uuid), public.plan_check_answer(uuid, boolean),
  public.plan_poll_create(uuid, text, text[]), public.plan_poll_vote(uuid, uuid), public.plan_poll_close(uuid),
  public.plan_polls_list(uuid), public.plan_company_hello(uuid, uuid) to authenticated;
