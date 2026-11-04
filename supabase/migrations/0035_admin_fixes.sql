-- Admin panel review (founder: "very crooked"). Two server-side defects found while auditing every admin screen
-- (docs/ADMIN_AUDIT.md). Both changes are idempotent.
--
-- 1. app_config.discover_recycle (0033) had no validation: the generic "existing key, same JSON type" rule let an admin
--    save {"cooldown_hours": "x"}, and discover() casts the fields to int, which would have broken the feed for everyone.
--    admin_config_set() now checks the three numbers (and refuses unknown fields).
-- 2. admin_add_admin() accepted any account by e-mail, including one whose address was never confirmed. Whoever
--    registered with someone else's address would have become an admin as soon as that address was typed into the form.
--    The account must have confirmed its e-mail.

-- ---------- 1. discover_recycle is validated ----------
do $mig$
declare
  body text;
  anchor constant text := 'when ''launch_countries'', ''countries'' then';
  branch constant text := $b$when 'discover_recycle' then
    if jsonb_typeof(p_value) <> 'object' then raise exception 'invalid config: discover_recycle must be an object' using errcode = '22023'; end if;
    perform public.admin_cfg_int(p_value, 'cooldown_hours', 0, 8760);
    perform public.admin_cfg_int(p_value, 'fallback_minutes', 0, 10080);
    perform public.admin_cfg_int(p_value, 'max_passes', 1, 100);
    if exists (select 1 from jsonb_object_keys(p_value) k where k not in ('cooldown_hours', 'fallback_minutes', 'max_passes')) then
      raise exception 'invalid config: discover_recycle has only cooldown_hours, fallback_minutes and max_passes' using errcode = '22023';
    end if;
  $b$;
begin
  body := pg_get_functiondef('public.admin_config_validate(text,jsonb)'::regprocedure);
  if position('when ''discover_recycle'' then' in body) = 0 then
    if position(anchor in body) = 0 then
      raise exception '0035: admin_config_validate has no launch_countries branch to extend';
    end if;
    execute replace(body, anchor, branch || anchor);
  end if;
end $mig$;

-- ---------- 2. Only an account with a confirmed e-mail can be made admin ----------
create or replace function public.admin_add_admin(p_email text, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := public.admin_guard(); why text := public.admin_need_reason(p_reason); uid uuid; confirmed timestamptz;
begin
  select id, email_confirmed_at into uid, confirmed from auth.users where lower(email) = lower(trim(coalesce(p_email, ''))) limit 1;
  if uid is null then raise exception 'no account with this e-mail (the person must sign up first)' using errcode = 'P0002'; end if;
  if confirmed is null then raise exception 'this account has not confirmed its e-mail yet' using errcode = '22023'; end if;
  if exists (select 1 from public.admins where user_id = uid) then raise exception 'already an admin' using errcode = '23505'; end if;
  if exists (select 1 from public.demo_bots where user_id = uid) then raise exception 'demo bots cannot be admins' using errcode = '42501'; end if;
  insert into public.admins (user_id, added_by) values (uid, me);
  perform public.admin_log('admin.add', uid, null, why, jsonb_build_object('email', lower(trim(p_email))));
  return uid;
end $$;
revoke all on function public.admin_add_admin(text, text) from public, anon;
grant execute on function public.admin_add_admin(text, text) to authenticated;
