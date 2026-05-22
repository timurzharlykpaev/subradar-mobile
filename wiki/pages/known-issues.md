---
title: "Известные проблемы и недавние исправления"
tags: [баги, исправления, история, app-store-compat]
sources:
  - CLAUDE.md
updated: 2026-05-22
---

# Известные проблемы и недавние исправления

## 🚨 КРИТИЧНО — App Store backward compatibility

Мобильное приложение **уже выпущено в App Store** и у пользователей
установлены **старые версии**. Адопшен новой версии в App Store идёт
постепенно (≈50% за неделю, 90% за 4 недели). Старые билды продолжают
ходить на тот же `api.subradar.ai` прод.

**Любое изменение бэкенда или мобилки должно учитывать старых клиентов:**

1. **Additive changes по умолчанию.** Новое поведение → новое поле/эндпоинт
   (`/v2/...`)/query-param. Не модифицируй ответ существующего эндпоинта.
2. **Новые request-поля делай optional с дефолтами**, совпадающими со старым
   поведением. Старый клиент не шлёт поле → получает старую семантику.
3. **Никогда не удаляй и не переименовывай поля** в ответах — даже legacy.
4. **Server-side gating > client-side gating.** Новые лимиты делай на сервере
   чтобы старые клиенты автоматически получили исправление.
5. **Никогда не ужесточай DTO-валидацию задним числом** (новое required поле,
   stricter regex). Сначала loosen, потом tighten после адопшена.
6. **Не удаляй значения enum** на которых клиент свитчится (например
   `SubscriptionStatus`). Только добавляй новые.
7. **Если изменение нельзя сделать backward-compat — предупреди ЯВНО**, не
   просачивай молча. Формулировка: *"Это сломает X на версиях ≤ A.B.C —
   продолжать?"*
8. **Bump версии в `app.json` не помогает старым пользователям** — он влияет
   только на новые билды.

**Force-update / kill-switch escape:** если изменение действительно нельзя
сделать backward-compat — серверный «minimum supported version» эндпоинт +
UI который заставляет старых юзеров обновиться. Не использовать casually.

Полное описание правил — в `CLAUDE.md` мобилки (раздел "App Store —
обратная совместимость API").

## Недавно исправленные баги

### Хардкодированный символ $ (исправлено)

**Проблема:** во многих местах UI символ валюты был хардкодирован как `$`, вместо использования `formatMoney()` с текущей `displayCurrency`.

**Решение:** заменены все хардкоды на `formatMoney(amount, effectiveCurrency, i18n.language)`. Затронутые экраны:
- Dashboard (hero card, forecast, upcoming, categories)
- Analytics (bar chart, donut, savings, forecast)
- Subscription cards

### Отсутствие displayCurrency в API запросах (исправлено)

**Проблема:** некоторые API вызовы не передавали `displayCurrency`, из-за чего бэкенд возвращал суммы в оригинальной валюте.

**Решение:** все хуки (`useSubscriptions`, `useAnalytics`) и прямые API вызовы теперь автоматически подмешивают `displayCurrency` из `settingsStore`.

### effectiveCurrency паттерн (добавлено)

**Проблема:** если бэкенд не поддерживает конвертацию в запрошенную валюту, `displayAmount` отсутствует, но UI пытался форматировать оригинальную сумму с displayCurrency — получалась бессмыслица.

**Решение:** введён паттерн `effectiveCurrency`:

```typescript
const effectiveCurrency = activeSubs.length > 0 && activeSubs[0]?.displayCurrency
  ? currency           // displayCurrency из store
  : (activeSubs[0]?.currency || currency);  // fallback на оригинальную
```

### Регион и валюта — review fixes (Phase 7.1, commit 3fc842f)

Исправления display-слоя и UX настроек после code review:
- Корректное отображение валют в разных локалях
- UX улучшения в Settings (region picker, currency picker)
- Atomic PATCH запросы при смене региона/валюты

### Reports freeze при interrupted PDF generation (`f0d2d2b`)

Прерванный network mid-PDF-request → экран frozen на спиннере, потому что
RN's `fetch` не имеет default timeout и dropped connection никогда не
резолвится → `finally` не срабатывает.

Fixes: `fetchWithTimeout` через AbortController (25s create/download, 8s
poll), per-poll error swallow, `setGenerating(false)` ДО `Sharing.shareAsync`
(iOS share sheet hangs больше не блокируют экран). См. [[reports]].

### Local reminderDays игнорировал global preference (`32c2835`)

`schedulePaymentReminders` хардкодил `[1, 3]` как fallback. Settings →
"Remind 3 days before" / "Off" работало только для server-side cron pushes,
не для offline local notifications. Теперь читает
`useSettingsStore.getState().reminderDays`. См. [[notifications]].

### Settings timezone + dateFormat не синхронизировались (`73c03e3`)

Раньше при смене timezone/dateFormat значения сохранялись только локально
(в settingsStore), но не отправлялись на backend через `PATCH /users/me`.
Server-driven фичи (email digests, push notifications) использовали stale
backend values. Сейчас оба поля sync-ятся как остальные настройки.

### Onboarding `{{names}}` interpolation (`335c40a`)

Ключ `onboarding.first_sub_subtitle_picked` ждёт `{{names}}`, но вызов `t()`
передавал только `defaultValue` без поля `names` → плейсхолдер оставался
сырым. См. [[onboarding]].

### Subscription forms input lag и render churn

Серия perf-фиксов:
- `f5bff5d` memoize InlineConfirmCard + EditSubscriptionSheet против keystroke re-renders
- `cb7699e` isolate inputs, clear cache, persist user prefs
- `f1adfae` isolate team-name input от screen-wide re-renders
- `2957a76` smooth subscription forms + plan-aware report errors
- `201c158` stop wiping in-flight edits на background store updates

### Billing drift и RC ↔ backend sync

- `ba4d9c3` trigger reconcile когда backend в grace а RC active
- `bc3d393` cooldown + in-flight dedup для `reconcileBillingDrift`
- `cee5113` paywall retry on tier-upgrade

См. [[billing]] → Reconciliation.

### AddSubscriptionSheet — серия фиксов состояния

- `e4978e1` always reset to idle on open — close empty-modal class of bugs
- `23df22e` remount ScrollView на каждом open чтобы stale contentSize/offset не утекал
- `ae62f26` dismiss keyboard ДО ScrollView remount чтобы silence RTI session warning
- `5f01490` unify KAV pattern across modals + skip unnecessary scroll remount
- `d367bd1` track tall-flow via sticky ref so remount survives SuccessOverlay.onFinish
- `152d954` swipe-down close left stale flowState → blank reopen

## Известные ограничения

### AddSubscriptionSheet — задержка при первом открытии

**Проблема:** компонент `AddSubscriptionSheet` (800+ строк, много хуков) вызывает 1-2 секундную задержку при первом открытии.

**Текущее решение:** предзагрузка через `InteractionManager.runAfterInteractions()` + 500ms в `(tabs)/_layout.tsx`. Sheet монтируется скрытым после загрузки табов.

### Конвертация валют зависит от бэкенда

Если бэкенд не имеет курса для пары валют, `displayAmount` будет `null`. Клиент показывает оригинальную сумму. Нет клиентской конвертации — вся конвертация серверная.

### RevenueCat Customer Center

`react-native-purchases-ui` может быть недоступен (не установлен или не поддерживается). Все вызовы `RevenueCatUI` обёрнуты в try/catch с fallback на `billingApi.cancel()`.

### Expo Go

Некоторые фичи не работают в Expo Go:
- SecureStore (authStore) — fallback на null
- Push notifications — возвращает null token
- RevenueCat — не инициализируется

Требуется EAS Development Build для полного тестирования.

## Связанные страницы

- [[currency-system]] — валютные баги и их исправления
- [[billing]] — RevenueCat ограничения, reconciliation
- [[paywall]] — sync retry, tier hierarchy
- [[navigation]] — задержка AddSubscriptionSheet
- [[reports]] — fix freeze
- [[notifications]] — fix reminderDays
- [[onboarding]] — fix i18n interpolation
