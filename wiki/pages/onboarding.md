---
title: "Онбординг"
tags: [онбординг, регион, таймзона, авторизация]
sources:
  - app/onboarding.tsx
  - src/constants/timezones.ts
  - src/constants/countries.ts
  - src/components/CountryPicker.tsx
updated: 2026-04-16
---

# Онбординг

## Когда показывается

Экран `app/onboarding.tsx` показывается при первом запуске, когда нет `auth_token` (пользователь не авторизован).

## Структура онбординга

Многошаговый экран с анимированными переходами:

### Шаг 1-4: Информационные слайды

Картинки из `/public/onboarding/`:
- `onboarding-1-radar.png` — Главный экран, отслеживание подписок
- `onboarding-2-ai.png` — AI-фичи (голос, скриншот, поиск)
- `onboarding-3-analytics.png` — Аналитика и прогнозы
- `onboarding-4-reminders.png` — Напоминания о платежах

Каждый слайд содержит:
- SVG иконку с анимированным описанием фичи
- Заголовок и подзаголовок
- Навигация: кнопка "Далее" / свайп

### Шаг 5: Выбор региона

- Автодетект региона из таймзоны устройства (`detectCountryFromTimezone()`)
- `CountryPicker` — модал со списком стран (флаги, названия, поиск)
- При выборе страны автоматически предлагается дефолтная валюта (`COUNTRY_DEFAULT_CURRENCY`)
- Данные сохраняются в `settingsStore` и синхронизируются с бэкендом

### Шаг 6: Авторизация

Три метода (см. [[auth]]):
- Google Sign-In
- Apple Sign-In (iOS only)
- Magic Link (email)

## Автодетект таймзоны

```typescript
// src/constants/timezones.ts
function detectCountryFromTimezone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return TIMEZONE_TO_COUNTRY[tz] ?? 'US';
}
```

Покрытие таймзон:
- **Европа:** RU, UA, BY, GB, FR, DE, ES, IT, NL, PL, CZ, AT, TR, GR, SE, NO, FI, DK, CH, PT
- **СНГ:** KZ (7 зон), UZ, KG, TJ, TM, AZ, AM, GE
- **Азия:** JP, CN, HK, KR, SG, TH, ID, MY, PH, IN, AE, SA, IL
- **Америка:** US, CA, MX, BR, AR, CO, CL
- **Океания:** AU, NZ

Маппинг страна → валюта (`COUNTRY_DEFAULT_CURRENCY`):
- KZ → KZT, RU → RUB, UA → UAH, TR → TRY, GB → GBP
- EU-страны → EUR
- JP → JPY, CN → CNY, KR → KRW и т.д.

## Replay Onboarding

В Settings можно перезапустить онбординг:
1. Удаляется `subradar:add-onboarding-seen` из AsyncStorage
2. `isOnboarded` в authStore сбрасывается в `false`
3. При следующем открытии приложения показывается онбординг

## Аналитические события

- `onboarding_started` — при открытии
- `onboarding_slide_viewed` — при просмотре каждого слайда
- `onboarding_region_selected` — при выборе региона
- `onboarding_auth_method` — при выборе метода авторизации
- `onboarding_completed` — при завершении

## Связанные страницы

- [[auth]] — методы авторизации
- [[currency-system]] — автодетект региона и валюты
- [[navigation]] — поток Splash → Onboarding → Main App
