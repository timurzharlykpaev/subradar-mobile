---
title: "Известные проблемы и недавние исправления"
tags: [баги, исправления, история]
sources:
  - CLAUDE.md
updated: 2026-04-16
---

# Известные проблемы и недавние исправления

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
- [[billing]] — RevenueCat ограничения
- [[navigation]] — задержка AddSubscriptionSheet
