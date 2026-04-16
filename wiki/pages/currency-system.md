---
title: "Система валют и регионов"
tags: [валюта, регион, конвертация, displayCurrency]
sources:
  - src/stores/settingsStore.ts
  - src/utils/formatMoney.ts
  - src/constants/timezones.ts
  - src/constants/countries.ts
  - app/(tabs)/settings.tsx
  - app/(tabs)/index.tsx
  - app/_layout.tsx
updated: 2026-04-16
---

# Система валют и регионов

## Ключевые концепции

### Region (ISO-3166 alpha-2)

Страна, где пользователь покупает подписки. Влияет на AI-прайсинг при поиске сервисов.

### Display Currency (ISO-4217)

Валюта для отображения итогов и сконвертированных сумм. **Независима от региона** — пользователь может жить в Казахстане (KZ), но показывать суммы в USD.

### Original Currency

Историческая валюта подписки — неизменяемая. Хранится в `subscription.currency` и `subscription.originalCurrency`.

## settingsStore

```typescript
interface SettingsState {
  /** @deprecated — использовать displayCurrency */
  currency: string;
  /** @deprecated — использовать region */
  country: string;
  /** ISO-3166 alpha-2 регион */
  region: string;        // default: 'US'
  /** ISO-4217 валюта отображения */
  displayCurrency: string;  // default: 'USD'
  language: string;
  // ...
}
```

**Миграция v2:** автоматически создаёт `region` из `country` и `displayCurrency` из `currency` для обратной совместимости.

**Синхронизация deprecated полей:** `setRegion()` обновляет и `region`, и `country`. `setDisplayCurrency()` обновляет и `displayCurrency`, и `currency`.

Персистится в AsyncStorage (ключ `subradar-settings`).

## Автодетект из таймзоны

При первом запуске (если region='US' и displayCurrency='USD'):

```typescript
// app/_layout.tsx → DataLoader
const detected = detectCountryFromTimezone();
if (detected !== 'US') {
  settings.setRegion(detected);
  const suggestedCurrency = COUNTRY_DEFAULT_CURRENCY[detected];
  if (suggestedCurrency) settings.setDisplayCurrency(suggestedCurrency);
}
```

Маппинг `TIMEZONE_TO_COUNTRY` покрывает основные таймзоны (Европа, СНГ, Азия, Америка).

Маппинг `COUNTRY_DEFAULT_CURRENCY` связывает страну с дефолтной валютой:
- KZ → KZT, RU → RUB, UA → UAH, TR → TRY, GB → GBP, EU-страны → EUR, и т.д.

## Конвертация: как это работает

### Запрос к API

Все запросы подписок и аналитики передают `displayCurrency`:

```typescript
// useSubscriptions hook
const displayCurrency = useSettingsStore((s) => s.displayCurrency);
const mergedParams = { ...(params ?? {}), displayCurrency };

// useAnalytics hook
analyticsApi.getSummary({ displayCurrency })
```

### Ответ бэкенда

Бэкенд возвращает в каждой подписке:

```typescript
{
  amount: 9.99,              // оригинальная сумма
  currency: 'USD',           // оригинальная валюта
  displayAmount: '4499.50',  // сконвертированная сумма
  displayCurrency: 'KZT',   // запрошенная валюта
  fxRate: 450.4,             // курс
  fxFetchedAt: '...',        // время получения курса
}
```

### Паттерн effectiveCurrency для итогов

На Dashboard для показа общей суммы используется:

```typescript
// Если бэкенд вернул displayCurrency — используем его,
// иначе fallback на оригинальную валюту первой подписки
const effectiveCurrency = activeSubs.length > 0 && activeSubs[0]?.displayCurrency
  ? currency        // displayCurrency из settingsStore
  : (activeSubs[0]?.currency || currency);
```

Это нужно потому что если бэкенд не поддерживает конвертацию для данной валюты, `displayAmount` будет отсутствовать — тогда показываем оригинальную.

### Расчёт месячной суммы

```typescript
const displayValueOf = (s) => Number(s.displayAmount ?? s.amount) || 0;

const totalMonthly = activeSubs.reduce((sum, s) => {
  const mult = s.billingPeriod === 'WEEKLY' ? 4
    : s.billingPeriod === 'QUARTERLY' ? 1/3
    : s.billingPeriod === 'YEARLY' ? 1/12
    : 1;
  return sum + displayValueOf(s) * mult;
}, 0);
```

## formatMoney

```typescript
function formatMoney(
  amount: number | string | null | undefined,
  currency: string,
  locale?: string,
): string
```

- Использует `Intl.NumberFormat` с `style: 'currency'`
- Максимум 2 десятичных знака
- Fallback: `N.NN CCC` если locale/currency невалидны
- Принимает string или number (string сохраняет decimal precision)

## UI: Settings

Экран настроек (`app/(tabs)/settings.tsx`) позволяет:

1. **Выбор региона** — `CountryPicker` (модал). При смене региона:
   - Инвалидируются кеши подписок и аналитики
   - Предлагается смена displayCurrency на дефолтную для страны
   - Синхронизация с бэкендом: `PATCH /users/me { region, displayCurrency }`

2. **Выбор display currency** — `CurrencyPicker` (модал). При смене:
   - Обновляется settingsStore
   - `PATCH /users/me { displayCurrency }`
   - Инвалидируются кеши

3. **Quick-select чипы** — legacy, но оставлены для удобства

## Связанные страницы

- [[subscriptions]] — поля displayAmount/displayCurrency в подписке
- [[analytics]] — все суммы через displayCurrency
- [[onboarding]] — выбор региона при первом запуске
- [[state-management]] — settingsStore
- [[known-issues]] — исправленные баги с валютами
