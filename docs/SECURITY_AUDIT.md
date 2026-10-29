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

## Внешний аудит серверных правил (2026-10-28, main 4ee8a89) — миграция `0020_audit_server_rules.sql`

Каждый пункт перепроверен на текущем main (f5fdcf6, миграции 0001–0019): 0015–0019 ни один из них не закрывали.
Тесты: `supabase/tests/audit_server.sql` (в `scripts/test-db.sh` последним SQL-набором). На миграциях без 0020
(`psql -v soft=1 -f supabase/tests/audit_server.sql` — режим, где провалы печатаются и прогон продолжается)
**36 проверок падают, 26 проходят** (контрольные: исключения, которые должны работать и до, и после); после 0020 — **62 из 62 проходят**,
все прежние наборы тоже зелёные (Postgres 16, 2026-10-29).

| ID | Вердикт на main | Исправление (0020) | Тест (audit_server.sql) |
|---|---|---|---|
| S1 P1 инкогнито | **Подтверждено**: `discover` скрывал, но `profile_is_visible()` инкогнито не проверял → строки `profiles`/`profile_photos`/`profile_prompts`, `profile_card`, `can_read_media` и `send_spark` открывали профиль любому из той же страны | Правило перенесено в `profile_is_visible()` — от него зависят RLS трёх таблиц, `profile_card`, `can_read_media`, `send_spark`, `pass_profile`, `incoming_sparks`. Исключения (по тексту в приложении `privacyVisibility.incognitoSub`: «Только люди, которым вы поставили лайк»): владелец, админ, тот, кому владелец отправил искру, партнёр по **активному** матчу. Завершённый матч доступа не даёт | «S1 incognito profile row is hidden…», «…photos/prompts rows are hidden», «profile_card … is null», «media is not readable», «cannot spark an incognito profile», «ended match gives no incognito access»; исключения: «person the incognito user sparked…», «active match partner…», «owner…», «admin…» |
| S2 P1 санкции | **Подтверждено**: забаненный/приостановленный с живой сессией мог вызывать `send_message`, `send_spark` и др. | `account_restricted(uid)`: `profiles.suspended_until`/`blocked_until` в будущем **или** неснятая строка `account_sanctions` (бан без срока/со сроком в будущем, приостановка с `until` в будущем). Новая колонка `account_sanctions.lifted_at`; `admin_sanction('lift')` и принятая апелляция её ставят; при миграции уже снятые санкции помечены снятыми. `assert_account_active()` (ошибка `account restricted`, 42501) вызывается первым в функциях из списка ниже | «S2 banned user cannot send_message / send_spark / pass / browse discover / propose a date / respond to a date / accept / request / join a video call / grant photo consent / unblock», «can still report / contact support / export data / decline a call», «every user-action RPC calls assert_account_active()», «after lift…», «active suspension row restricts…», «expired suspension does not restrict» |
| S3 P1 удаление `profiles` | **Подтверждено**: политика `profiles_delete` позволяла удалить свою строку; каскадом пропадали санкции, чужие блокировки, матчи; `save_onboarding` создавал чистую анкету | Политика удалена, `DELETE` на `profiles` у `authenticated` отозван, триггер `profiles_guard_delete` пропускает удаление только от `postgres`/`service_role`/`supabase_admin`/`supabase_auth_admin` (каскад от `auth.users` выполняется от владельца таблицы). Прямые `insert/update/delete` в `blocks` тоже закрыты — только `block_user`/`unblock_user`. Удаление аккаунта (`delete-account` → Auth admin API → каскад) работает как раньше | «S3 clients have no DELETE on profiles», «clients write blocks only through RPCs», «banned user / blocker cannot delete own profile row», «sanction and ban flag survive», «other people's blocks survive», «save_onboarding does not produce a clean profile», «deleting the auth user still removes the profile» |
| S4 P1 повторное открытие матча | **Подтверждено**: после `end_match` старые искры оставались, повторный `send_spark` ставил `ended_at = NULL` без участия второго | Выбрано сравнение времени (а не удаление искр: удаление вернуло бы людей друг другу в ленту). Матч открывается заново, только если **обе** искры новее `ended_at`. Повторный `send_spark` после конца матча обновляет `created_at` своей искры (новое согласие); старая искра партнёра не считается. Без завершённого матча `send_spark` по-прежнему идемпотентен. `end_match`/`send_spark` пишут `clock_timestamp()`, чтобы порядок сохранялся и внутри одной транзакции; при открытии `ended_by` сбрасывается | «S4 repeating send_spark after end_match does not re-open the match», «match stays ended…», «still not reopened on a third call», «a NEW spark from the other person after the end re-opens it», «re-opened match is active again» |
| S5 P1 `profile_card` для заблокировавшего | **Подтверждено**: ветка «я заблокировал» возвращала полную анкету, минуя видимость (в т.ч. приостановленную) — встречная блокировка открывала профиль того, кто заблокировал тебя | Полная карточка — только владельцу, админу или если профиль видим и пара не заблокирована. Заблокировавший получает снимок `{profile_id, display_name, blocked: true, interests: [], prompts: [], photos: []}`: без фото, возраста, города, био, расстояния (фото и так закрыты `can_read_media`) | «S5 blocker still gets the display name…», «counter-block does not reveal the (paused) profile…», «photos stay closed», «a visible profile one blocked is also only a snapshot», «after unblock the full card is back» |
| S6 P2 прямое чтение входящих искр | **Подтверждено**: `sparks_read` пускал получателя (`to_id = auth.uid()`), Free видел отправителя и комментарий в обход `incoming_sparks` | `sparks_read`: только свои отправленные (`from_id = auth.uid()`) и админ. Клиент таблицу `sparks` напрямую не читает (только RPC `incoming_sparks`, `match_context`) — правки клиента не нужны | «S6 recipient cannot SELECT incoming spark rows», «Free recipient still gets only the count via RPC», «sender still reads own sent sparks» |
| S7 P2 `guard_subscription_write` | **Подтверждено**: на DELETE возвращался `NEW` (NULL) → удаление отменялось, после удаления пользователя оставались строки-сироты | Для `DELETE` возвращается `OLD`; существующие сироты (`user_id` без `auth.users`) удалены миграцией | «S7 subscription row is removed with the auth user», «no orphan subscriptions», «clients still cannot delete subscriptions» |

### S2: решение по каждой `security definer` функции, доступной клиенту

- **Блокируются при активной санкции** (`assert_account_active()` первым): `send_spark`, `pass_profile`, `undo_last_pass`, `discover`, `send_message`, `set_photo_consent` (только выдача согласия), `propose_date`, `respond_date`, `unblock_user`, `request_video_call`, `respond_video_call` (только `accept`), `video_call_join` (через него Edge Function `video-call` выдаёт токен). `send_voice_message` на main нет (миграции 0017 и `voice.sql` отсутствуют) — при её появлении добавить проверку и имя в каталожный тест.
- **Остаются доступны** — безопасность и права пользователя: `report`, `submit_appeal`, `submit_support`, `submit_support_chat`, `export_my_data`, `leave_deletion_feedback` (удаление идёт через Edge Function `delete-account`), `block_user`, `end_match`, `cancel_date`, `end_video_call`, `respond_video_call('decline')`, `set_photo_consent(false)`, `delete_own_message`.
- **Остаются доступны** — своё состояние и чтение: `save_onboarding`, `publish_profile`, `save_filters` (анкета под санкцией и так скрыта `profile_is_visible` по `suspended_until`), `request_verification`, `register_push_token`, `my_referral`, `likes_today`, `incoming_sparks`, `list_matches`, `list_messages`, `match_context`, `mark_match_read`, `set_match_settings`, `profile_card` (те же правила видимости), служебные хелперы (`is_admin`, `my_tier`, `tier_flag`, `daily_like_limit`, `is_blocked_pair`, `profile_is_visible`, `match_partner`, `filter_words`, `distance_label`, `can_read_media`), `referral_lookup`.
- **Админские** (`admin_*`) — проверяют `is_admin()`, санкции к админам не применяются.
- Сервисные (`digest_*`, `weekly_digest_candidates`, `check_rate_limit`, `video_call_close_stale`, триггеры) клиенту недоступны.

### Изменения клиента

`src/app/blocked.tsx`: в снимке заблокированного нет `age`, строка показывает только имя (иначе было бы «Имя, undefined»). Других правок нет.

### Риски и что не проверено

- Санкции имеют два источника (`profiles.suspended_until` и строки `account_sanctions`). Снимать санкцию нужно через `admin_sanction('lift')` или принятую апелляцию; ручной `UPDATE profiles set suspended_until = null` без `lifted_at` оставит пользователя ограниченным. Приостановка с `until = NULL` считается неактивной (как и в `profiles`, где она ничего не ставит).
- Клиент не показывает отдельный текст для `account restricted` (общая ошибка); `Gate` и так уводит забаненного на экран блокировки.
- Санкции и блокировки по-прежнему удаляются вместе с аккаунтом (`auth.users` → каскад) — это удаление по запросу пользователя; новый аккаунт получает новый uid.
- Снимок для списка заблокированных отдаёт `display_name` любого uid, который пользователь заблокировал через `block_user` (uid нужно знать заранее).
- Edge Functions и Storage-политики на настоящем Supabase не запускались; проверено на локальном Postgres 16 со стабом `auth`.
