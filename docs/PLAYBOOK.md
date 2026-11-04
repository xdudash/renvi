# RENVI Playbook — платный курс для мужчин (0,99 €)

**Решение основателя (2026-11-04):** приложение остаётся бесплатным (см. `RELEASE_4_NO_SUBSCRIPTIONS.md`), платным
становится только необязательный курс «RENVI Playbook»: 8 уроков, одна покупка навсегда. Никакого анализа чатов,
подсказок в ленте/анкете/чате и сгенерированных ответов — только готовые тексты.

## Что в приложении

| Урок | Экран | Доступ |
|---|---|---|
| 1 Анкета, на которую отвечают | `/playbook/1` (карточки) | покупка |
| 2 Первое сообщение | `/playbook/2` | **бесплатно** |
| 3 Флирт без кринжа | `/playbook/3` | покупка |
| 4 «ахах», «ок» и игнор | `/playbook/4` | покупка |
| 5 Позвать на встречу | `/playbook/5` | покупка |
| 6 Свидания в Братиславе | `/playbook/dates` (6 маршрутов, фильтр по бюджету) | покупка |
| 7 Первое свидание | `/playbook/first-date` (3 вкладки) | покупка |
| 8 Тренажёр | `/playbook/trainer` (30 ситуаций, выбор из 3 + разбор) | покупка |

- Вход: тёмная карточка «RENVI Playbook» во вкладке «Профиль» (для анкет с полом «мужчина»), список — `/playbook`.
- Закрытый урок ведёт на `/playbook/paywall?to=N`.
- Тексты: `src/playbook/ru.ts` и `src/playbook/en.ts`. Для SK, CS и UA пока используется английский текст.
  Строки интерфейса (`playbook.*`) переведены на все 5 языков.
- Прогресс: `src/lib/playbook.ts`. Источник правды — сервер, копия в AsyncStorage нужна для офлайна.

## Сервер

- Миграция `0034_playbook.sql`.
  - Таблица `playbook_progress`: `purchased`, `done_lessons`, `trainer_pos`.
  - Пользователь может только читать свою строку.
  - RPC: `playbook_state()`, `playbook_mark_done(lesson)`, `playbook_set_trainer(pos)`. Платные уроки без покупки отклоняются, урок 2 принимается.
  - `playbook_set_purchased(user, bool)` доступна только service role.
- Edge Function `playbook-sync`.
  - Спрашивает RevenueCat по id вызывающего пользователя (`GET /v1/subscribers/{uid}`) и записывает `purchased`.
  - Возврат денег снимает доступ, прогресс при этом остаётся.
- Тесты: `supabase/tests/playbook.sql`, `supabase/tests/playbook_sync.test.ts`, `scripts/tests/playbook.test.mjs`.

## Что настроить перед выпуском

1. **App Store Connect → In-App Purchases.** Создать Non-Consumable с Product ID `renvi_playbook` и ценой 0,99 € (Tier 1). Название «RENVI Playbook», описание и скриншот экрана оплаты — для ревью.
2. **RevenueCat.**
   - Создать проект и приложение iOS, подключить App Store (In-App Purchase Key).
   - Добавить продукт `renvi_playbook` и entitlement `playbook`, привязать продукт к entitlement.
3. **Ключи.**
   - Публичный SDK-ключ iOS положить в переменную репозитория `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (и в `.env`). Для Android — `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
   - Секретный ключ: `npx supabase secrets set REVENUECAT_SECRET_KEY=sk_...`. Можно задать и `PLAYBOOK_ENTITLEMENT`, если entitlement называется иначе.
4. **Деплой.** `npx supabase db push` и `npx supabase functions deploy playbook-sync`.
5. **Новая сборка.** EAS dev или production: в Expo Go и в вебе покупки нет, экран оплаты это объясняет.
6. **Проверка.** Sandbox-аккаунт в TestFlight: купить, затем «Восстановить покупку» на втором устройстве.
