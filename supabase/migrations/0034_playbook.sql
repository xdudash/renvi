-- RENVI Playbook (Nov 2026): a men's course of 8 lessons, one in-app purchase (0,99 €, non-consumable).
-- Founder decision 2026-11-04: the app itself stays free (0029); only this optional course is paid.
--
-- * The lesson texts ship with the app; the server keeps only progress and whether the course is bought.
-- * `purchased` is written ONLY by the playbook-sync Edge Function (service role) after it has asked RevenueCat.
--   The app reads its row through playbook_state() and changes progress through two RPCs; it has no write access
--   to the table.
-- * Lesson 2 is free: progress for it is accepted without the purchase.

create table if not exists public.playbook_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  purchased boolean not null default false,
  purchased_at timestamptz,
  store_checked_at timestamptz,
  done_lessons int[] not null default '{}',
  trainer_pos int not null default 0 check (trainer_pos between 0 and 30),
  updated_at timestamptz not null default now(),
  constraint playbook_lessons_valid check (done_lessons <@ array[1,2,3,4,5,6,7,8])
);

alter table public.playbook_progress enable row level security;
drop policy if exists playbook_own_read on public.playbook_progress;
create policy playbook_own_read on public.playbook_progress for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.playbook_progress from anon, authenticated;
revoke all on public.playbook_progress from anon;
grant select on public.playbook_progress to authenticated;
grant all on public.playbook_progress to service_role;

-- Caller's progress; a user without a row gets the defaults.
create or replace function public.playbook_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.playbook_progress;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into r from public.playbook_progress where user_id = auth.uid();
  return jsonb_build_object(
    'purchased', coalesce(r.purchased, false),
    'done_lessons', to_jsonb(coalesce(r.done_lessons, '{}'::int[])),
    'trainer_pos', coalesce(r.trainer_pos, 0));
end $$;

create or replace function public.playbook_mark_done(p_lesson int) returns void
language plpgsql security definer set search_path = public as $$
declare bought boolean;
begin
  perform public.assert_account_active();
  if p_lesson is null or p_lesson not between 1 and 8 then raise exception 'bad lesson' using errcode = '22023'; end if;
  select purchased into bought from public.playbook_progress where user_id = auth.uid();
  if p_lesson <> 2 and not coalesce(bought, false) then
    raise exception 'playbook not purchased' using errcode = '42501', detail = 'playbook';
  end if;
  insert into public.playbook_progress (user_id, done_lessons) values (auth.uid(), array[p_lesson])
  on conflict (user_id) do update
    set done_lessons = (select array_agg(distinct x order by x) from unnest(playbook_progress.done_lessons || p_lesson) x),
        updated_at = now();
end $$;

create or replace function public.playbook_set_trainer(p_pos int) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_account_active();
  if p_pos is null or p_pos not between 0 and 30 then raise exception 'bad position' using errcode = '22023'; end if;
  if not coalesce((select purchased from public.playbook_progress where user_id = auth.uid()), false) then
    raise exception 'playbook not purchased' using errcode = '42501', detail = 'playbook';
  end if;
  update public.playbook_progress set trainer_pos = p_pos, updated_at = now() where user_id = auth.uid();
end $$;

-- Service role only (playbook-sync): the store's answer for one user.
create or replace function public.playbook_set_purchased(p_user uuid, p_purchased boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.playbook_progress (user_id, purchased, purchased_at, store_checked_at)
  values (p_user, p_purchased, case when p_purchased then now() end, now())
  on conflict (user_id) do update
    set purchased = excluded.purchased,
        purchased_at = case when excluded.purchased then coalesce(playbook_progress.purchased_at, now()) else null end,
        store_checked_at = now(),
        updated_at = now();
end $$;

revoke all on function public.playbook_state(), public.playbook_mark_done(int), public.playbook_set_trainer(int),
  public.playbook_set_purchased(uuid, boolean) from public, anon;
grant execute on function public.playbook_state(), public.playbook_mark_done(int), public.playbook_set_trainer(int) to authenticated;
revoke execute on function public.playbook_set_purchased(uuid, boolean) from authenticated;
grant execute on function public.playbook_set_purchased(uuid, boolean) to service_role;
