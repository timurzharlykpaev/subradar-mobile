---
title: "App Store Review Prompt"
tags: [review, ratings, store, sk-store-review, wow-moments]
sources:
  - src/hooks/useReviewPrompt.ts
  - src/stores/reviewPromptStore.ts
  - src/utils/requestInAppReview.ts
updated: 2026-05-22
---

# App Store Review Prompt

Нативный App Store / Google Play rating prompt, который показывается **только
в положительные "wow moments"** и проходит throttle gates до OS-уровневого
троттла SKStoreReviewController.

## Зачем

Просить ревью только когда пользователь только что увидел ценность продукта
— значительно выше конверсия в 5-звёздное ревью. Никогда после ошибки,
paywall или crash — это poison the well.

## Архитектура

```
Wow moment в UI (subscription added, AI analysis surfaced, gmail import done)
  → useReviewPrompt().promptIfEligible(trigger)
  → store.shouldPrompt(trigger) проверяет gates
  → requestInAppReview() вызывает SKStoreReviewController / Play
  → store.markPrompted()
```

Negative moments (paywall open, error, crash):
```
markNegative() → store.lastNegativeAt = Date.now()
→ блокирует prompts на 5 минут
```

## Triggers (`ReviewTrigger`)

```typescript
type ReviewTrigger =
  | 'subscription_added_3plus'   // юзер добавил 3+ подписок
  | 'analytics_viewed'           // открыл analytics с данными
  | 'cancelled_subscription'     // cancel через app — экономит деньги
  | 'gmail_import_complete'      // bulk-import успешно завершён
  | 'onboarding_completed'       // прошёл онбординг
  | 'streak_5_days'              // 5 дней подряд открывал app
  | 'manual_settings';           // пользователь сам тапнул "Rate us"
```

Каждый trigger fires **максимум один раз за жизнь установки** (через
`firedTriggers` в персисте).

## Gates (constants)

```typescript
MIN_DAYS_SINCE_INSTALL    = 2    // give user time to settle
MIN_DAYS_BETWEEN_PROMPTS  = 120  // ≤3 prompts/year от нас
NEGATIVE_COOLDOWN_MS      = 5min // после paywall/error
STREAK_THRESHOLD          = 5    // дней для streak_5_days
```

Logic в `shouldPrompt(trigger)`:

1. `trigger === 'manual_settings'` → bypass всё, доверяем юзеру
2. Если этот trigger уже fired → false
3. `installedAt` not set → false
4. `daysSinceInstall < 2` → false
5. `lastNegativeAt` < 5 минут назад → false
6. `lastPromptedAt` < 120 дней назад → false
7. Для `streak_5_days`: `consecutiveDays < 5` → false
8. Иначе: atomically mark `firedTriggers[trigger] = true` + return true

## Streak tracking

`recordAppOpen()` вызывается на каждом cold start:

- `installedAt` set один раз
- `lastActiveDay` обновляется по дате (YYYY-MM-DD)
- `consecutiveDays`:
  - если разрыв = 1 день → инкремент
  - иначе → reset to 1

После 5+ consecutive days `streak_5_days` trigger становится eligible.

## Persistence

Через Zustand `persist` middleware + AsyncStorage. Ключ `subradar-review-prompt`,
version 1.

## Platform throttles (вторая защита)

`SKStoreReviewController` сам ограничивает: ≤3 запросов / 365 дней на
устройство. Google Play: ~3-4 / квартал. Наши gates выше платформенных,
чтобы не сжигать бюджет на слабые моменты.

## App Store Guideline 4.5.6

**Никогда** не оборачивать `promptIfEligible` в pre-prompt UI ("Would you
like to rate us?"). Native prompt сам по себе **является** UI affordance —
кастомный pre-prompt = guideline violation.

`manual_settings` — единственное исключение, потому что юзер сам тапнул
"Rate us" в Settings.

## Использование

```typescript
const { promptIfEligible, markNegative } = useReviewPrompt();

// Positive moment
await promptIfEligible('subscription_added_3plus');

// Перед открытием paywall / показом ошибки
markNegative();
```

## Связанные страницы

- [[state-management]] — `reviewPromptStore` в списке Zustand сторов
- [[paywall]] — `markNegative()` перед открытием
- [[gmail-import]] — `gmail_import_complete` trigger
- [[onboarding]] — `onboarding_completed` trigger
