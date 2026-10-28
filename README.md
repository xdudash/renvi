# RENVI

Приложение знакомств без свайпов: интерес к конкретному ответу, взаимная искра, чат и приглашение на встречу.
iOS и Android из одного кода (Expo / React Native + TypeScript), сервер — Supabase (Postgres, Auth, Storage, Realtime, Edge Functions).

> Репозиторий публичный. Бриф, прототип и другие внутренние материалы сюда не кладутся (папка `design/` в `.gitignore`).

## Что внутри

| Путь | Что это |
|---|---|
| `src/app/` | Все 94 экрана iOS-прототипа (Expo Router, файл = экран) и веб-админка `src/app/admin/` |
| `src/components/` | Дизайн-система: кнопки, карточки, поля, чекбоксы, листы, таб-бар, иконки и знак RENVI из прототипа |
| `src/theme/tokens.ts` | Цвета бренда: Signal `#DA302B`, Porcelain `#F7F5F2`, Ink `#201E1D`, Blush `#F0D6D0` и статусы |
| `src/lib/` | Клиент Supabase, API-обёртки над RPC, сессия, чат с офлайн-очередью, покупки (RevenueCat), push |
| `supabase/migrations/` | Схема базы, правила доступа (RLS), функции подбора, искр, чата, свиданий, модерации, рефералов, админки |
| `supabase/functions/` | Edge Functions: удаление аккаунта, выгрузка данных, вебхук RevenueCat, push-уведомления, видеозвонок перед встречей (Daily.co, необязательно) |
| `supabase/tests/` | Поведенческие тесты базы (RLS и бизнес-правила) — 47 проверок |
| `e2e/` | Сквозные тесты Playwright по всем главным сценариям и съёмка всех экранов |

## Быстрый старт

```bash
npm ci
cp .env.example .env            # впишите URL проекта Supabase и публичный anon key
npx supabase link --project-ref <ref>
npx supabase db push            # миграции
npx supabase functions deploy delete-account export-data revenuecat-webhook push video-call
npm run web                     # веб-версия для проверки
npx expo run:ios                # dev-сборка на iPhone / симуляторе (нужен Xcode)
```

Приложение использует нативные модули (покупки, камера, видео), поэтому на телефоне запускается dev-сборка, а не Expo Go.
Полная настройка сервисов (Auth, Storage, Realtime, вебхуки, RevenueCat, push, админы) — в [docs/SETUP.md](docs/SETUP.md).

## Проверки

```bash
npm run check      # TypeScript + ESLint
npm run test:db    # миграции на чистой базе + 47 проверок RLS и правил (нужен psql и доступ к Postgres)
npm run test:e2e   # сквозные сценарии против Supabase и веб-версии (переменные — в e2e/run-all.sh)
npx expo export --platform web            # production-сборка веба
npx expo export --platform ios --platform android
```

## Правила, которые держит сервер

- Тариф включает только сервер по событию магазина (`revenuecat-webhook`); клиент не может записать подписку.
- Лимиты и функции тарифов, запрещённые слова, ссылки на документы и реферальная программа — в `app_config`, меняются из админки без новой сборки.
- Лента и входящие искры — только своя страна; координаты никому не отдаются, расстояние округлено до километра.
- Фото в чате — только по взаимному разрешению; селфи для проверки недоступно другим пользователям.
- Сообщения идемпотентны (`client_id`), офлайн-очередь и повтор отправки без дублей.
- Удаление аккаунта и выгрузка данных доступны в приложении всегда, даже с незаконченной анкетой.
