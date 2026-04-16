---
title: "Подписки"
tags: [подписка, сущность, crud, статус]
sources:
  - src/types/index.ts
  - src/hooks/useSubscriptions.ts
  - src/stores/subscriptionsStore.ts
  - src/components/SubscriptionCard.tsx
updated: 2026-04-16
---

# Подписки (Subscription)

## Основная сущность

Подписка — центральная сущность приложения. Представляет регулярный платёж за сервис.

## Поля

```typescript
interface Subscription {
  id: string;
  name: string;
  category: Category;
  amount: number;               // Оригинальная сумма
  currency: string;             // Оригинальная валюта
  billingPeriod: BillingPeriod;
  billingDay?: number;
  nextPaymentDate?: string;
  startDate?: string;
  status: SubscriptionStatus;
  currentPlan?: string;
  availablePlans?: Record<string, unknown>[];
  trialEndDate?: string;
  cancelledAt?: string;
  paymentCardId?: string;
  paymentCard?: PaymentCard;
  iconUrl?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  managePlanUrl?: string;
  notes?: string;
  isBusinessExpense?: boolean;
  taxCategory?: string;
  reminderEnabled?: boolean;
  reminderDaysBefore?: number[] | null;
  color?: string | null;
  tags?: string[] | null;
  addedVia?: SourceType;        // MANUAL | AI_VOICE | AI_SCREENSHOT | AI_TEXT
  aiMetadata?: Record<string, unknown>;

  // Валютная конвертация (см. [[currency-system]])
  originalCurrency?: string;     // Историческая, неизменяемая
  displayAmount?: string;        // Сконвертированная сумма (от бэкенда)
  displayCurrency?: string;      // Валюта отображения
  fxRate?: number;
  fxFetchedAt?: string;

  // Каталог
  catalogServiceId?: string | null;
  catalogPlanId?: string | null;
}
```

## Типы

```typescript
type BillingPeriod = 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY' | 'LIFETIME' | 'ONE_TIME';
type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'TRIAL' | 'ARCHIVED';
type Category = 'STREAMING' | 'AI_SERVICES' | 'INFRASTRUCTURE' | 'MUSIC' | 'GAMING' |
  'PRODUCTIVITY' | 'HEALTH' | 'NEWS' | 'DEVELOPER' | 'EDUCATION' | 'FINANCE' |
  'DESIGN' | 'SECURITY' | 'SPORT' | 'BUSINESS' | 'OTHER';
type SourceType = 'MANUAL' | 'AI_VOICE' | 'AI_SCREENSHOT' | 'AI_TEXT';
```

## Жизненный цикл статусов

```
TRIAL ──────────────┐
  │                 │
  │ (trial ends)    │ (user cancels during trial)
  v                 v
ACTIVE ───────> CANCELLED
  │                 │
  │ (user pauses)   │ (user archives)
  v                 v
PAUSED          ARCHIVED
  │
  │ (user resumes)
  v
ACTIVE
```

### Правила переходов

- **TRIAL → ACTIVE**: автоматически по окончании триала (если не отменено)
- **TRIAL → CANCELLED**: пользователь отменяет во время триала
- **ACTIVE → PAUSED**: пользователь ставит на паузу
- **ACTIVE → CANCELLED**: пользователь отменяет
- **PAUSED → ACTIVE**: пользователь возобновляет
- **CANCELLED → ARCHIVED**: пользователь архивирует

## CRUD операции

### Хуки (TanStack Query)

```typescript
// Получить все подписки (с displayCurrency)
useSubscriptions(params?) → useQuery(['subscriptions', mergedParams])

// Получить одну подписку
useSubscription(id) → useQuery(['subscriptions', id])

// Создать
useCreateSubscription() → useMutation → invalidate(['subscriptions'], ['billing', 'me'])

// Обновить
useUpdateSubscription() → useMutation({ id, data }) → invalidate(['subscriptions'])

// Удалить
useDeleteSubscription() → useMutation(id) → invalidate(['subscriptions'], ['billing', 'me'])
```

**Важно:** `useSubscriptions()` автоматически подмешивает `displayCurrency` из `settingsStore` в параметры запроса. Бэкенд возвращает `displayAmount` и `displayCurrency` в каждой подписке.

### Zustand Store

`subscriptionsStore` используется для локального кеша и фильтрации:

```typescript
interface SubscriptionsState {
  subscriptions: Subscription[];
  filter: 'all' | 'active' | 'trial' | 'cancelled' | 'category';
  searchQuery: string;
  selectedCategory: string | null;
  // ... actions
  getFiltered(): Subscription[];  // Фильтрация по status/category/search
}
```

Персистится в AsyncStorage (ключ `subradar-subscriptions`) — только массив `subscriptions`.

## Отображение суммы

Для показа суммы подписки используется паттерн:

```typescript
// Предпочтение displayAmount (сконвертированная), fallback на amount (оригинальная)
const displayValue = Number(sub.displayAmount ?? sub.amount);

// Валюта: displayCurrency если есть, иначе оригинальная
const displayCur = sub.displayCurrency ?? sub.currency;

// Форматирование
formatMoney(displayValue, displayCur, i18n.language);
```

См. [[currency-system]] для деталей конвертации.

## Связанные страницы

- [[currency-system]] — конвертация валют и displayAmount
- [[ai-features]] — AI-способы создания подписок
- [[state-management]] — subscriptionsStore
- [[analytics]] — аналитика по подпискам
