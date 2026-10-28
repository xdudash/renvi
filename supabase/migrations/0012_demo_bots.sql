-- Demo profiles ("bots") for testing before launch. Remove them before real users arrive:
--   delete from auth.users where id in (select user_id from public.demo_bots);
create table if not exists public.demo_bots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.demo_bots enable row level security;
create policy demo_bots_admin on public.demo_bots for select to authenticated using (public.is_admin());

insert into public.app_config (key, value) values ('demo_bots', '{"match_every": 5, "welcome_sparks": 3}')
  on conflict (key) do nothing;

-- Every N-th spark a real user sends to bots is answered by that bot, so send_spark() creates a match.
create or replace function public.demo_bot_spark_back() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; every int;
begin
  if not exists (select 1 from public.demo_bots where user_id = new.to_id) then return new; end if;
  if exists (select 1 from public.demo_bots where user_id = new.from_id) then return new; end if;
  select coalesce((value->>'match_every')::int, 5) into every from public.app_config where key = 'demo_bots';
  select count(*) into n from public.sparks s join public.demo_bots b on b.user_id = s.to_id where s.from_id = new.from_id;
  if every > 0 and n % every = 0 then
    insert into public.sparks (from_id, to_id, target_kind) values (new.to_id, new.from_id, 'profile')
      on conflict (from_id, to_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists sparks_demo_bots on public.sparks;
create trigger sparks_demo_bots after insert on public.sparks for each row execute function public.demo_bot_spark_back();

-- When a real user publishes a profile, a few compatible bots send sparks, so "Искры" is not empty.
create or replace function public.demo_bot_welcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare k int;
begin
  if not (new.onboarding_done and not coalesce(old.onboarding_done, false)) then return new; end if;
  if exists (select 1 from public.demo_bots where user_id = new.id) then return new; end if;
  select coalesce((value->>'welcome_sparks')::int, 3) into k from public.app_config where key = 'demo_bots';
  insert into public.sparks (from_id, to_id, target_kind, comment)
  select b.user_id, new.id, 'profile', (array['Привет! Зацепил твой ответ 🙂', 'Кажется, у нас похожие планы на выходные', null])[1 + floor(random() * 3)::int]
  from public.demo_bots b join public.profiles p on p.id = b.user_id
  where p.country = new.country
    and (new.seeking = 'everyone' or (new.seeking = 'men' and p.gender = 'man') or (new.seeking = 'women' and p.gender = 'woman'))
    and (p.seeking = 'everyone' or (p.seeking = 'men' and new.gender = 'man') or (p.seeking = 'women' and new.gender = 'woman'))
  order by random() limit k
  on conflict (from_id, to_id) do nothing;
  return new;
end $$;
drop trigger if exists profiles_demo_welcome on public.profiles;
create trigger profiles_demo_welcome after update on public.profiles for each row execute function public.demo_bot_welcome();

grant select on public.demo_bots to authenticated;
grant all on public.demo_bots to service_role;
