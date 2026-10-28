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
- ~~`submit_appeal` и `report` не ограничивают частоту~~ — **сделано** (см. ниже).
- ~~`register_push_token` перепривязывает чужой токен~~ — **сделано** (см. ниже).
- ~~Функция `push`: неявная проверка секрета~~ — **сделано** (см. ниже).
- ~~Тесты не были запущены~~ — запущены на локальном Postgres 16 (2026-10-28): 47 + 4 + 31 + 16 проверок и 4 bun-теста прошли.

## Follow-ups закрыты (миграция `0015_rate_limits_push_tokens.sql`)

| Пункт | Решение | Доказательства |
|---|---|---|
| Частота `report()` / `submit_appeal()` | Счётчик `rate_limit_counters` (user, action, час) с RLS и без прав у клиентов; `check_rate_limit()` (security definer) вызывается первым в обеих функциях. Лимиты в `app_config.rate_limits` (по умолчанию `{"report":10,"submit_appeal":5}`), меняются через `admin_set_config` без сборки; ключа нет — лимита нет. При превышении: `rate limited`, SQLSTATE **`P0429`**, `detail` = действие | 0015 §1; `supabase/tests/rate_limits.sql` («report over the hourly limit is rejected with P0429», «limit is read from app_config», «limit resets in the next hour», «appeal over the hourly limit…»). На старом `report()` тест падает |
| `register_push_token` | Чужой токен больше не перепривязывается `UPDATE`-ом. Если тот же токен регистрирует другой аккаунт, строка старого владельца **удаляется**, для вызывающего создаётся новая; остальные устройства старого владельца не трогаются. Сервер не может отличить «то же устройство» иначе, чем по токену (токен Expo = установка приложения). Компромисс: знающий чужой токен может отписать то устройство от чужого аккаунта (но не получить его пуши); токены никому не отдаются (RLS `push_own`). Альтернатива «отказать» ломает смену аккаунта на телефоне и оставляет пуши аккаунта A на телефоне, где уже вошёл B. Добавлены проверки: вход обязателен, длина токена 10–512 | 0015 §2; rate_limits.sql «old owner row was removed and a new row created», «old owner keeps tokens of other devices». На старой функции тест падает |
| Секрет `push` | Явно: если `PUSH_WEBHOOK_SECRET` не задан — 401 на любой запрос (и `console.error`); иначе сравнение в постоянном времени через `_shared/secret.ts`, неверный/пустой заголовок — 401. `revenuecat-webhook` уже проверял `!secret`, переведён на тот же хелпер. `delete-account`/`export-data` проверяют JWT через `auth.getUser()` — неявных сравнений с env нет | `supabase/functions/push/index.ts`, `_shared/secret.ts`; `supabase/tests/functions_secret.test.ts` (bun): пустой секрет отклоняется, в функциях нет сравнения `=== Deno.env.get(...)` (старый `push` этот тест не проходит) |

Не проверено: Edge Functions не запускались в Deno/Supabase (тест — юнит хелпера и статическая проверка исходников); миграция не применялась к реальному проекту. Клиент (`src/lib/api.ts`) не показывает отдельный текст для `P0429` — сейчас это общая ошибка.

## Голосовые сообщения (миграция `0017_voice_messages.sql`)

| Правило | Как держится | Доказательства |
|---|---|---|
| Отдельное взаимное согласие | Таблица `voice_consents` (не фото-согласие: голос узнаваем, согласие на фото не распространяется на голос, существующие пользователи не включаются молча). Меняется только через `set_voice_consent()` | voice.sql «mutual photo consent alone does not allow voice», «voice blocked until the partner allows it» |
| Только свой файл | `send_voice_message()` принимает только `<свой uid>/voice/<uuid>.m4a` (проверка как в 0014 §5 + точный формат); в Storage restrictive-политика `media_voice_name` на тот же формат | «voice path in another user's folder is rejected», «path traversal is rejected» |
| Длительность ≤ 120 с | `messages.voice_duration_ms` 1…120000 (check) — метаданные от клиента | «voice longer than 120 s is rejected» |
| Чтение только двумя участниками | `can_read_media` для `voice/`: файл отправлен владельцем в активный матч с вызывающим, нет блокировки, оба согласия включены, сообщение не удалено | «outsider cannot play voice», «partner from another conversation…», «voice unreadable after the listener revokes consent / a block / unmatch» |
| Частота | `check_rate_limit('voice_message')`, по умолчанию 60/час в `app_config.rate_limits`; повтор того же `client_id` квоту не тратит | «voice over the hourly limit is rejected with P0429», «idempotent retry … still works at the limit» |
| Запрещённые слова | к аудио не применяются (текста нет; голосовое не может содержать текст или фото — check) | «a voice message carries no text or photo» |

Не проверено: фактическая длина аудио сервером не проверяется (клиент может загрузить файл длиннее, чем заявлено); размер файла ограничен только лимитом бакета. Удаление сообщения не удаляет файл из Storage (он становится недоступен партнёру). Политика Storage не запускалась (в тестовой базе нет схемы `storage`).
