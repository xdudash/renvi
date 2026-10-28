-- Fix: the demo-bot reciprocal spark (0012) was inserted as a bare spark, but matches are created
-- only inside send_spark(), so "every N-th spark is mutual" never produced a match. Create the match
-- here the same way send_spark() does (ordered pair, reopen an ended match).
create or replace function public.demo_bot_spark_back() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; every int; a uuid; b uuid;
begin
  if not exists (select 1 from public.demo_bots where user_id = new.to_id) then return new; end if;
  if exists (select 1 from public.demo_bots where user_id = new.from_id) then return new; end if;
  select coalesce((value->>'match_every')::int, 5) into every from public.app_config where key = 'demo_bots';
  select count(*) into n from public.sparks s join public.demo_bots b on b.user_id = s.to_id where s.from_id = new.from_id;
  if every > 0 and n % every = 0 then
    insert into public.sparks (from_id, to_id, target_kind) values (new.to_id, new.from_id, 'profile')
      on conflict (from_id, to_id) do nothing;
    a := least(new.from_id, new.to_id); b := greatest(new.from_id, new.to_id);
    insert into public.matches (user_a, user_b) values (a, b)
      on conflict (user_a, user_b) do update set ended_at = null;
  end if;
  return new;
end $$;
