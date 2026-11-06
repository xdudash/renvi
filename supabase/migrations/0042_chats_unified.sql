-- One list of conversations («Чаты»): dating, company and plan chats side by side.
-- list_matches() now says what kind of chat a row is; plan_chats() lists the group chats of the plans I am in.

drop function if exists public.list_matches();
create function public.list_matches() returns table (
  match_id uuid, partner_id uuid, partner_name text, partner_age smallint, last_body text, last_at timestamptz,
  unread int, muted boolean, archived boolean, created_at timestamptz, partner_photo text, partner_verified boolean, kind text)
language sql stable security definer set search_path = public as $$
  select m.id, p.id, p.display_name, public.profile_age(p.id), lm.body, lm.created_at,
         (select count(*)::int from public.messages x where x.match_id = m.id and x.sender_id <> auth.uid()
            and x.created_at > coalesce((select r.read_at from public.match_reads r where r.match_id = m.id and r.user_id = auth.uid()), 'epoch')),
         coalesce(s.muted, false), coalesce(s.archived, false), m.created_at,
         (select ph.storage_path from public.profile_photos ph where ph.profile_id = p.id and ph.kind = 'photo' order by ph.position limit 1),
         p.verification_status = 'approved', m.kind
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  left join public.match_settings s on s.match_id = m.id and s.user_id = auth.uid()
  left join lateral (select x.body, x.created_at from public.messages x
                     where x.match_id = m.id order by x.created_at desc limit 1) lm on true
  where public.my_email_confirmed() and m.ended_at is null and (m.user_a = auth.uid() or m.user_b = auth.uid())
    and not public.is_blocked_pair(m.user_a, m.user_b)
  order by coalesce(lm.created_at, m.created_at) desc, m.id
$$;
revoke all on function public.list_matches() from public, anon;
grant execute on function public.list_matches() to authenticated;

-- Plans I host or go to, not cancelled, that started less than 3 days ago or are still ahead. Last message (not from
-- someone I blocked or who blocked me), and how many people are going.
create or replace function public.plan_chats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or not public.my_email_confirmed() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'plan_id', p.id, 'title', p.title, 'category', p.category, 'starts_at', p.starts_at,
      'going', public.plan_going(p.id), 'last_body', lm.body, 'last_name', lm.display_name,
      'last_at', coalesce(lm.created_at, p.created_at)) order by coalesce(lm.created_at, p.created_at) desc)
    from public.plans p
    left join lateral (select x.body, x.created_at, pr.display_name from public.plan_messages x join public.profiles pr on pr.id = x.user_id
                       where x.plan_id = p.id and not public.is_blocked_pair(me, x.user_id) order by x.created_at desc limit 1) lm on true
    where p.status = 'active' and p.starts_at > now() - interval '3 days' and public.plan_is_member(p.id, me)), '[]'::jsonb);
end $$;
revoke all on function public.plan_chats() from public, anon;
grant execute on function public.plan_chats() to authenticated;
