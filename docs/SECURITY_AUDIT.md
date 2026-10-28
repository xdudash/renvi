# Аудит безопасности Supabase (2026-10-28)

Проверены `supabase/migrations/0001–0013`, Edge Functions и тесты, по каждому пункту README «Правила, которые держит сервер».
Исправления в `supabase/migrations/0014_security_audit.sql`, тесты в `supabase/tests/security.sql` (запускаются из `scripts/test-db.sh`).

| Правило | Было | Стало | Доказательства |
|---|---|---|---|
| Подписку пишет только сервер | Соблюдается, тест есть | без изменений | триггер `guard_subscription_write` 0002:91-97, revoke 0002:596; тест rls.sql:69; webhook проверяет секрет `revenuecat-webhook/index.ts:9-10` |
| Лента — только своя страна | Соблюдается, тест есть | без изменений | `discover` 0005:49, `profile_is_visible` 0002:39-47; тест rls.sql:59-61 |
| Входящие искры — только своя страна | **НЕ соблюдалось**: `incoming_sparks` (0002:362-389) не проверял страну и видимость отправителя | исправлено: фильтр `profile_is_visible(from_id)` | 0014 §4; security.sql «incoming spark from another country is hidden» |
| Координаты не отдаются, расстояние округлено до км | Частично: `distance_km(a,b)` (0005:23) возвращал **точное** расстояние между любыми двумя пользователями и был вызываем любым (по умолчанию EXECUTE у PUBLIC). Подставляя свои координаты, можно трилатерировать кого угодно | `distance_km` закрыт от клиентов; `distance_label` (целые км) остаётся | 0014 §1; security.sql «exact distance_km is not callable»; RLS `private_own` 0002:140 |
| Селфи для проверки недоступно другим | Соблюдалось для Storage (`can_read_media` 0003:85-99), но **обходилось**: `send_message` принимал любой `photo_path` (например `<чужой uid>/verify/…`), после чего `can_read_media` открывал файл партнёру; `profile_photos.storage_path` тоже мог указывать на чужой файл | путь фото чата обязан быть `<свой uid>/chat/…`, фото анкеты — `<свой uid>/profile/…` | 0014 §3, §5; security.sql «chat photo cannot reference another user's selfie», «profile photo cannot point to someone else's file» |
| Фото в чате только по взаимному согласию | Соблюдается, тест есть | без изменений | `send_message` 0002:399-405; тесты rls.sql:96-112 |
| Идемпотентность по `client_id` | Соблюдается (unique 0001:140 + `on conflict` 0002:411); тест слабый (не повторяет вызов) | без изменений | rls.sql:92-95 |
| Удаление и выгрузка данных доступны всегда | Соблюдается: Edge Functions не проверяют анкету; `export_my_data` не требует `onboarding_done`, координаты вырезаны (0007:43). Теста не было | тест добавлен | `delete-account/index.ts`, `export-data/index.ts`; security.sql «export works with unfinished onboarding» |
| Запрещённые слова и ссылки — в `app_config` | Слова и ссылки в `app_config` (0002:11, 0008), меняются `admin_set_config`. Но слова проверялись только при публикации — после неё био можно было поменять прямым UPDATE | добавлен триггер `profiles_bio_words` | 0014 §3; security.sql «banned word rejected in bio after publish» |

## Другие найденные дыры (исправлены в 0014)

- **EXECUTE по умолчанию у PUBLIC/anon.** Хелперы (`distance_km`, `distance_label`, `can_read_media`, `is_blocked_pair`, `leave_deletion_feedback` и др.) были вызываемы анонимно. Теперь EXECUTE снят с `public, anon` у всех функций схемы, кроме `referral_lookup` (лендинг приглашения); нужное выдано `authenticated`.
- **Таблицы для anon.** Закрыто всё, кроме `select` на `app_config`.
- **`demo_bots`:** у `authenticated` сняты insert/update/delete (раньше держалось только на RLS).
- **Защищённые поля анкеты.** Через прямой UPDATE можно было поменять `age` (обход проверки 18+), `sensitive_consent_at`, включить `incognito` и `filter_verified_only` без тарифа. Через прямой INSERT своей строки можно было сразу поставить `onboarding_done`, `verification_status='approved'` (guard был только на UPDATE). Добавлены проверки.
- **`profile_photos.verified`** клиент мог выставить сам (значок «проверено»). Теперь только админ/сервер.
- **`report()`** сохранял текст любого сообщения по id (`message_snapshot`), включая чужие переписки. Теперь только сообщения из своих матчей.

Все `security definer` функции имеют `set search_path` (проверено тестом).

## Найдено, но не исправлено

- Тест идемпотентности не вызывает `send_message` повторно с тем же `client_id`; поведение верное по коду, тест оставлен как есть.
- `submit_appeal` и `report` не ограничивают частоту — спам возможен, но это не утечка данных.
- `register_push_token` при конфликте перепривязывает чужой токен к себе (нужно знать токен) — допустимо для смены аккаунта на устройстве.
- Функция `push` сравнивает `x-push-secret` с переменной; если `PUSH_WEBHOOK_SECRET` не задан, заголовок отсутствует → `null !== undefined`, запрос отклоняется. Не дыра, но лучше явная проверка.
- Тесты не были запущены в песочнице (нельзя было поднять Postgres); написаны по чтению кода.
