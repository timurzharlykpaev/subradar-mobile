---
title: "Управление состоянием"
tags: [стейт, zustand, tanstack-query, async-storage]
sources:
  - src/stores/authStore.ts
  - src/stores/settingsStore.ts
  - src/stores/subscriptionsStore.ts
  - src/stores/paymentCardsStore.ts
  - src/stores/uiStore.ts
  - src/stores/analyticsStore.ts
  - src/stores/reviewPromptStore.ts
  - src/hooks/useSubscriptions.ts
  - src/hooks/useAnalytics.ts
  - src/hooks/useBilling.ts
  - src/hooks/useEffectiveAccess.ts
  - src/hooks/useAI.ts
  - src/hooks/useGmail.ts
  - src/hooks/useActiveGmailScan.ts
  - src/hooks/useWorkspaceAnalysis.ts
  - src/hooks/useReviewPrompt.ts
  - src/hooks/useCancelSubscription.ts
updated: 2026-05-22
---

# Управление состоянием

Двухуровневая модель:
- **Zustand** — локальный/клиентский стейт
- **TanStack Query** — серверный стейт (кеш API ответов)

## Zustand Stores

### authStore

**Хранение:** expo-secure-store (Keychain/Keystore)
**Ключ:** `auth-storage`

```typescript
{
  user: User | null,
  token: string | null,
  refreshToken: string | null,
  isAuthenticated: boolean,
  isOnboarded: boolean,
}
```

Подробнее: [[auth]]

### settingsStore

**Хранение:** AsyncStorage
**Ключ:** `subradar-settings`
**Версия:** 2 (с миграцией)

```typescript
{
  currency: string,         // @deprecated → displayCurrency
  country: string,          // @deprecated → region
  region: string,           // ISO-3166 alpha-2
  displayCurrency: string,  // ISO-4217
  language: string,
  reminderDays: number,
  notificationsEnabled: boolean,
  dateFormat: string,        // 'DD/MM' | 'MM/DD' | 'YYYY-MM-DD'
}
```

Подробнее: [[currency-system]]

### subscriptionsStore

**Хранение:** AsyncStorage
**Ключ:** `subradar-subscriptions`
**Персистятся:** только `subscriptions[]`

```typescript
{
  subscriptions: Subscription[],
  filter: 'all' | 'active' | 'trial' | 'cancelled' | 'category',
  searchQuery: string,
  selectedCategory: string | null,
  getFiltered(): Subscription[],  // Вычисляемое
}
```

Подробнее: [[subscriptions]]

### paymentCardsStore

**Хранение:** in-memory (не персистится)

```typescript
{
  cards: PaymentCard[],
  setCards(), addCard(), updateCard(), removeCard(),
  getCard(id): PaymentCard | undefined,
}
```

### uiStore

**Хранение:** in-memory

```typescript
{
  addSheetVisible: boolean,
  openAddSheet(),
  closeAddSheet(),
}
```

Управляет видимостью `AddSubscriptionSheet` — глобально доступен через `useUIStore.getState().openAddSheet()`.

### analyticsStore

**Хранение:** in-memory

```typescript
{
  summary: AnalyticsSummary | null,
  monthly: MonthlyData[],
  byCategory: CategoryData[],
  setSummary, setMonthly, setByCategory,
}
```

**Примечание:** используется реже, основные аналитические данные загружаются напрямую через API в компоненте Analytics.

### reviewPromptStore

**Хранение:** AsyncStorage (Zustand `persist`)
**Ключ:** `subradar-review-prompt`
**Версия:** 1

```typescript
{
  installedAt: number | null,
  lastPromptedAt: number | null,
  promptCount: number,
  firedTriggers: Record<ReviewTrigger, true | undefined>,
  lastNegativeAt: number | null,
  lastActiveDay: string | null,    // YYYY-MM-DD
  consecutiveDays: number,
  recordAppOpen, markNegative, shouldPrompt, markPrompted, reset,
}
```

Подробнее: [[review-prompt]] — gates, throttling, streak tracking.

## TanStack Query — ключи и хуки

### Subscriptions

| Хук | Query Key | Описание |
|-----|-----------|----------|
| `useSubscriptions(params?)` | `['subscriptions', { ...params, displayCurrency }]` | Список (автоматически добавляет displayCurrency) |
| `useSubscription(id)` | `['subscriptions', id]` | Одна подписка |
| `useCreateSubscription()` | mutation | Создание → invalidate subscriptions + billing |
| `useUpdateSubscription()` | mutation | Обновление → invalidate subscriptions |
| `useDeleteSubscription()` | mutation | Удаление → invalidate subscriptions + billing |

### Billing

| Хук | Query Key | Описание |
|-----|-----------|----------|
| `useBillingStatus()` | `['billing', 'me']` | Статус подписки (staleTime: 30s) |
| `useEffectiveAccess()` | (wraps `useBillingStatus`) | Резолвенный EffectiveAccess с WeakMap identity cache |
| `usePlans()` | `['billing', 'plans']` | Доступные планы |
| `useStartTrial()` | mutation | Старт триала → invalidate billing |
| `useCancelSubscription()` | callback | Trial-cancel или IAP cancel via RC CustomerCenter |
| `useRevenueCat()` | RC SDK | offerings, purchasePackage, hasTrialOffer, loadOfferings |

### Workspace / Team

| Хук | Query Key | Описание |
|-----|-----------|----------|
| `useQuery(['workspace'])` | inline в `workspace.tsx` | `/workspace/me` |
| `useQuery(['workspace-analytics', currency])` | inline | `/workspace/me/analytics` |
| `useWorkspaceAnalysisLatest()` | `['workspace-analysis', 'latest']` | AI-анализ overlaps |
| `useRunWorkspaceAnalysis()` | mutation | Запуск AI-анализа |

### Gmail

| Хук | Описание |
|-----|----------|
| `useGmailStatus()` | `/gmail/status` — подключение + dailyScans quota |
| `useGmailConnect()` | mutation → authUrl для OAuth consent |
| `useGmailDisconnect()` | mutation → revoke + invalidate status |
| `useGmailScanJob()` | Background scan: start, resume, reset, polling, persistence |
| `useActiveGmailScan()` | Read-only companion для dashboard banner |

### Review Prompt

| Хук | Описание |
|-----|----------|
| `useReviewPrompt()` | `promptIfEligible(trigger)`, `markNegative()` |

### Analytics

| Хук | Query Key | Описание |
|-----|-----------|----------|
| `useAnalytics(params?)` | `['analytics', 'summary', displayCurrency, params]` | Саммари |

### AI

| Хук | Тип | Описание |
|-----|-----|----------|
| `useAILookupService()` | mutation | Поиск сервиса |
| `useAIParseText()` | mutation | Парсинг текста |
| `useVoiceToSubscription()` | mutation | Голос → подписка |
| `useScreenshotParse()` | mutation | Скриншот → подписка |

## AsyncStorage ключи

| Ключ | Тип | Описание |
|------|-----|----------|
| `auth-storage` | SecureStore | Авторизация (через secureStorage adapter) |
| `subradar-settings` | AsyncStorage | Настройки |
| `subradar-subscriptions` | AsyncStorage | Кеш подписок |
| `subradar-review-prompt` | AsyncStorage | Review prompt state |
| `gmail:scan:active-jobId` | AsyncStorage | Активный Gmail scan jobId (auto-resume) |
| `pending_receipt` | SecureStore | Apple receipt не синхронизирован с backend |
| `welcome_shown` | AsyncStorage | Флаг показа WelcomeSheet |
| `trial_offered` | AsyncStorage | Флаг предложения триала |
| `team_modal_shown_v1` | AsyncStorage | Флаг показа Team Upsell |
| `team_modal_dismissed_at` | AsyncStorage | Время dismiss Team Modal |
| `subradar:add-onboarding-seen` | AsyncStorage | Флаг прохождения add-onboarding |

## Инвалидация кешей

При смене `displayCurrency` или `region` инвалидируются:
- `['subscriptions']` — перезагрузка с новой валютой
- `['analytics']` — перерасчёт сумм

При переходе приложения в foreground:
- `['billing']` — проверка покупок

## Связанные страницы

- [[auth]] — authStore
- [[currency-system]] — settingsStore
- [[subscriptions]] — subscriptionsStore
- [[architecture]] — DataLoader и начальная загрузка
- [[billing]] — EffectiveAccess, useCancelSubscription
- [[gmail-import]] — useGmail* hooks
- [[workspace]] — workspace query keys
- [[review-prompt]] — reviewPromptStore + gates
- [[cards]] — paymentCardsStore
