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
   npx supabase functions deploy delete-account export-data revenuecat-webhook push
   npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=... PUSH_WEBHOOK_SECRET=...
   # необязательно — письмо со ссылкой на выгрузку данных:
   npx supabase secrets set RESEND_API_KEY=... EXPORT_FROM_EMAIL="RENVI <no-reply@ваш-домен>"
   ```
6. **Database → Webhooks** (для push): три вебхука на функцию `push`, метод POST, заголовок `x-push-secret: <PUSH_WEBHOOK_SECRET>`:
   `messages` (INSERT), `matches` (INSERT), `dates` (INSERT, UPDATE). Тексты пушей без имён и сообщений.
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

## 5. Сборки

```bash
npx eas build --profile development --platform ios   # dev-клиент
npx eas build --profile production --platform all
npx eas submit --platform ios
```
Bundle id / package сейчас `com.renvi.app` — **решить до первой публикации** (бриф: название RENVI юридически не проверено, bundle id нельзя сменить после выхода).

## Деплой и сборки через GitHub

Workflow-файлы: `.github/workflows/deploy-supabase.yml` и `.github/workflows/eas-build.yml`. Значения хранятся только в GitHub (Settings → Secrets and variables → Actions), в репозиторий не попадают.

**Secrets (Repository secrets):**

| Секрет | Откуда |
|---|---|
| `EXPO_TOKEN` | expo.dev → Account settings → Access tokens |
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF` | Supabase → Project Settings → General (Reference ID) |
| `SUPABASE_DB_PASSWORD` | пароль БД, заданный при создании проекта (Database → Reset password) |

**Variables (Repository variables, публичные значения, не секреты):**
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_APP_URL`. Для облачной сборки workflow на лету копирует их в `env` выбранного профиля `eas.json` (в коммит это не попадает), потому что сборка идёт на серверах EAS и не видит окружение GitHub-раннера.

**Environment `production`:** Settings → Environments → New environment → `production` → Required reviewers (владелец). Тогда деплой Supabase и production-сборки/обновления ждут ручного подтверждения. Environment `preview` создаётся автоматически без защиты.

**Деплой Supabase** (Actions → Deploy Supabase → Run workflow; также срабатывает при push в `main`, если изменились файлы в `supabase/**`; чтобы оставить только ручной запуск, удалите блок `push:`): сначала `supabase db push --dry-run`, затем `db push` и `functions deploy` для каждой папки в `supabase/functions` (кроме `_shared`). Секреты функций CI **не** выставляет: один раз выполните локально `npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=... PUSH_WEBHOOK_SECRET=...` (и необязательные `RESEND_API_KEY`, `EXPORT_FROM_EMAIL`), см. раздел 2.5. Вебхуки базы (2.6) тоже настраиваются вручную.

**Разовая подготовка EAS (локально, до первого запуска workflow):**
1. `npx eas-cli@latest login`, затем `npx eas-cli@latest init` — создаст проект на expo.dev и впишет `extra.eas.projectId` в `app.json`. Мы его не придумываем: **пока `projectId` нет, workflow сборки намеренно падает** с сообщением. Закоммитьте изменённый `app.json`.
2. Для OTA-обновлений: `npx expo install expo-updates` и `npx eas-cli@latest update:configure` (добавит `updates.url`); закоммитьте. Без этого job `update` падает. В `app.json` уже задан `runtimeVersion: { policy: "appVersion" }`: OTA получают только сборки с той же `version`; при смене нативного кода поднимайте `version`.
3. Учётные данные магазинов: `npx eas-cli@latest credentials` (iOS: Apple Developer, сертификат и provisioning profile, ключ APNs; Android: keystore и FCM/google-services). Для iOS internal-сборок нужно зарегистрировать устройства: `npx eas-cli@latest device:create`. Первая сборка на каждую платформу удобнее интерактивно локально, чтобы EAS создал подписи; затем CI работает с `--non-interactive`.

**Сборки** (Actions → EAS Build and Update → Run workflow): `job=build`, `platform` (all/ios/android), `profile` (development / preview / production). Запускается `eas build --non-interactive --no-wait`, результат смотрите на expo.dev. `preview`: Android APK и iOS internal distribution (ad-hoc); `production`: AAB / App Store, `autoIncrement`. Симулятор iOS: `npx eas-cli@latest build --profile development-simulator --platform ios` локально. Отправка в магазины: `npx eas-cli@latest submit` (в CI не включена).
**OTA:** `job=update`, `channel` (preview/production), `platform`, `message` — публикует `eas update`.

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
