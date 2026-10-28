-- Проверка перед запуском: демо-профилей быть не должно. Только чтение.
--
-- Если всё чисто, запрос возвращает 0 строк и блок DO завершается без ошибки.
-- Если демо-профили остались, появятся строки со списком остатков, а затем
-- блок DO завершится ошибкой "demo profiles still present".
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/check-no-demo-bots.sql

select 'auth.users' as source, u.id::text as id, u.email::text as detail
  from auth.users u
 where u.email ilike '%@demo.renvi.app'
    or u.id in (select d.user_id from public.demo_bots d)
union all
select 'demo_bots', d.user_id::text, 'row in public.demo_bots'
  from public.demo_bots d
union all
select 'app_config', c.key, 'demo_bots config row'
  from public.app_config c
 where c.key = 'demo_bots';

do $$
declare remaining bigint;
begin
  select (select count(*) from auth.users u
           where u.email ilike '%@demo.renvi.app'
              or u.id in (select d.user_id from public.demo_bots d))
       + (select count(*) from public.demo_bots)
       + (select count(*) from public.app_config where key = 'demo_bots')
    into remaining;
  if remaining > 0 then
    raise exception 'demo profiles still present: % (run scripts/remove-demo-bots.sql first)', remaining;
  end if;
end $$;
