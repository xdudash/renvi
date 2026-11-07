-- Push for messages in the group chat of a plan (Edge Function push, Database Webhook on plan_messages INSERT).
-- The database decides who is notified; the function only sends. Service role only.
--   * recipients: the host and the people with status 'going', never the sender, only while the plan is active and
--     not older than 3 days after its start (the same window as the chat list)
--   * not people in a block with the sender (either direction), not people who switched «Сообщения» off,
--     not suspended / blocked profiles, only people with a device token
--   * at most one push per person per plan per minute, and the same message is never pushed twice (webhook retries)
create table if not exists public.plan_push_log (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_message_id uuid,
  sent_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
alter table public.plan_push_log enable row level security;
revoke all on public.plan_push_log from anon, authenticated;
grant all on public.plan_push_log to service_role;

create or replace function public.plan_message_push(p_message uuid) returns table (plan_id uuid, user_id uuid, language text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare m public.plan_messages; p public.plans;
begin
  select * into m from public.plan_messages x where x.id = p_message;
  if not found then return; end if;
  select * into p from public.plans x where x.id = m.plan_id;
  if not found or p.status <> 'active' or p.starts_at < now() - interval '3 days' then return; end if;
  if not public.plan_is_member(m.plan_id, m.user_id) then return; end if;
  return query
    insert into public.plan_push_log as l (plan_id, user_id, last_message_id, sent_at)
    select m.plan_id, w.uid, m.id, now()
      from (select p.host_id as uid union select pm.user_id from public.plan_members pm where pm.plan_id = m.plan_id and pm.status = 'going') w
      join public.profiles pr on pr.id = w.uid
      left join public.notification_prefs np on np.user_id = w.uid
     where w.uid <> m.user_id
       and not public.is_blocked_pair(w.uid, m.user_id)
       and coalesce(np.messages, true)
       and (pr.suspended_until is null or pr.suspended_until < now())
       and (pr.blocked_until is null or pr.blocked_until < now())
       and exists (select 1 from public.push_tokens t where t.user_id = w.uid)
    on conflict (plan_id, user_id) do update set last_message_id = excluded.last_message_id, sent_at = excluded.sent_at
      where l.last_message_id is distinct from excluded.last_message_id and l.sent_at < now() - interval '1 minute'
    returning l.plan_id, l.user_id, (select pr2.language from public.profiles pr2 where pr2.id = l.user_id);
end $$;
revoke all on function public.plan_message_push(uuid) from public, anon, authenticated;
grant execute on function public.plan_message_push(uuid) to service_role;
