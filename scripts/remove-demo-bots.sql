-- Удаление демо-профилей (demo bots) перед запуском.
--
-- НЕ запускается автоматически. Запускать вручную, после scripts/check-no-demo-bots.sql:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/remove-demo-bots.sql
-- или вставить файл целиком в SQL Editor дашборда Supabase.
--
-- Всё выполняется в одной транзакции: при любой ошибке ничего не удаляется.
-- Удаляются auth-пользователи из public.demo_bots; профили, анкеты, фото, искры, матчи,
-- сообщения и прочие строки уходят каскадно (ON DELETE CASCADE в схеме).
-- Файлы в storage (бакет profile-media) этот скрипт НЕ трогает: см. docs/SETUP.md.

begin;

-- Счётчики (временная функция живёт только в этой сессии).
create or replace function pg_temp.demo_counts()
returns table (metric text, n bigint)
language plpgsql volatile as $$
begin
  return query
  select 'demo_bots rows'::text, count(*)::bigint
    from public.demo_bots
  union all
  select 'auth.users listed in demo_bots', count(*)::bigint
    from auth.users u where u.id in (select d.user_id from public.demo_bots d)
  union all
  select 'auth.users with @demo.renvi.app email', count(*)::bigint
    from auth.users u where u.email ilike '%@demo.renvi.app'
  union all
  select 'profiles of demo bots', count(*)::bigint
    from public.profiles p where p.id in (select d.user_id from public.demo_bots d)
  union all
  select 'profile_photos of demo bots', count(*)::bigint
    from public.profile_photos ph where ph.profile_id in (select d.user_id from public.demo_bots d)
  union all
  select 'sparks from/to demo bots', count(*)::bigint
    from public.sparks s
    where s.from_id in (select d.user_id from public.demo_bots d)
       or s.to_id in (select d.user_id from public.demo_bots d)
  union all
  select 'matches with demo bots', count(*)::bigint
    from public.matches m
    where m.user_a in (select d.user_id from public.demo_bots d)
       or m.user_b in (select d.user_id from public.demo_bots d)
  union all
  select 'messages sent by demo bots', count(*)::bigint
    from public.messages msg where msg.sender_id in (select d.user_id from public.demo_bots d)
  union all
  select 'app_config demo_bots row', count(*)::bigint
    from public.app_config c where c.key = 'demo_bots';
end $$;

select 'before' as stage, c.metric, c.n from pg_temp.demo_counts() c;

-- id ботов из этого списка понадобятся для очистки storage (docs/SETUP.md, шаг 4).
select 'demo bot id' as stage, d.user_id as bot_id
  from public.demo_bots d order by d.user_id;

-- Защита: удаляем только тех, у кого реально почта @demo.renvi.app.
-- Если в demo_bots попал реальный пользователь, транзакция откатывается целиком.
do $$
begin
  if exists (
    select 1
      from public.demo_bots d
      left join auth.users u on u.id = d.user_id
     where u.email is null or u.email not ilike '%@demo.renvi.app'
  ) then
    raise exception 'demo_bots lists a user whose email is not @demo.renvi.app; nothing was deleted';
  end if;
end $$;

delete from auth.users where id in (select d.user_id from public.demo_bots d);

delete from public.app_config where key = 'demo_bots';

-- Проверка внутри транзакции: после удаления не должно остаться строк.
do $$
declare left_over bigint;
begin
  select (select count(*) from public.demo_bots)
       + (select count(*) from public.app_config where key = 'demo_bots')
    into left_over;
  if left_over > 0 then
    raise exception 'demo bot cleanup incomplete (% rows left); rolled back', left_over;
  end if;
end $$;

select 'after' as stage, c.metric, c.n from pg_temp.demo_counts() c;

commit;
