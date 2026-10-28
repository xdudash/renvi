-- Voice messages in chat.
--
-- Storage: the existing private bucket `profile-media`, path `<sender uid>/voice/<uuid>.m4a`.
--   A separate bucket would duplicate the owner-folder write/delete policies, the single read gate
--   (can_read_media) and the account-deletion cleanup, and add one more manual setup step; one bucket
--   with one read function keeps the rules in one place.
-- Consent: a separate, parallel voice consent (voice_consents), NOT the photo consent. Agreeing to receive
--   photos is not agreeing to receive someone's voice (a voice identifies a person); consent must be specific,
--   and users who allowed photos before this release must not be opted in silently.
-- Rule: a voice message is sent only while BOTH members allowed voice in this match, and the file stays
--   readable only while both still allow it (revoking hides earlier voice messages from the partner too).
-- Duration (≤ 120 s) is client-reported metadata stored on the message; the banned-words filter is not
--   applied to audio. Sending is rate-limited per hour through check_rate_limit() (0015).

-- ---------- 1. Schema ----------
alter table public.messages
  add column voice_path text,
  add column voice_duration_ms int check (voice_duration_ms between 1 and 120000),
  add constraint messages_voice_pair check ((voice_path is null) = (voice_duration_ms is null)),
  add constraint messages_voice_only check (voice_path is null or (body is null and photo_path is null));
create unique index messages_voice_path_key on public.messages (voice_path) where voice_path is not null;

create table public.voice_consents (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
alter table public.voice_consents enable row level security;
create policy voice_consents_read on public.voice_consents for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke all on public.voice_consents from public, anon, authenticated;
grant select on public.voice_consents to authenticated;
grant all on public.voice_consents to service_role;

-- Default hourly limit for voice messages; an existing admin-edited rate_limits row only gains the new key.
insert into public.app_config (key, value) values ('rate_limits', '{"report": 10, "submit_appeal": 5, "voice_message": 60}')
  on conflict (key) do update set value = jsonb_build_object('voice_message', 60) || app_config.value;

-- ---------- 2. Helpers ----------
create or replace function public.voice_allowed(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matches m
                 join public.voice_consents c1 on c1.match_id = m.id and c1.user_id = m.user_a and c1.allowed
                 join public.voice_consents c2 on c2.match_id = m.id and c2.user_id = m.user_b and c2.allowed
                 where m.id = p_match)
$$;
revoke execute on function public.voice_allowed(uuid) from public, anon, authenticated;

create or replace function public.set_voice_consent(p_match uuid, p_allowed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  insert into public.voice_consents (match_id, user_id, allowed) values (p_match, auth.uid(), coalesce(p_allowed, false))
    on conflict (match_id, user_id) do update set allowed = excluded.allowed, updated_at = now();
end $$;
revoke execute on function public.set_voice_consent(uuid, boolean) from public, anon;
grant execute on function public.set_voice_consent(uuid, boolean) to authenticated;

-- ---------- 3. Sending ----------
create or replace function public.send_voice_message(p_match uuid, p_client_id uuid, p_voice_path text, p_duration_ms int)
returns public.messages language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); msg public.messages; partner uuid;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  -- Idempotent retry of an already delivered message: return it, do not count it against the limit again.
  select * into msg from public.messages where sender_id = me and client_id = p_client_id and match_id = p_match;
  if found then return msg; end if;
  partner := public.match_partner(p_match);
  if partner is null then raise exception 'no match' using errcode = '42501'; end if;
  if public.is_blocked_pair(me, partner) then raise exception 'blocked' using errcode = '42501'; end if;
  -- Same ownership rule as chat photos (0014 §5), plus the exact file name format.
  if p_voice_path is null or p_voice_path not like me::text || '/voice/%' or p_voice_path like '%..%'
     or p_voice_path !~ ('^' || me::text || '/voice/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.m4a$') then
    raise exception 'bad voice path' using errcode = '42501';
  end if;
  if p_duration_ms is null or p_duration_ms not between 1 and 120000 then
    raise exception 'bad voice duration' using errcode = '22023';
  end if;
  if not public.voice_allowed(p_match) then
    raise exception 'voice consent missing' using errcode = '42501';
  end if;
  perform public.check_rate_limit('voice_message');
  insert into public.messages (client_id, match_id, sender_id, voice_path, voice_duration_ms)
    values (p_client_id, p_match, me, p_voice_path, p_duration_ms)
    on conflict (sender_id, client_id) do nothing;
  select * into msg from public.messages where sender_id = me and client_id = p_client_id;
  return msg;
end $$;
revoke execute on function public.send_voice_message(uuid, uuid, text, int) from public, anon;
grant execute on function public.send_voice_message(uuid, uuid, text, int) to authenticated;

-- Deleting a message also drops the voice reference (the file then becomes unreadable for the partner).
create or replace function public.delete_own_message(p_message uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set body = null, photo_path = null, voice_path = null, voice_duration_ms = null, deleted_at = now()
  where id = p_message and sender_id = auth.uid()
$$;

-- ---------- 4. Storage read gate (0003) + voice ----------
create or replace function public.can_read_media(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(p_name, '/'); owner uuid;
begin
  if array_length(parts, 1) < 3 then return false; end if;
  begin owner := parts[1]::uuid; exception when others then return false; end;
  if owner = auth.uid() or public.is_admin() then return true; end if;
  if parts[2] = 'profile' then
    return public.profile_is_visible(owner) and not public.is_blocked_pair(owner, auth.uid());
  elsif parts[2] = 'chat' then
    return exists (select 1 from public.messages m where m.photo_path = p_name and m.deleted_at is null
                   and public.match_partner(m.match_id) is not null);
  elsif parts[2] = 'voice' then
    -- Only the other member of the (active, unblocked) match the file was sent in, while both allow voice.
    return exists (select 1 from public.messages m where m.voice_path = p_name and m.deleted_at is null
                   and m.sender_id = owner
                   and public.match_partner(m.match_id) = owner
                   and not public.is_blocked_pair(owner, auth.uid())
                   and public.voice_allowed(m.match_id));
  end if;
  return false;
end $$;
revoke execute on function public.can_read_media(text) from public, anon;
grant execute on function public.can_read_media(text) to authenticated;

-- Uploads into a voice folder must use the exact file name format (restrictive: combines with media_write).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute $p$create policy media_voice_name on storage.objects as restrictive for insert to authenticated
      with check (bucket_id <> 'profile-media' or (storage.foldername(name))[2] is distinct from 'voice'
                  or name ~ '^[0-9a-f-]{36}/voice/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.m4a$')$p$;
  end if;
end $$;

-- ---------- 5. Conversation context (0006) + voice consent flags ----------
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
    'my_voice_consent', coalesce((select allowed from public.voice_consents where match_id = p_match and user_id = me), false),
    'their_voice_consent', coalesce((select allowed from public.voice_consents where match_id = p_match and user_id = partner), false),
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
revoke all on function public.match_context(uuid) from public, anon;
grant execute on function public.match_context(uuid) to authenticated;
