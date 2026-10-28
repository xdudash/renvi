-- Context for a conversation, opening moves (up to 3 topics) and support attachments.
create table public.opening_moves (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 3 and 140),
  position smallint not null default 0
);
alter table public.opening_moves enable row level security;
create policy moves_own on public.opening_moves for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy moves_partner on public.opening_moves for select to authenticated
  using (exists (select 1 from public.matches m where m.ended_at is null
                 and ((m.user_a = auth.uid() and m.user_b = profile_id) or (m.user_b = auth.uid() and m.user_a = profile_id))));
grant select, insert, update, delete on public.opening_moves to authenticated;

create or replace function public.match_context(p_match uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare partner uuid := public.match_partner(p_match); me uuid := auth.uid(); res jsonb;
begin
  if partner is null then return null; end if;
  select jsonb_build_object(
    'match_id', p_match,
    'partner', jsonb_build_object('id', p.id, 'name', p.display_name, 'age', p.age,
                 'verified', p.verification_status = 'approved', 'show_active', p.show_active,
                 'updated_at', case when p.show_active then p.updated_at end,
                 'photo', (select storage_path from public.profile_photos where profile_id = p.id order by position limit 1)),
    'spark', (select jsonb_build_object('from_me', s.from_id = me, 'kind', s.target_kind, 'comment', s.comment,
                       'prompt', (select jsonb_build_object('question', q.question_key, 'answer', q.answer) from public.profile_prompts q where q.id = s.target_ref))
              from public.sparks s
              where (s.from_id = me and s.to_id = partner) or (s.from_id = partner and s.to_id = me)
              order by (s.target_kind = 'prompt') desc, s.created_at limit 1),
    'my_photo_consent', coalesce((select allowed from public.photo_consents where match_id = p_match and user_id = me), false),
    'their_photo_consent', coalesce((select allowed from public.photo_consents where match_id = p_match and user_id = partner), false),
    'muted', coalesce((select muted from public.match_settings where match_id = p_match and user_id = me), false),
    'archived', coalesce((select archived from public.match_settings where match_id = p_match and user_id = me), false),
    'their_read_at', (select read_at from public.match_reads where match_id = p_match and user_id = partner),
    'opening_moves', coalesce((select jsonb_agg(o.text order by o.position) from public.opening_moves o where o.profile_id in (me, partner)), '[]'::jsonb),
    'their_prompts', coalesce((select jsonb_agg(jsonb_build_object('question', q.question_key, 'answer', q.answer) order by q.position)
                               from public.profile_prompts q where q.profile_id = partner), '[]'::jsonb),
    'their_interests', to_jsonb(p.interests),
    'latest_date', (select to_jsonb(d) from public.dates d where d.match_id = p_match order by d.created_at desc limit 1)
  ) into res
  from public.profiles p where p.id = partner;
  return res;
end $$;
revoke all on function public.match_context from public;
grant execute on function public.match_context to authenticated;

-- Support can receive up to 50 latest messages of one conversation, only when the user opts in.
alter table public.support_requests add column match_id uuid references public.matches(id) on delete set null,
  add column history jsonb;

create or replace function public.submit_support_chat(p_match uuid, p_body text, p_include_history boolean)
returns public.support_requests language plpgsql security definer set search_path = public as $$
declare r public.support_requests; hist jsonb;
begin
  if p_match is not null and public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  if p_include_history and p_match is not null then
    select coalesce(jsonb_agg(jsonb_build_object('from_me', x.sender_id = auth.uid(), 'body', x.body, 'at', x.created_at) order by x.created_at), '[]'::jsonb)
      into hist from (select * from public.messages where match_id = p_match order by created_at desc limit 50) x;
  end if;
  insert into public.support_requests (user_id, topic, body, include_history, match_id, history)
    values (auth.uid(), 'chat', p_body, coalesce(p_include_history, false), p_match, hist)
    returning * into r;
  return r;
end $$;
revoke all on function public.submit_support_chat from public;
grant execute on function public.submit_support_chat to authenticated;
