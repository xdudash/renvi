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
   npx supabase functions deploy delete-account export-data revenuecat-webhook push weekly-digest
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
3. Настройка времени: в админке «Тарифы и настройки» ключ `digest` → `{"enabled": true, "weekday": 0, "hour_utc": 17}` (`weekday`: 0 — воскресенье … 6 — суббота, время UTC; `enabled: false` выключает рассылку).
4. Проверка вручную (отправит сразу, игнорируя день и час, но с учётом журнала): `curl -X POST "https://<ref>.supabase.co/functions/v1/weekly-digest?force=1" -H "x-digest-secret: $DIGEST_CRON_SECRET"`.
5. Тексты пушей/писем лежат в `supabase/functions/weekly-digest/text.ts` (карта по языку профиля, запасной — русский).

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
