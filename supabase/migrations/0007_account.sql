-- Notification preferences, data export requests and account deletion feedback.
create table public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages boolean not null default true,
  matches boolean not null default true,
  dates boolean not null default true,
  likes boolean not null default true,
  news boolean not null default false,
  reduce_motion boolean not null default false,
  larger_text boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy prefs_own on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.notification_prefs to authenticated;

create table public.data_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','ready','cancelled')),
  storage_path text,
  created_at timestamptz not null default now()
);
alter table public.data_exports enable row level security;
create policy exports_own on public.data_exports for select to authenticated using (user_id = auth.uid());
grant select on public.data_exports to authenticated;

create table public.deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  reason text,
  created_at timestamptz not null default now()
);
alter table public.deletion_feedback enable row level security;
create policy deletion_admin on public.deletion_feedback for select to authenticated using (public.is_admin());

-- Full personal data as JSON (called by the export-data function with the user's own token).
create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'private', (select to_jsonb(x) - 'lat' - 'lng' || jsonb_build_object('location_enabled', x.location_enabled) from public.private_profile x where x.user_id = auth.uid()),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('path', storage_path, 'kind', kind, 'created_at', created_at)), '[]') from public.profile_photos where profile_id = auth.uid()),
    'prompts', (select coalesce(jsonb_agg(to_jsonb(q) - 'profile_id'), '[]') from public.profile_prompts q where q.profile_id = auth.uid()),
    'sparks_sent', (select coalesce(jsonb_agg(jsonb_build_object('to', to_id, 'kind', target_kind, 'comment', comment, 'at', created_at)), '[]') from public.sparks where from_id = auth.uid()),
    'matches', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'ended_at', ended_at)), '[]') from public.matches where user_a = auth.uid() or user_b = auth.uid()),
    'messages_sent', (select coalesce(jsonb_agg(jsonb_build_object('match', match_id, 'body', body, 'at', created_at, 'deleted_at', deleted_at)), '[]') from public.messages where sender_id = auth.uid()),
    'dates', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from public.dates d where d.proposer_id = auth.uid()),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'status', status, 'at', created_at)), '[]') from public.reports where reporter_id = auth.uid()),
    'subscription', (select to_jsonb(s) from public.subscriptions s where s.user_id = auth.uid()),
    'notification_prefs', (select to_jsonb(n) from public.notification_prefs n where n.user_id = auth.uid())
  )
$$;
revoke all on function public.export_my_data from public;
grant execute on function public.export_my_data to authenticated;

create or replace function public.leave_deletion_feedback(p_reason text) returns void
language sql security definer set search_path = public as $$
  insert into public.deletion_feedback (reason) values (nullif(trim(p_reason), ''))
$$;
grant execute on function public.leave_deletion_feedback to authenticated;

-- The client deletes the account only through the delete-account Edge Function (Auth admin API).
revoke execute on function public.delete_account from authenticated;
drop function public.delete_account();
