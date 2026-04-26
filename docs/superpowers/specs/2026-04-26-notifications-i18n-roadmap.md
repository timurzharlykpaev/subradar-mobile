# Notifications i18n & Delivery — Roadmap

**Дата:** 2026-04-26
**Тип:** Roadmap (не реализационный спек — ссылается на отдельные спеки для каждого подпроекта)
**Статус:** черновик, ждёт ревью

## Контекст

Пользователь сообщил: push-уведомления (приходящие в "определённое время" — это cron-задачи бэкенда: дневные напоминания, trial expiry, Pro expiration, weekly digest, win-back, monthly report) приходят на английском, хотя в приложении выбран русский.

Аудит выявил **двойной разрыв**:

1. **Mobile → Backend:** мобила НЕ передаёт `user.locale` ни при логине, ни при `updateMe`, ни при регистрации FCM-токена.
2. **Backend → FCM:** все тексты push-сценариев захардкожены на английском в `reminders.service.ts` и `notifications.processor.ts` — `user.locale` вообще не читается.

Email-шаблоны (`email-templates.ts`) уже корректно локализованы — паттерн в проекте есть, его просто не применили к push.

## Что уже работает

- ✅ `User.locale` колонка в БД (default `'en'`, миграция `1772909030797-AddUserFields.ts`)
- ✅ `User.timezone` и `timezoneDetected` колонки в БД
- ✅ Endpoint `PATCH /users/preferences` принимает `locale`
- ✅ Email-шаблоны локализованы (en/ru) через `email-templates.ts`
- ✅ Mobile: `react-i18next` с 10 переводами (`en, ru, es, de, fr, pt, zh, ja, ko, kk`)
- ✅ Mobile: `settingsStore.setLanguage()` сохраняет язык в AsyncStorage
- ✅ Backend: `firebase-admin` подключён, FCM работает

## Что НЕ работает (карта боли)

### Mobile (`subradar-mobile/src/`)

| Файл | Проблема |
|------|---------|
| `i18n.ts:28-29` | `lng: 'en'`, `fallbackLng: 'en'` — системный язык устройства не определяется |
| `api/client.ts:20-34` | Нет `Accept-Language` header в axios interceptor |
| `api/notifications.ts:4` | `registerPushToken(token, platform)` — `locale` не передаётся |
| `api/users.ts:4-11` | `updateMe()` принимает region/currency/timezone — но **не `locale`** |
| `stores/settingsStore.ts:54` | `setLanguage()` сохраняет только локально, бэкенд не уведомляется |
| `utils/localNotifications.ts:42-52` | Локальные напоминания захардкожены на английском |

### Backend (`subradar-backend/src/`)

| Файл (cron) | Проблема |
|-------------|---------|
| `reminders.service.ts:131-136` (`0 9 * * *`) | Daily reminders за 3/1 день до платежа — EN hardcode |
| `reminders.service.ts:194-196` (`0 10 * * *`) | "Your Pro trial ends in X days" — EN hardcode |
| `reminders.service.ts:264-271` (`0 10 * * *`) | "Your Pro benefits have ended" / "Last day of Pro!" — EN hardcode |
| `reminders.service.ts:375-379` (`0 11 * * 0`) | Weekly digest — EN hardcode |
| `reminders.service.ts:465-466` (`0 14 * * *`) | Win-back — EN hardcode |
| `reminders.service.ts:397` (`0 * * * *`) | Hourly task — проверить если шлёт push |
| `notifications.processor.ts:23-24` | "🔔 Upcoming Billing" — EN hardcode |
| `monthly-report.service.ts:26` (`0 10 1 * *`) | Monthly report — проверить локализацию |

Все cron'ы используют **UTC время**, но юзер ожидает локальное (например 9:00 Almaty ≠ 9:00 UTC).

## Архитектурные решения (для всего roadmap)

| # | Решение | Обоснование |
|---|---------|-------------|
| 1 | **Все 10 языков с первого дня** | политика проекта (`feedback_always_translate`) |
| 2 | **Backend i18n: свой словарный паттерн как в `email-templates.ts`** | уже работает, не тащим `nestjs-i18n` ради 6 cron-задач |
| 3 | **Push payload содержит уже переведённый title/body** | FCM норма; клиент не должен переводить server-side пуши |
| 4 | **Timezone-aware delivery: используем `user.timezone`** | поле уже в БД, не надо новой миграции |
| 5 | **Fallback chain:** `user.locale` → `'en'` | request-driven `Accept-Language` для cron нерелевантен |
| 6 | **Mobile: автодетект через `expo-localization`** при первом запуске | один раз, потом юзер может перекрыть в settings |

## Подпроекты (последовательность)

### 📦 SP-1: Foundation — locale handshake mobile ↔ backend

**Цель:** научить мобилу передавать `locale` бэкенду и убедиться, что бэкенд его правильно сохраняет.

**Mobile:**
- Добавить `expo-localization` (или `Localization` из expo-modules)
- При первом запуске: если AsyncStorage пустой — взять `Localization.getLocales()[0].languageCode`, выбрать ближайший из 10 поддерживаемых, иначе `'en'`
- В `axios` interceptor добавить `Accept-Language: <i18n.language>`
- При смене языка в settings → дополнительно вызвать `usersApi.updateMe({ locale })`
- При регистрации FCM-токена → передавать `locale` в `registerPushToken(token, platform, locale)`
- При логине/onboarding → отправлять `locale` вместе с `region`/`currency`

**Backend:**
- `users.controller.ts` `PATCH /users/preferences` уже принимает `locale` — проверить валидацию (whitelist 10 кодов)
- В `notifications.controller.ts` (registerPushToken) принимать опциональный `locale` и обновлять `user.locale` если приходит
- В global pipe / interceptor: при наличии `Accept-Language` в заголовке и отсутствии `user.locale` → проставлять fallback'ом

**Тесты:** unit-тесты на helper выбора ближайшего поддерживаемого языка; e2e в БД-тесте на сохранение `locale`.

**Спек:** `docs/superpowers/specs/YYYY-MM-DD-sp1-locale-handshake-spec.md`

---

### 📦 SP-2: Backend i18n infrastructure для нотификаций

**Цель:** инфраструктура для перевода серверных текстов (push + email) централизованно.

- Создать `src/notifications/i18n/` с `en.ts`, `ru.ts`, ..., `kk.ts` (по аналогии с `email-templates.ts`)
- Структура: TypeScript-объекты с типизированными ключами (без `any`):
  ```ts
  export const ru = {
    push: {
      reminder: {
        title: 'Завтра спишут {amount} {currency}',
        body: '{name} — повторяющийся платёж',
      },
      trialExpiry: { ... },
      // ...
    },
  }
  ```
- Helper: `t(locale: SupportedLocale, key: string, params?: Record<string, string|number>)` с fallback на `'en'` если ключа нет
- Все 10 языков переведены сразу (можно через AI-перевод с финальной ревью носителем; для MVP — машинный перевод OK)
- Интеграция: extract email-шаблонов в этот же словарь, чтобы избежать дублирования (опционально — можно отложить если рискованно)

**Тесты:** snapshot для каждого языка чтобы было видно регрессии при изменении шаблонов; unit на `t()` с fallback.

**Спек:** `docs/superpowers/specs/YYYY-MM-DD-sp2-backend-i18n-infrastructure-spec.md`

---

### 📦 SP-3: Push localization (применить SP-2 ко всем cron-задачам)

**Цель:** все push-сценарии используют `user.locale` через i18n helper.

- Заменить хардкод во всех 6+ местах на `t(user.locale, 'push.xxx', params)`
- Добавить тесты по принципу: для каждого языка → каждый сценарий → snapshot payload
- Обратная совместимость: если `user.locale === null` → `'en'` (уже описано в архитектурных решениях)

**Тесты:** интеграционный тест который для тестового пользователя с `locale='ru'` проверяет что generated FCM payload содержит русский текст.

**Спек:** `docs/superpowers/specs/YYYY-MM-DD-sp3-push-localization-spec.md`

---

### 📦 SP-4: Mobile-side local notifications + onboarding

**Цель:** локальные напоминания (`schedulePaymentReminders`) тоже на правильном языке + системный язык на onboarding.

- `utils/localNotifications.ts` — заменить хардкод на `i18n.t('localPush.payment.body', { name, daysLeft })`
- Добавить ключи `localPush.*` во все 10 локалей в `src/locales/*.json`
- Onboarding: использовать определённый системный язык как пред-выбор на первом слайде

**Тесты:** unit на построение текста локальной нотификации для каждого языка.

**Спек:** `docs/superpowers/specs/YYYY-MM-DD-sp4-mobile-local-notifications-spec.md`

---

### 📦 SP-5: Timezone-aware delivery

**Цель:** уйти от глобального `0 9 * * *` UTC к доставке в локальное время пользователя.

**Подход (на выбор в спеке, по результату брейнсторма):**
- **A. Hourly fan-out:** cron `0 * * * *` находит юзеров где `local_now.hour === 9` и кладёт им задачи в Bull queue. Простой, но 24 пробуждения cron.
- **B. Per-user scheduled jobs:** при изменении timezone юзера — пересоздаём Bull-задачу с правильным `repeat.cron` в TZ юзера. Сложнее, но эффективнее.

**Зависимости:** требует чтобы `user.timezone` стабильно проставлялся (на бэкенде он сейчас проставляется через `timezoneDetected`).

**Тесты:** для тестового юзера с TZ `Asia/Almaty` проверить что задача отправлена в 04:00 UTC (= 9:00 Almaty).

**Спек:** `docs/superpowers/specs/YYYY-MM-DD-sp5-timezone-aware-delivery-spec.md`

---

### 📦 SP-6: Push delivery analytics

**Цель:** понимать какие push доставляются, открываются, конвертируют.

**Открытые вопросы (решаются в брейншторме перед спеком):**
- Провайдер: PostHog vs Amplitude vs самопис в `analytics_events` таблице?
- Какие события: `push.queued`, `push.sent`, `push.delivered`, `push.opened`, `push.action_taken`?
- Атрибуция: какая подписка/cron инициировал — нужно для product-аналитики

**Зависимости:** на mobile — обработчик `Notifications.addNotificationResponseReceivedListener` шлёт `push.opened`. На бэкенде — логировать на стороне отправки в FCM.

**Спек:** `docs/superpowers/specs/YYYY-MM-DD-sp6-push-analytics-spec.md`

---

## Порядок и связи между спеками

```
SP-1 (foundation, mobile+backend handshake)
   │
   ├──> SP-2 (backend i18n infra) ─── parallel ──> SP-4 (mobile local notifs)
   │           │
   │           v
   └──────> SP-3 (apply to push)
                                                       │
                                                       v
                                              SP-5 (timezone-aware)
                                                       │
                                                       v
                                              SP-6 (analytics, optional)
```

**Минимальный фикс текущей боли:** SP-1 + SP-2 + SP-3 (3 спека, 3 PR; mobile + backend).
**Полная картина:** все 6 подпроектов.

## Риски

1. **Машинный перевод 10 языков** — для kk/ja/ko/zh может звучать неестественно; для production придётся ревью носителем (или хотя бы native-fluent человеком).
2. **Email + push словари дублируются если не объединить** — решить в SP-2 спеке.
3. **Timezone migration** — если у части пользователей `user.timezone === null` (старые юзеры до сбора этого поля), SP-5 должен иметь fallback на UTC.
4. **Обратная совместимость FCM payload** — если меняем структуру payload (добавляем `locale` в data), старые версии клиента должны не сломаться.
5. **Тестовое покрытие** — 10 языков × 6 сценариев = 60 snapshot-тестов; нужно автоматизировать генерацию.

## Что НЕ входит в этот roadmap (явно отрезано)

- Перевод текстов в admin-панели и web — это отдельный продукт
- A/B тестинг push copy — отдельный спек после SP-6
- Локализация in-app сообщений (toast / alert / error) — это уже отдельный аудит UI
- Server-side rendering email-шаблонов в HTML/MJML — текущая система работает, не трогаем
- Smart timing (определять когда юзер активен и слать тогда) — Release 2/3, не сейчас

## Acceptance criteria для roadmap (не подпроектов)

- [ ] Roadmap утверждён пользователем
- [ ] Каждый подпроект имеет ясный owner-контекст и acceptance в своём спеке
- [ ] Порядок и зависимости подпроектов понятны и согласованы
- [ ] Решения из таблицы "Архитектурные решения" применяются ко всем подпроектам без пересмотра
