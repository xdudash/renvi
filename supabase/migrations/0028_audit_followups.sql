-- Commit the webhook's read/compute/write unit atomically. A changed snapshot causes a retry;
-- event deduplication, all transferred rows and the receipt share the same transaction.
create or replace function public.billing_commit(p_event jsonb, p_expected jsonb, p_writes jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare item jsonb; cur public.subscriptions; expected public.subscriptions; wrote public.subscriptions; uid uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('billing-event:' || (p_event->>'id'), 0));
  if exists(select 1 from public.billing_events where id=p_event->>'id') then return true; end if;
  for uid in select distinct (x->>'user_id')::uuid from jsonb_array_elements(p_expected) x order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('billing-user:' || uid::text, 0));
  end loop;
  for item in select * from jsonb_array_elements(p_expected) loop
    uid := (item->>'user_id')::uuid;
    select * into cur from public.subscriptions where user_id=uid for update;
    if item->'row' = 'null'::jsonb then
      if cur.user_id is not null then raise exception 'billing snapshot changed' using errcode='40001'; end if;
    else
      expected := jsonb_populate_record(null::public.subscriptions, item->'row');
      if cur.user_id is null or row(cur.user_id,cur.tier,cur.store,cur.sandbox,cur.expires_at,cur.product_id,cur.last_event_ms)
        is distinct from row(expected.user_id,expected.tier,expected.store,expected.sandbox,expected.expires_at,expected.product_id,expected.last_event_ms) then
        raise exception 'billing snapshot changed' using errcode='40001';
      end if;
    end if;
  end loop;
  for item in select * from jsonb_array_elements(p_writes) loop
    wrote := jsonb_populate_record(null::public.subscriptions,item);
    if not exists(select 1 from jsonb_array_elements(p_expected) x where (x->>'user_id')::uuid=wrote.user_id) then
      raise exception 'billing write without snapshot' using errcode='22023';
    end if;
    if exists(select 1 from public.subscriptions where user_id=wrote.user_id) then
      update public.subscriptions set tier=wrote.tier, store=wrote.store, sandbox=wrote.sandbox,
        expires_at=wrote.expires_at, product_id=wrote.product_id, last_event_ms=wrote.last_event_ms, updated_at=now()
        where user_id=wrote.user_id;
    else
      insert into public.subscriptions(user_id,tier,store,sandbox,expires_at,product_id,last_event_ms)
        values(wrote.user_id,wrote.tier,wrote.store,wrote.sandbox,wrote.expires_at,wrote.product_id,wrote.last_event_ms);
    end if;
  end loop;
  insert into public.billing_events(id,type,user_id,event_ms)
    values(p_event->>'id',p_event->>'type',(p_event->>'user_id')::uuid,(p_event->>'event_ms')::bigint);
  return false;
end $$;
revoke all on function public.billing_commit(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.billing_commit(jsonb,jsonb,jsonb) to service_role;

-- Serialize both sides of the consent transition, including reads made before upsert.
create or replace function public.send_spark(p_to uuid, p_kind text, p_ref uuid, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid; a uuid; b uuid; prev_end timestamptz;
begin
  perform public.assert_account_active();
  if p_kind not in ('profile','photo','prompt') then raise exception 'bad target' using errcode = '22023'; end if;
  if not public.profile_is_visible(p_to) or public.is_blocked_pair(me, p_to) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  if (select count(*) from public.sparks where from_id = me and created_at >= date_trunc('day', now())) >= public.daily_like_limit() then
    raise exception 'daily limit' using errcode = 'P0003';
  end if;
  a := least(me, p_to); b := greatest(me, p_to);
  perform pg_advisory_xact_lock(hashtextextended('match-pair:' || a::text || ':' || b::text, 0));
  select ended_at into prev_end from public.matches where user_a = a and user_b = b;
  insert into public.sparks (from_id, to_id, target_kind, target_ref, comment, created_at)
    values (me, p_to, p_kind, p_ref, public.filter_words(nullif(trim(p_comment), '')), clock_timestamp())
    on conflict (from_id, to_id) do update
      set target_kind = excluded.target_kind, target_ref = excluded.target_ref,
          comment = excluded.comment, created_at = clock_timestamp()
      where prev_end is not null and public.sparks.created_at <= prev_end;
  if not exists (select 1 from public.sparks
                 where from_id = p_to and to_id = me and (prev_end is null or created_at > prev_end)) then
    return jsonb_build_object('status', 'sent');
  end if;
  insert into public.matches (user_a, user_b) values (a, b)
    on conflict (user_a, user_b) do update set ended_at = null, ended_by = null
    returning id into mid;
  return jsonb_build_object('status', 'match', 'match_id', mid);
end $$;

create or replace function public.end_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid; b uuid;
begin
  select user_a,user_b into a,b from public.matches where id=p_match and auth.uid() in (user_a,user_b);
  if a is null then raise exception 'no match' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('match-pair:' || a::text || ':' || b::text, 0));
  if public.match_partner(p_match) is null then raise exception 'no match' using errcode = '42501'; end if;
  update public.matches set ended_at = clock_timestamp(), ended_by = auth.uid() where id = p_match;
end $$;

-- A same-user race returns the established code; only a random code collision retries.
create or replace function public.my_referral() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text; done int; goal int; prefix text; conflict_name text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('referral-user:' || auth.uid()::text, 0));
  select code into c from public.referral_codes where user_id = auth.uid();
  if c is null then
    prefix := regexp_replace(upper(coalesce((select display_name from public.profiles where id = auth.uid()), '')), '[^A-Z]', '', 'g');
    if length(prefix) < 2 then prefix := 'RN'; end if;
    loop
      c := substr(prefix, 1, 2) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
      begin
        insert into public.referral_codes (user_id, code) values (auth.uid(), c)
          on conflict (user_id) do nothing returning code into c;
        if c is null then select code into c from public.referral_codes where user_id=auth.uid(); end if;
        exit;
      exception when unique_violation then
        get stacked diagnostics conflict_name = CONSTRAINT_NAME;
        if conflict_name <> 'referral_codes_code_key' then raise; end if;
      end;
    end loop;
  end if;
  select count(*) into done from public.referral_signups where code = c and status in ('verified','rewarded');
  select (value->>'goal')::int into goal from public.app_config where key = 'referral';
  return jsonb_build_object('code', c, 'verified', done, 'goal', coalesce(goal, 5));
end $$;

-- Feature flags consumed with ::boolean must actually be JSON booleans.
create or replace function public.admin_config_validate(p_key text, p_value jsonb) returns void
language plpgsql stable set search_path = public as $$
declare e record; t record; existing jsonb;
begin
  if p_value is null then raise exception 'invalid config: value required' using errcode = '22023'; end if;
  case p_key
  when 'prices_preliminary' then
    raise exception 'prices_preliminary is read-only: real prices are set in App Store Connect / Google Play' using errcode = '42501';
  when 'tier_limits' then
    if jsonb_typeof(p_value) <> 'object' or not (p_value ?& array['free','plus','premium']) then
      raise exception 'invalid config: tier_limits needs free, plus and premium' using errcode = '22023';
    end if;
    for t in select key, value from jsonb_each(p_value) loop
      if t.key not in ('free','plus','premium') or jsonb_typeof(t.value) <> 'object' then
        raise exception 'invalid config: tier_limits.% is not a tier object', t.key using errcode = '22023';
      end if;
      perform public.admin_cfg_int(t.value, 'daily_likes', 0, 100000);
      for e in select key, value from jsonb_each(t.value) where key <> 'daily_likes' loop
        if e.key in ('see_incoming','advanced_filters','undo_pass','incognito') and jsonb_typeof(e.value) <> 'boolean' then
          raise exception 'invalid config: tier_limits.%.% must be true/false', t.key,e.key using errcode='22023';
        end if;
        if jsonb_typeof(e.value) not in ('boolean','number') then
          raise exception 'invalid config: tier_limits.%.% must be true/false or a number', t.key, e.key using errcode = '22023';
        end if;
      end loop;
    end loop;
  when 'banned_words' then
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 5000 then
      raise exception 'invalid config: banned_words must be a list (max 5000)' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(p_value) w
               where jsonb_typeof(w) <> 'string' or char_length(trim(w #>> '{}')) not between 2 and 64) then
      raise exception 'invalid config: every banned word must be 2..64 characters' using errcode = '22023';
    end if;
  when 'legal_urls' then
    if jsonb_typeof(p_value) <> 'object' then raise exception 'invalid config: legal_urls must be an object' using errcode = '22023'; end if;
    for e in select key, value from jsonb_each(p_value) loop
      if e.key not in ('privacy','terms','community','subscriptions','moderation') then
        raise exception 'invalid config: unknown legal document %', e.key using errcode = '22023';
      end if;
      if e.value <> 'null'::jsonb and (jsonb_typeof(e.value) <> 'string'
          or (e.value #>> '{}') !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]+)?(/[^\s]*)?$'
          or char_length(e.value #>> '{}') > 500) then
        raise exception 'invalid config: legal_urls.% must be an https:// link', e.key using errcode = '22023';
      end if;
    end loop;
  when 'support_email' then
    if p_value <> 'null'::jsonb and (jsonb_typeof(p_value) <> 'string'
        or (p_value #>> '{}') !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') then
      raise exception 'invalid config: support_email must be an e-mail address' using errcode = '22023';
    end if;
  when 'referral' then
    if jsonb_typeof(p_value) <> 'object' then raise exception 'invalid config: referral must be an object' using errcode = '22023'; end if;
    perform public.admin_cfg_int(p_value, 'goal', 1, 1000);
    perform public.admin_cfg_int(p_value, 'reward_days', 1, 365);
  when 'rate_limits' then
    if jsonb_typeof(p_value) <> 'object' then raise exception 'invalid config: rate_limits must be an object' using errcode = '22023'; end if;
    for e in select key from jsonb_each(p_value) loop
      perform public.admin_cfg_int(p_value, e.key, 1, 100000);
    end loop;
  when 'digest' then
    if jsonb_typeof(p_value) <> 'object' or jsonb_typeof(p_value -> 'enabled') is distinct from 'boolean' then
      raise exception 'invalid config: digest.enabled must be true/false' using errcode = '22023';
    end if;
    perform public.admin_cfg_int(p_value, 'weekday', 0, 6);
    perform public.admin_cfg_int(p_value, 'hour_utc', 0, 23);
  when 'demo_bots' then
    if jsonb_typeof(p_value) <> 'object' then raise exception 'invalid config: demo_bots must be an object' using errcode = '22023'; end if;
    perform public.admin_cfg_int(p_value, 'match_every', 1, 100);
    perform public.admin_cfg_int(p_value, 'welcome_sparks', 0, 20);
  when 'launch_countries', 'countries' then
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0
       or exists (select 1 from jsonb_array_elements(p_value) c where jsonb_typeof(c) <> 'string' or (c #>> '{}') !~ '^[A-Z]{2}$') then
      raise exception 'invalid config: % must be a non-empty list of 2-letter country codes', p_key using errcode = '22023';
    end if;
    if p_key = 'launch_countries' and exists (
        select 1 from jsonb_array_elements_text(p_value) c
        where not exists (select 1 from public.app_config k, jsonb_array_elements_text(k.value) a where k.key = 'countries' and a = c)) then
      raise exception 'invalid config: launch country is not in countries' using errcode = '22023';
    end if;
  else
    -- Keys added by later features (video, voice, ...): only existing keys, same JSON type as before.
    select value into existing from public.app_config where key = p_key;
    if not found then raise exception 'invalid config: unknown key %', p_key using errcode = '22023'; end if;
    if jsonb_typeof(existing) <> jsonb_typeof(p_value) and existing <> 'null'::jsonb then
      raise exception 'invalid config: % must stay a JSON %', p_key, jsonb_typeof(existing) using errcode = '22023';
    end if;
  end case;
end $$;

-- Moderation deletes photo metadata first; remaining blobs must lose viewer access immediately.
create or replace function public.can_read_media(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(p_name, '/'); owner uuid;
begin
  if array_length(parts, 1) < 3 then return false; end if;
  begin owner := parts[1]::uuid; exception when others then return false; end;
  if owner = auth.uid() or public.is_admin() then return true; end if;
  if parts[2] = 'profile' then
    return exists(select 1 from public.profile_photos where profile_id=owner and storage_path=p_name)
      and public.profile_is_visible(owner) and not public.is_blocked_pair(owner, auth.uid());
  elsif parts[2] = 'chat' then
    return exists (select 1 from public.messages m where m.photo_path = p_name and m.deleted_at is null
                   and public.match_partner(m.match_id) is not null);
  end if;
  return false;
end $$;
