-- First-party, opt-in, authenticated analytics. No historical backfill or anonymous fingerprint.
create table public.analytics_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false, updated_at timestamptz not null default now()
);
create table public.analytics_sessions (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null, started_at timestamptz not null default clock_timestamp(),
 last_seen_at timestamptz not null default clock_timestamp(), active_seconds integer not null default 0,
 primary key(user_id,id)
);
create table public.analytics_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid, event text not null check(event in ('screen_view','heartbeat','onboard','like','match','date')),
 screen text check(screen in ('index','welcome','signin','signup','onboarding','discover','likes','matches','chat','profile','settings','privacy-data','date','match','subscription','admin','other')),
 active_seconds integer not null default 0 check(active_seconds between 0 and 30),
 created_at timestamptz not null default clock_timestamp()
);
create index analytics_events_user_time on public.analytics_events(user_id,created_at);
create index analytics_events_time on public.analytics_events(created_at);
create index analytics_sessions_seen on public.analytics_sessions(last_seen_at);
create table public.analytics_acquisition (
 user_id uuid primary key references auth.users(id) on delete cascade,
 source text check(source ~ '^[a-zA-Z0-9_-]{1,64}$'), medium text check(medium ~ '^[a-zA-Z0-9_-]{1,64}$'),
 campaign text check(campaign ~ '^[a-zA-Z0-9_-]{1,64}$'), referral text check(referral ~ '^[a-zA-Z0-9_-]{1,64}$'),
 captured_at timestamptz not null default now()
);
alter table public.analytics_preferences enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_acquisition enable row level security;
revoke all on public.analytics_preferences,public.analytics_sessions,public.analytics_events,public.analytics_acquisition from anon,authenticated;

create function public.analytics_consent() returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select enabled from public.analytics_preferences where user_id=auth.uid()),false)
$$;
create function public.analytics_set_consent(p_enabled boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'consent required'; end if;
 -- Serialize ingestion/revocation on the preference row. No in-flight insert can survive revocation.
 insert into public.analytics_preferences(user_id,enabled) values(auth.uid(),p_enabled)
 on conflict(user_id) do update set enabled=excluded.enabled,updated_at=clock_timestamp();
 if not p_enabled then
  delete from public.analytics_events where user_id=auth.uid();
  delete from public.analytics_sessions where user_id=auth.uid();
  delete from public.analytics_acquisition where user_id=auth.uid();
 end if;
end $$;

create function public.analytics_record(p_session uuid,p_event text,p_screen text,p_seconds integer default 0) returns void
language plpgsql security definer set search_path=public as $$
declare v_enabled boolean; v_last timestamptz; v_started timestamptz; v_seconds integer:=0;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 select enabled into v_enabled from public.analytics_preferences where user_id=auth.uid() for update;
 if not coalesce(v_enabled,false) or exists(select 1 from public.demo_bots where user_id=auth.uid()) then return; end if;
 if p_session is null or p_event is null or p_event not in ('screen_view','heartbeat') or p_screen is null or
 p_screen not in ('index','welcome','signin','signup','onboarding','discover','likes','matches','chat','profile','settings','privacy-data','date','match','subscription','admin','other') or
 p_seconds is null or p_seconds<0 or p_seconds>30 or (p_event<>'heartbeat' and p_seconds<>0) then raise exception 'invalid analytics event' using errcode='22023'; end if;
 -- Bound volume to 240 events/hour/account. Heartbeats run every 30 seconds.
 if (select count(*) from public.analytics_events where user_id=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=240 then return; end if;
 insert into public.analytics_sessions(user_id,id) values(auth.uid(),p_session) on conflict do nothing;
 select last_seen_at,started_at into v_last,v_started from public.analytics_sessions where user_id=auth.uid() and id=p_session for update;
 if v_started<clock_timestamp()-interval '24 hours' then return; end if;
 if p_event='heartbeat' then v_seconds:=least(p_seconds,greatest(0,floor(extract(epoch from clock_timestamp()-v_last))::integer)); end if;
 update public.analytics_sessions set last_seen_at=clock_timestamp(),active_seconds=active_seconds+v_seconds where user_id=auth.uid() and id=p_session;
 insert into public.analytics_events(user_id,session_id,event,screen,active_seconds) values(auth.uid(),p_session,p_event,p_screen,v_seconds);
end $$;
create function public.analytics_capture_acquisition(p_source text default null,p_medium text default null,p_campaign text default null,p_referral text default null) returns void
language plpgsql security definer set search_path=public as $$
declare v_enabled boolean;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 select enabled into v_enabled from public.analytics_preferences where user_id=auth.uid() for update;
 if not coalesce(v_enabled,false) or exists(select 1 from public.demo_bots where user_id=auth.uid()) then return; end if;
 insert into public.analytics_acquisition(user_id,source,medium,campaign,referral) values(auth.uid(),p_source,p_medium,p_campaign,p_referral) on conflict do nothing;
end $$;

-- Product outcomes are emitted by successful database writes, never inferred from opening a screen.
create function public.analytics_outcome() returns trigger language plpgsql security definer set search_path=public as $$
declare v_user uuid; v_event text; v_users uuid[]; v_enabled boolean;
begin
 if tg_table_name='profiles' then
  if old.onboarding_done or not new.onboarding_done then return new; end if;
  v_users:=array[new.id]; v_event:='onboard';
 elsif tg_table_name='sparks' then v_users:=array[new.from_id]; v_event:='like';
 elsif tg_table_name='matches' then v_users:=array[new.user_a,new.user_b]; v_event:='match';
 elsif tg_table_name='dates' then v_users:=array[new.proposer_id]; v_event:='date';
 end if;
 for v_user in select unnest(v_users) order by 1 loop
  select enabled into v_enabled from public.analytics_preferences where user_id=v_user for update;
  if coalesce(v_enabled,false) and not exists(select 1 from public.demo_bots where user_id=v_user) then
   insert into public.analytics_events(user_id,event) values(v_user,v_event);
  end if;
 end loop;
 return new;
end $$;
create trigger analytics_onboard after update of onboarding_done on public.profiles for each row execute function public.analytics_outcome();
create trigger analytics_like after insert on public.sparks for each row execute function public.analytics_outcome();
create trigger analytics_match after insert on public.matches for each row execute function public.analytics_outcome();
create trigger analytics_date after insert on public.dates for each row execute function public.analytics_outcome();

-- Only the maintenance role may purge. Retention also applies to every reporting query, even if cron lags.
create function public.analytics_purge() returns void language plpgsql security definer set search_path=public as $$
begin
 delete from public.analytics_events where created_at<now()-interval '180 days';
 delete from public.analytics_sessions where last_seen_at<now()-interval '180 days';
 delete from public.analytics_acquisition where captured_at<now()-interval '180 days';
end $$;

create function public.admin_analytics(p_days integer default 30) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_days integer:=greatest(1,least(coalesce(p_days,30),180));
begin
 perform public.admin_guard();
 with population as (
  select p.* from public.profiles p where not exists(select 1 from public.demo_bots b where b.user_id=p.id)
 ), events as (
  select e.* from public.analytics_events e where not exists(select 1 from public.demo_bots b where b.user_id=e.user_id) and e.created_at>=now()-interval '180 days'
 ), activity as (
  select * from events where session_id is not null and event in ('screen_view','heartbeat')
 ), measured as (
  select distinct user_id from activity
 ), window_events as (
  select * from events where created_at>=now()-make_interval(days=>v_days)
 ), funnel_steps as (
  select f.user_id,f.first_at,o.at as onboard_at,l.at as like_at,m.at as match_at,d.at as date_at
  from (select user_id,min(created_at) first_at from window_events where session_id is not null group by user_id) f
  left join lateral(select min(created_at) at from window_events e where e.user_id=f.user_id and e.event='onboard' and e.created_at>=f.first_at) o on true
  left join lateral(select min(created_at) at from window_events e where e.user_id=f.user_id and e.event='like' and e.created_at>=o.at) l on true
  left join lateral(select min(created_at) at from window_events e where e.user_id=f.user_id and e.event='match' and e.created_at>=l.at) m on true
  left join lateral(select min(created_at) at from window_events e where e.user_id=f.user_id and e.event='date' and e.created_at>=m.at) d on true
 ), first_seen as (
  select s.user_id,min(s.started_at) as first_at from public.analytics_sessions s where not exists(select 1 from public.demo_bots b where b.user_id=s.user_id) and s.started_at>=now()-interval '180 days' group by s.user_id
 ), retention as (
  select d, count(*) filter(where (f.first_at at time zone 'UTC')::date <= (now() at time zone 'UTC')::date-d) as eligible,
   count(*) filter(where (f.first_at at time zone 'UTC')::date <= (now() at time zone 'UTC')::date-d and exists(
    select 1 from activity e where e.user_id=f.user_id and (e.created_at at time zone 'UTC')::date=(f.first_at at time zone 'UTC')::date+d)) as returned
  from first_seen f cross join (values(1),(7),(30)) days(d) group by d
 ), cohorts as (
  select date_trunc('week',f.first_at at time zone 'UTC')::date as week,d,
   count(*) filter(where (f.first_at at time zone 'UTC')::date <= (now() at time zone 'UTC')::date-d) as eligible,
   count(*) filter(where (f.first_at at time zone 'UTC')::date <= (now() at time zone 'UTC')::date-d and exists(
    select 1 from activity e where e.user_id=f.user_id and (e.created_at at time zone 'UTC')::date=(f.first_at at time zone 'UTC')::date+d)) as returned
  from first_seen f cross join(values(1),(7),(30)) days(d) group by week,d
 )
 select jsonb_build_object(
  'days',v_days,'total',(select count(*) from auth.users u where not exists(select 1 from public.demo_bots b where b.user_id=u.id)),'new',(select count(*) from auth.users u where u.created_at>=now()-make_interval(days=>v_days) and not exists(select 1 from public.demo_bots b where b.user_id=u.id)),
  'measured',(select count(*) from measured),
  'consented',(select count(*) from public.analytics_preferences a where a.enabled and not exists(select 1 from public.demo_bots b where b.user_id=a.user_id)),
  'dau',(select count(distinct user_id) from activity where created_at>=now()-interval '1 day'),
  'wau',(select count(distinct user_id) from activity where created_at>=now()-interval '7 days'),
  'mau',(select count(distinct user_id) from activity where created_at>=now()-interval '30 days'),
  'online',(select count(distinct s.user_id) from public.analytics_sessions s where not exists(select 1 from public.demo_bots b where b.user_id=s.user_id) and s.last_seen_at>=now()-interval '90 seconds'),
  'active_seconds',(select coalesce(sum(active_seconds),0) from window_events),
  'sessions',(select count(*) from public.analytics_sessions s where not exists(select 1 from public.demo_bots b where b.user_id=s.user_id) and s.started_at>=now()-make_interval(days=>v_days)),
  'demographics',coalesce((select jsonb_agg(to_jsonb(x)) from (select p.country,coalesce(p.gender,'unknown') as gender,case when p.age is null then 'unknown' when p.age<25 then '18–24' when p.age<35 then '25–34' when p.age<45 then '35–44' else '45+' end as age_group,
   coalesce(case when s.expires_at is null or s.expires_at>now() then s.tier end,'free') as tier,count(*) as users from population p left join public.subscriptions s on s.user_id=p.id group by 1,2,3,4) x),'[]'::jsonb),
  'acquisition',coalesce((select jsonb_agg(to_jsonb(x)) from (select coalesce(a.source,'unknown') source,a.medium,a.campaign,a.referral,count(*) users from public.analytics_acquisition a where not exists(select 1 from public.demo_bots b where b.user_id=a.user_id) and a.captured_at>=now()-make_interval(days=>v_days) group by 1,2,3,4) x),'[]'::jsonb),
  'funnel',jsonb_build_object('first_visit',null,'signup',null,'measured_session',(select count(*) from funnel_steps),'onboard',(select count(onboard_at) from funnel_steps),'like',(select count(like_at) from funnel_steps),'match',(select count(match_at) from funnel_steps),'date',(select count(date_at) from funnel_steps)),
  'screens',coalesce((select jsonb_agg(to_jsonb(x)) from (select screen,count(*) filter(where event='screen_view') views,coalesce(sum(active_seconds),0) active_seconds from window_events where screen is not null group by screen order by count(*) filter(where event='screen_view') desc) x),'[]'::jsonb),
  'hourly',coalesce((select jsonb_agg(to_jsonb(x)) from (select extract(hour from created_at at time zone 'UTC')::int as "hour",count(*) filter(where event<>'heartbeat') events,sum(active_seconds) active_seconds from window_events group by 1 order by 1) x),'[]'::jsonb),
  'weekdays',coalesce((select jsonb_agg(to_jsonb(x)) from (select extract(dow from created_at at time zone 'UTC')::int weekday,count(*) filter(where event<>'heartbeat') events,sum(active_seconds) active_seconds from window_events group by 1 order by 1) x),'[]'::jsonb),
  'actions',coalesce((select jsonb_agg(to_jsonb(x)) from (select event,count(*) events from window_events where event not in ('heartbeat','screen_view') group by event) x),'[]'::jsonb),
  'retention',coalesce((select jsonb_agg(to_jsonb(r) order by d) from retention r),'[]'::jsonb),
  'cohorts',coalesce((select jsonb_agg(to_jsonb(c) order by week desc,d) from cohorts c),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
create function public.admin_user_analytics(p_user uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform public.admin_guard();
 if exists(select 1 from public.demo_bots where user_id=p_user) then return jsonb_build_object('excluded',true,'timeline','[]'::jsonb); end if;
 return jsonb_build_object('consented',coalesce((select enabled from public.analytics_preferences where user_id=p_user),false),
 'active_seconds',(select coalesce(sum(active_seconds),0) from public.analytics_events where user_id=p_user and created_at>=now()-interval '180 days'),
 'sessions',(select count(*) from public.analytics_sessions where user_id=p_user and started_at>=now()-interval '180 days'),
 'timeline',coalesce((select jsonb_agg(to_jsonb(x)) from (select event,screen,active_seconds,created_at from public.analytics_events where user_id=p_user and created_at>=now()-interval '180 days' order by created_at desc limit 200) x),'[]'::jsonb));
end $$;
revoke all on function public.analytics_consent(),public.analytics_set_consent(boolean),public.analytics_record(uuid,text,text,integer),public.analytics_capture_acquisition(text,text,text,text),public.analytics_outcome(),public.analytics_purge(),public.admin_analytics(integer),public.admin_user_analytics(uuid) from public,anon,authenticated;
grant execute on function public.analytics_consent(),public.analytics_set_consent(boolean),public.analytics_record(uuid,text,text,integer),public.analytics_capture_acquisition(text,text,text,text),public.admin_analytics(integer),public.admin_user_analytics(uuid) to authenticated;
grant execute on function public.analytics_purge() to service_role;
-- Hosted Supabase provides pg_cron. Install and schedule deletion automatically when supported.
do $$ begin
 if not exists(select 1 from pg_extension where extname='pg_cron') and exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
 end if;
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('renvi-analytics-retention','20 3 * * *','select public.analytics_purge()');
 else
  raise warning 'pg_cron unavailable: analytics retention is NOT scheduled. Configure a daily service-role analytics_purge job before production.';
 end if;
end $$;
