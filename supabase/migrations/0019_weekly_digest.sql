-- Weekly digest: a push (and optional e-mail) telling an active user how many NEW profiles in their own country
-- match their seeking and filters this week. The notification never carries names, photos or other personal data.
-- Counting runs only for the service role (Edge Function weekly-digest); clients can touch nothing but their own opt-outs.

-- ---------- 1. Opt-outs (own row of notification_prefs; its RLS from 0007 already limits it to auth.uid()) ----------
alter table public.notification_prefs
  add column digest_push boolean not null default true,
  add column digest_email boolean not null default false;

-- ---------- 2. When a profile became visible ("new this week") ----------
alter table public.profiles add column published_at timestamptz;
update public.profiles set published_at = created_at where onboarding_done;

-- Server-owned: set when onboarding_done flips to true; a client can never change it.
create or replace function public.profiles_set_published_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.published_at := case when new.onboarding_done then now() end;
  elsif new.onboarding_done and not old.onboarding_done then
    new.published_at := now();
  elsif current_user in ('postgres','service_role','supabase_admin') then
    null; -- maintenance (backfills, support) may correct the value; clients cannot
  else
    new.published_at := old.published_at;
  end if;
  return new;
end $$;
create trigger profiles_published_at before insert or update on public.profiles
  for each row execute function public.profiles_set_published_at();
revoke execute on function public.profiles_set_published_at() from public, anon, authenticated;
create index profiles_country_published_idx on public.profiles (country, published_at) where onboarding_done;

-- ---------- 3. Send log: at most one digest per user per 7 days ----------
create table public.digest_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  new_count int not null check (new_count > 0),
  push_sent boolean not null default false,
  email_sent boolean not null default false
);
create index digest_log_user_idx on public.digest_log (user_id, sent_at desc);
alter table public.digest_log enable row level security;
revoke all on public.digest_log from public, anon, authenticated;
grant all on public.digest_log to service_role;

-- ---------- 4. Config ----------
-- weekday: 0 = Sunday .. 6 = Saturday (UTC); the function sends from hour_utc onwards on that day.
insert into public.app_config (key, value) values ('digest', '{"enabled": true, "weekday": 0, "hour_utc": 17}')
  on conflict (key) do nothing;

create or replace function public.digest_due_now(p_now timestamptz default now()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (c.value ->> 'enabled')::boolean
    and extract(dow from p_now at time zone 'UTC')::int = coalesce((c.value ->> 'weekday')::int, 0)
    and extract(hour from p_now at time zone 'UTC')::int >= coalesce((c.value ->> 'hour_utc')::int, 17),
    false)
  from public.app_config c where c.key = 'digest'
$$;

-- ---------- 5. Counting ----------
-- Same rules as discover() (0005) seen from p_user's side. profile_is_visible()/is_blocked_pair() read auth.uid(),
-- so the visibility conditions are repeated here for an explicit user. Incognito profiles are never counted
-- (discover shows them only to people they sparked; a count would leak that they exist).
create or replace function public.digest_new_count(p_user uuid, p_since timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.profiles me
  join public.profiles p on p.id <> me.id
  where me.id = p_user
    and p.onboarding_done and not p.paused
    and p.published_at > p_since
    and p.country = me.country
    and (p.suspended_until is null or p.suspended_until < now())
    and not p.incognito
    and p.age between me.filter_age_min and me.filter_age_max
    and p.intent = any (me.filter_intents)
    and (not me.filter_verified_only or p.verification_status = 'approved')
    and coalesce(public.distance_km(me.id, p.id), 0) <= me.filter_distance_km
    and (me.seeking = 'everyone' or (me.seeking = 'men' and p.gender = 'man') or (me.seeking = 'women' and p.gender = 'woman'))
    and (p.seeking = 'everyone' or (p.seeking = 'men' and me.gender = 'man') or (p.seeking = 'women' and me.gender = 'woman'))
    and not exists (select 1 from public.blocks b
                    where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
    and not exists (select 1 from public.passes x where x.from_id = me.id and x.to_id = p.id)
    and not exists (select 1 from public.sparks s where s.from_id = me.id and s.to_id = p.id)
    and not exists (select 1 from public.matches m where m.ended_at is null
                    and ((m.user_a = me.id and m.user_b = p.id) or (m.user_b = me.id and m.user_a = p.id)))
$$;

-- Users who should get a digest now: active, not digested in the last 7 days, at least one deliverable channel
-- that they have not opted out of, and at least one new matching profile. Returns the e-mail address only for
-- users who opted in to e-mail. Does nothing when the digest is disabled in app_config.
create or replace function public.weekly_digest_candidates(p_limit int default 500)
returns table (user_id uuid, new_count int, language text, send_push boolean, send_email boolean, email text)
language sql stable security definer set search_path = public as $$
  with cand as (
    select me.id, me.language,
           coalesce(np.digest_push, true) and exists (select 1 from public.push_tokens t where t.user_id = me.id) as push_ok,
           coalesce(np.digest_email, false) and u.email is not null and u.email_confirmed_at is not null as email_ok,
           u.email
    from public.profiles me
    join auth.users u on u.id = me.id
    left join public.notification_prefs np on np.user_id = me.id
    where exists (select 1 from public.app_config c where c.key = 'digest' and coalesce((c.value ->> 'enabled')::boolean, false))
      and me.onboarding_done and not me.paused
      and (me.suspended_until is null or me.suspended_until < now())
      and (me.blocked_until is null or me.blocked_until < now())
      and not exists (select 1 from public.digest_log l where l.user_id = me.id and l.sent_at > now() - interval '7 days')
  )
  select c.id, n.cnt, c.language, c.push_ok, c.email_ok, case when c.email_ok then c.email end
  from cand c
  cross join lateral (select public.digest_new_count(c.id, now() - interval '7 days') as cnt) n
  where (c.push_ok or c.email_ok) and n.cnt > 0
  order by c.id
  limit greatest(1, least(p_limit, 1000))
$$;

-- Claims the 7-day slot for each (user, count) pair BEFORE anything is sent, so two overlapping runs can never
-- send twice. Returns the users that were actually claimed.
create or replace function public.digest_claim(p_users uuid[], p_counts int[]) returns setof uuid
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('weekly_digest_claim'));
  return query
    insert into public.digest_log (user_id, new_count)
    select x.u, x.c from unnest(p_users, p_counts) as x(u, c)
    where x.c > 0 and not exists (select 1 from public.digest_log l where l.user_id = x.u and l.sent_at > now() - interval '7 days')
    returning digest_log.user_id;
end $$;

create or replace function public.digest_mark_sent(p_users uuid[], p_push boolean, p_email boolean) returns void
language sql security definer set search_path = public as $$
  update public.digest_log set push_sent = push_sent or p_push, email_sent = email_sent or p_email
  where user_id = any (p_users) and sent_at > now() - interval '1 hour'
$$;

-- Service role only (0014 revokes the default EXECUTE grants on existing functions; new ones need it explicitly).
revoke execute on function public.digest_due_now(timestamptz), public.digest_new_count(uuid, timestamptz),
  public.weekly_digest_candidates(int), public.digest_claim(uuid[], int[]), public.digest_mark_sent(uuid[], boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.digest_due_now(timestamptz), public.digest_new_count(uuid, timestamptz),
  public.weekly_digest_candidates(int), public.digest_claim(uuid[], int[]), public.digest_mark_sent(uuid[], boolean, boolean)
  to service_role;
