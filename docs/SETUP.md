# Настройка RENVI: сервер, магазины, уведомления

Все ключи ниже — только в переменных окружения, секретах Supabase / EAS и менеджере паролей. В репозиторий и чаты их не кладём.

## 1. Переменные окружения приложения (`.env`)

| Переменная | Где взять | Секрет? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | нет |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | там же, `anon` / publishable key | нет (публичный) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` | RevenueCat → Project → API keys (public SDK keys) | нет |
| `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` | hCaptcha (если включаете CAPTCHA) | нет |
| `EXPO_PUBLIC_APP_URL` | домен сайта для ссылок-приглашений (`/invite/КОД`) | нет |

`service_role` key в приложение **не** попадает никогда — только в Edge Functions (Supabase подставляет его сам).

## 2. Supabase

1. Создайте проект в регионе **EU (Frankfurt)**.
2. `npx supabase link --project-ref <ref>` → `npx supabase db push` — применит `supabase/migrations/*` (схема, RLS, функции, бакет `profile-media` с правилами доступа, публикация Realtime для `messages`).
3. **Authentication → Providers → Email**: включён. Подтверждение почты — по решению команды (экран «Письмо отправлено» поддерживает оба режима).
   **URL Configuration**: Site URL = адрес сайта; Redirect URLs: `renvi://**` и адрес сайта.
   **Rate limits** — оставить включёнными.
4. **CAPTCHA** (по желанию): Authentication → Bot and Abuse Protection → hCaptcha + `EXPO_PUBLIC_HCAPTCHA_SITE_KEY`. Без ключа шаг CAPTCHA в регистрации пропускается.
5. **Edge Functions**:
   ```bash
   npx supabase functions deploy delete-account export-data revenuecat-webhook push video-call
   npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=... PUSH_WEBHOOK_SECRET=...
   # необязательно — видеозвонок перед встречей (раздел 4a):
   npx supabase secrets set DAILY_API_KEY=...
   # необязательно — письмо со ссылкой на выгрузку данных:
   npx supabase secrets set RESEND_API_KEY=... EXPORT_FROM_EMAIL="RENVI <no-reply@ваш-домен>"
   ```
6. **Database → Webhooks** (для push): вебхуки на функцию `push`, метод POST, заголовок `x-push-secret: <PUSH_WEBHOOK_SECRET>`:
   `messages` (INSERT), `matches` (INSERT), `dates` (INSERT, UPDATE), `video_calls` (INSERT, UPDATE — если включаете видеозвонки). Тексты пушей без имён и сообщений.
7. **Администраторы**: SQL Editor →
   `insert into public.admins (user_id) select id from auth.users where email = 'founder@...';`
   Админка открывается в веб-версии по адресу `/admin`.
8. **Документы**: в админке → «Тарифы и настройки» → `legal_urls` впишите ссылки на политику, условия, правила, подписки, модерацию.

## 3. Подписки (RevenueCat поверх App Store и Google Play)

1. В App Store Connect и Google Play создайте подписки Plus и Premium (месяц и год).
2. RevenueCat: Entitlements `plus` и `premium`; Offering `default` с пакетами **`plus_month`, `plus_year`, `premium_month`, `premium_year`** (идентификаторы пакетов важны — по ним приложение находит тарифы).
3. RevenueCat → Integrations → Webhooks: URL `https://<ref>.functions.supabase.co/revenuecat-webhook`, Authorization header `Bearer <REVENUECAT_WEBHOOK_SECRET>`.
4. Приложение логинит RevenueCat идентификатором пользователя Supabase — так вебхук знает, кому включить тариф. Тестовые (sandbox) покупки дают доступ, но помечены `sandbox` и не считаются платящими в дашборде.
5. Цены в приложении берутся из магазина; предварительные цены из брифа лежат в `app_config.prices_preliminary` только для справки.

## 4. Push-уведомления

1. `npx eas init` (создаст projectId), `npx eas credentials` — ключ APNs для iOS, файл FCM (google-services) для Android.
2. Токен устройства привязывается к аккаунту на экране «Уведомления после совпадения» (`register_push_token`).
3. Отправку делает функция `push` по вебхукам из шага 2.6; удалённые приложения чистятся автоматически.

## 4a. Видеозвонок перед встречей (Daily.co, необязательно)

Короткий видеозвонок двух людей из одного матча до встречи. Без ключа Daily функция отвечает `503 video_unavailable`, и приложение просто не показывает кнопку «Видеозвонок» — всё остальное работает.

Как устроено: один предлагает звонок, второй соглашается (`request_video_call` / `respond_video_call`, миграция `0018_video_calls.sql`). Только после согласия обоих Edge Function `video-call` проверяет доступ (`video_call_join`: активный матч, нет блокировки, сессия не истекла, лимит частоты), создаёт **закрытую** комнату Daily на эту сессию (максимум 2 участника, закрывается вместе с сессией, не дольше 30 минут) и выдаёт токен только этому пользователю. Приглашение действует 10 минут. Звонок открывается в приложении (WebView с Daily Prebuilt); RENVI его не записывает.

1. Зарегистрируйтесь на [daily.co](https://www.daily.co/) и создайте домен (например `renvi.daily.co`). Регион данных и тариф — по решению команды (бесплатного тарифа хватает для теста).
2. Dashboard → **Developers** → скопируйте **API key**. Это секрет: только в Supabase, не в `.env` приложения и не в репозиторий.
3. В настройках домена Daily проверьте, что **запись (recording) выключена**, — комнаты RENVI её не включают.
4. Ключ и функция:
   ```bash
   npx supabase secrets set DAILY_API_KEY=<ключ Daily>
   npx supabase functions deploy video-call
   ```
5. Вебхук `video_calls` (INSERT, UPDATE) на функцию `push` — см. шаг 2.6 (пуш «Запрос на видеозвонок» / «Видеозвонок принят», учитывает переключатель «Свидания» в настройках уведомлений).
6. Лимиты частоты — в `app_config.rate_limits` (админка → «Тарифы и настройки»): `video_call` — новых приглашений в час на пользователя (по умолчанию 6), `video_call_join` — запросов комнаты/токена в час (30).
7. Нужна **новая сборка** приложения (dev/production): в `app.json` добавлены разрешения камеры и микрофона (iOS `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`; Android `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`; `RECORD_AUDIO` больше не в `blockedPermissions`). Без новой сборки звонок на телефоне не получит камеру и микрофон.
8. Выключить функцию: `npx supabase secrets unset DAILY_API_KEY` — кнопка пропадёт у всех после перезапуска приложения.

Проверка после настройки: два тестовых аккаунта с матчем → в чате «Видеозвонок» → «Предложить» → со второго телефона «Согласиться» → «Начать звонок» на обоих.

## 5. Сборки

```bash
npx eas build --profile development --platform ios   # dev-клиент
npx eas build --profile production --platform all
npx eas submit --platform ios
```
Bundle id / package сейчас `com.renvi.app` — **решить до первой публикации** (бриф: название RENVI юридически не проверено, bundle id нельзя сменить после выхода).

## 6. Локальная проверка

- База: `npm run test:db` (нужны `psql` и Postgres; переменные `PGHOST`, `PGPORT`, `PGUSER`).
- Полный стек локально: `npx supabase start` (Docker) → `npx supabase db reset` → `npx supabase functions serve`.
- Сквозные тесты: задайте переменные из `e2e/run-all.sh` и выполните `npm run test:e2e`.
  С `PROTOTYPE_HTML=<путь к прототипу>` скрипт дополнительно снимает все 94 экрана приложения и прототипа и собирает листы сравнения в `e2e/out/sheets/`.

## Перед запуском: удалить демо-профили

Демо-профили создаёт `scripts/seed-demo-bots.mjs`, их id хранятся в `public.demo_bots` (миграции 0012, 0013); почта у них `@demo.renvi.app`. Удаление ничего не запускает само — выполняйте вручную, строго по порядку. Строка подключения (`DATABASE_URL`) — из Supabase → Connect; в репозиторий её не кладём.

1. **Проверка:** `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/check-no-demo-bots.sql`. Ожидаем 0 строк и без ошибки. Если появились строки или `demo profiles still present` — демо остались, переходите к шагу 2.
2. **Удаление:** `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/remove-demo-bots.sql`. Скрипт в одной транзакции удаляет auth-пользователей из `demo_bots` (профили, фото, искры, матчи, сообщения — каскадом) и строку `demo_bots` в `app_config`. Он печатает счётчики `before` и `after`, а также список id ботов (`demo bot id`) — **сохраните этот список** для шага 4. Ошибка → транзакция откатывается, ничего не удалено.
3. **Повторная проверка:** снова `check-no-demo-bots.sql`. Должна пройти без строк и ошибок.
4. **Storage:** если в бакете `profile-media` остались папки `<bot_id>/…` (фото ботов), удалите их через Storage в дашборде Supabase или Storage API, по id из шага 2. Прямой `DELETE` из `storage.objects` Supabase не разрешает.
5. **Админка:** откройте `/admin` и убедитесь, что число пользователей и анкет совпадает с реальными аккаунтами, а демо-профилей в списках нет.
