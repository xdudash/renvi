# Настройка RENVI: сервер, магазины, уведомления

Все ключи ниже — только в переменных окружения, секретах Supabase / EAS и менеджере паролей. В репозиторий и чаты их не кладём.

## 1. Переменные окружения приложения (`.env`)

| Переменная | Где взять | Секрет? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | нет |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | там же, `anon` / publishable key | нет (публичный) |
| `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` | hCaptcha (если включаете CAPTCHA) | нет |
| `EXPO_PUBLIC_APP_URL` | домен сайта для ссылок-приглашений (`/invite/КОД`) | нет |

`service_role` key в приложение **не** попадает никогда — только в Edge Functions (Supabase подставляет его сам).

## 2. Supabase

1. Создайте проект в регионе **EU (Frankfurt)**.
2. `npx supabase link --project-ref <ref>` → `npx supabase db push` — применит `supabase/migrations/*` (схема, RLS, функции, бакет `profile-media` с правилами доступа, публикация Realtime для `messages`).
3. **Authentication → Providers → Email**: включён. Подтверждение почты — по решению команды (экран «Письмо отправлено» поддерживает оба режима).
   **URL Configuration**: Site URL = адрес сайта; Redirect URLs: `renvi://**` и адрес сайта.
   **Восстановление пароля** (экран `/reset-password`): письмо ведёт на `renvi://reset-password` (нативное приложение) или `<адрес сайта>/reset-password` (веб). Добавьте в Redirect URLs именно их:
   - `renvi://reset-password` (достаточно `renvi://**`);
   - `https://<адрес сайта>/reset-password` и `http://localhost:8081/reset-password` для локальной веб-разработки;
   - для Expo Go / dev-клиента — `exp://**` (адрес вида `exp://<ip>:8081/--/reset-password`, его печатает `Linking.createURL`).
   Приложение понимает все три формата ссылки (PKCE `?code=`, `?token_hash=&type=recovery`, неявный `#access_token=&refresh_token=`). `detectSessionInUrl` в `src/lib/supabase.ts` оставлен `false`: ссылку разбирает сам экран `/reset-password`, чтобы не конкурировать с роутером. Для веба хостинг должен отдавать `index.html` на любой путь (SPA-fallback), иначе `/reset-password` даст 404.
   **Rate limits** — оставить включёнными.
4. **CAPTCHA** (по желанию): Authentication → Bot and Abuse Protection → hCaptcha + `EXPO_PUBLIC_HCAPTCHA_SITE_KEY`. Без ключа шаг CAPTCHA в регистрации пропускается.
5. **Edge Functions**:
   ```bash
   npx supabase functions deploy delete-account export-data push weekly-digest video-call
   npx supabase secrets set PUSH_WEBHOOK_SECRET=...
   # необязательно — видеозвонок перед встречей (раздел 4a):
   npx supabase secrets set DAILY_API_KEY=...
   # необязательно — письмо со ссылкой на выгрузку данных:
   npx supabase secrets set RESEND_API_KEY=... EXPORT_FROM_EMAIL="RENVI <no-reply@ваш-домен>"
   ```
6. **Database → Webhooks** (для push): вебхуки на функцию `push`, метод POST, заголовок `x-push-secret: <PUSH_WEBHOOK_SECRET>`:
   `messages` (INSERT), `matches` (INSERT), `dates` (INSERT, UPDATE), `video_calls` (INSERT, UPDATE — если включаете видеозвонки). Тексты пушей без имён и сообщений.
7. **Администраторы**: SQL Editor →
   `insert into public.admins (user_id) select id from auth.users where email = 'founder@...';`
   Админка открывается в веб-версии по адресу `/admin`. Так добавляется только первый админ; следующих добавляет
   существующий админ в разделе «Админы» (последнего админа удалить нельзя). Все действия админов — санкции, решения
   по жалобам, апелляциям и селфи, изменения настроек, управление админами — пишутся в `admin_actions`
   (раздел «Журнал действий»); настройки `app_config` меняются только через проверяющий RPC `admin_config_set`.
8. **Документы**: в админке → «Настройки» → «Документы и поддержка» впишите https-ссылки на политику, условия, правила, модерацию и e-mail поддержки (дашборд напоминает, пока они пусты).

## 3. Без подписок: лимит искр

RENVI бесплатен: покупок, тарифов, RevenueCat и магазинных подписок нет (решение основателя, [RELEASE_4_NO_SUBSCRIPTIONS.md](RELEASE_4_NO_SUBSCRIPTIONS.md)).
Единственный лимит — защита от спама: `app_config.daily_spark_limit` (по умолчанию 100 искр на пользователя за сутки UTC).
Сервер отказывает в лишней искре (`send_spark` → `daily limit`, SQLSTATE `P0003`), приложение показывает нейтральный экран «Лимит на сегодня исчерпан» без предложений что-либо купить.
Значение меняется в админке → «Настройки» → «Дневной лимит искр» (целое число 1–100000, изменение пишется в журнал).

## 4. Push-уведомления

1. `npx eas init` (создаст projectId), `npx eas credentials` — ключ APNs для iOS, файл FCM (google-services) для Android.
2. Токен устройства привязывается к аккаунту на экране «Уведомления после совпадения» (`register_push_token`).
3. Отправку делает функция `push` по вебхукам из шага 2.6; удалённые приложения чистятся автоматически.

### Еженедельная сводка «новые анкеты» (миграция 0019, функция `weekly-digest`)

Раз в неделю каждому активному пользователю уходит пуш (и письмо, если он включил его в «Уведомлениях»): сколько новых анкет в его стране подходят под его «кого ищу» и фильтры. В тексте только число — без имён, фото и данных других людей. Не чаще одного раза в 7 дней на пользователя (таблица `digest_log`). Пуш включён по умолчанию, письмо выключено.

1. Деплой и секреты:
   ```bash
   npx supabase functions deploy weekly-digest --no-verify-jwt
   npx supabase secrets set DIGEST_CRON_SECRET=<длинная случайная строка>
   # письма (необязательно; без RESEND_API_KEY уходит только пуш):
   npx supabase secrets set RESEND_API_KEY=... DIGEST_FROM_EMAIL="RENVI <no-reply@ваш-домен>"   # иначе берётся EXPORT_FROM_EMAIL
   ```
   Пока `DIGEST_CRON_SECRET` не задан, функция отвечает 401 на любой запрос.
2. Расписание: **Integrations → Cron** (или SQL Editor). Нужны расширения `pg_cron` и `pg_net`. Секрет и адрес проекта храните в Vault, а не в SQL:
   ```sql
   select vault.create_secret('<DIGEST_CRON_SECRET>', 'digest_cron_secret');
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select cron.schedule('weekly-digest', '5 * * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-digest',
       headers := jsonb_build_object('Content-Type', 'application/json',
         'x-digest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'digest_cron_secret')),
       body := '{}'::jsonb);
   $$);
   ```
   Задача запускается каждый час, а функция сама отправляет только в день недели и после часа из настройки (часовой запуск страхует от сбоя одного вызова; повторно никому не уйдёт — работает журнал за 7 дней). Если нужен один запуск в неделю, замените `'5 * * * *'` на `'5 17 * * 0'`.
3. Настройка времени: в админке «Настройки» ключ `digest` → `{"enabled": true, "weekday": 0, "hour_utc": 17}` (`weekday`: 0 — воскресенье … 6 — суббота, время UTC; `enabled: false` выключает рассылку).
4. Проверка вручную (отправит сразу, игнорируя день и час, но с учётом журнала): `curl -X POST "https://<ref>.supabase.co/functions/v1/weekly-digest?force=1" -H "x-digest-secret: $DIGEST_CRON_SECRET"`.
5. Тексты пушей/писем лежат в `supabase/functions/weekly-digest/text.ts` (карта по языку профиля, запасной — русский).

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
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_URL`. Для облачной сборки workflow на лету копирует их в `env` выбранного профиля `eas.json` (в коммит это не попадает), потому что сборка идёт на серверах EAS и не видит окружение GitHub-раннера.

**Environment `production`:** Settings → Environments → New environment → `production` → Required reviewers (владелец). Тогда деплой Supabase и production-сборки/обновления ждут ручного подтверждения. Environment `preview` создаётся автоматически без защиты.

**Деплой Supabase** (Actions → Deploy Supabase → Run workflow; только ручной запуск — миграции в продакшн применяет человек): сначала `supabase db push --dry-run`, затем `db push` и `functions deploy` для каждой папки в `supabase/functions` (кроме `_shared`). Секреты функций CI **не** выставляет: один раз выполните локально `npx supabase secrets set PUSH_WEBHOOK_SECRET=...` (и необязательные `RESEND_API_KEY`, `EXPORT_FROM_EMAIL`), см. раздел 2.5. Вебхуки базы (2.6) тоже настраиваются вручную.

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

## Демо-профили: кто они и откуда фото

Профили из `scripts/seed-demo-bots.mjs` вымышленные: имена, возраст, описания и ответы написаны вручную и не относятся к реальным людям. Они нужны только для проверки до запуска.

- **Фото по умолчанию** — примеры из `src/assets/images/`.
- **Свои фото:** создайте локальную папку `scripts/demo-photos/` и положите туда `jpg`/`png` (по имени файла, по алфавиту). Скрипт раздаёт их профилям по кругу, по два на профиль. Если папки нет или она пуста, берутся примеры из репозитория. Папка в `.gitignore`, в git не попадает; README внутри неё не хранится, потому что он тоже был бы проигнорирован.
- **Какие фото можно класть:** только свои, лицензированные (с правом использования в приложении) или людей, которые дали согласие. Не генерируйте и не берите чужие фото из интернета.
- **Перед запуском** все демо-профили и их фото нужно удалить, см. раздел «Перед запуском: удалить демо-профили» ниже.

## Перед запуском: удалить демо-профили

Демо-профили создаёт `scripts/seed-demo-bots.mjs`, их id хранятся в `public.demo_bots` (миграции 0012, 0013); почта у них `@demo.renvi.app`. Удаление ничего не запускает само — выполняйте вручную, строго по порядку. Строка подключения (`DATABASE_URL`) — из Supabase → Connect; в репозиторий её не кладём.

1. **Проверка:** `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/check-no-demo-bots.sql`. Ожидаем 0 строк и без ошибки. Если появились строки или `demo profiles still present` — демо остались, переходите к шагу 2.
2. **Удаление:** `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/remove-demo-bots.sql`. Скрипт в одной транзакции удаляет auth-пользователей из `demo_bots` (профили, фото, искры, матчи, сообщения — каскадом) и строку `demo_bots` в `app_config`. Он печатает счётчики `before` и `after`, а также список id ботов (`demo bot id`) — **сохраните этот список** для шага 4. Ошибка → транзакция откатывается, ничего не удалено.
3. **Повторная проверка:** снова `check-no-demo-bots.sql`. Должна пройти без строк и ошибок.
4. **Storage:** если в бакете `profile-media` остались папки `<bot_id>/…` (фото ботов), удалите их через Storage в дашборде Supabase или Storage API, по id из шага 2. Прямой `DELETE` из `storage.objects` Supabase не разрешает.
5. **Админка:** откройте `/admin` и убедитесь, что число пользователей и анкет совпадает с реальными аккаунтами, а демо-профилей в списках нет.

## Веб-версия: автоматическая публикация (GitHub Pages)

Workflow `.github/workflows/web-deploy.yml` собирает веб-версию (`expo export --platform web`) и публикует её при **каждом** push в `main`, то есть после каждого слитого PR. Адрес: `https://<владелец>.github.io/renvi/`.

Один раз:
1. **Settings → Pages → Build and deployment → Source: GitHub Actions.** Без этого шаг публикации падает.
2. **Settings → Secrets and variables → Actions → Variables** (публичные значения, встраиваются в сборку): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`; по желанию `EXPO_PUBLIC_APP_URL` (по умолчанию адрес Pages), `EXPO_PUBLIC_HCAPTCHA_SITE_KEY`. Без адреса и ключа Supabase сайт откроется с экраном «Сервер не подключён».
3. Supabase → Authentication → URL Configuration: добавьте адрес сайта в Site URL / Redirect URLs (вход, восстановление пароля).
4. Свой домен: Settings → Pages → Custom domain, затем переменная `WEB_BASE_URL` = `/`.

Как это работает:
- Подпуть `/renvi` задаётся только в сборке для сайта (`app.config.js` + `EXPO_BASE_URL`); нативные сборки и локальная разработка не меняются.
- Прямые ссылки (`/renvi/admin`, `/renvi/invite/КОД`) работают: `404.html` — копия `index.html`.
- В `version.json` лежит коммит сборки. Открытая вкладка раз в 5 минут и при возврате на вкладку сравнивает его со своим и показывает «Вышла новая версия RENVI · Обновить».
- Админка открывается по адресу `/renvi/admin`; доступ проверяет сервер (`is_admin`).
