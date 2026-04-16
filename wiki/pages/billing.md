---
title: "Биллинг и монетизация"
tags: [биллинг, revenuecat, подписка, триал, paywall, тарифы]
sources:
  - src/hooks/useBilling.ts
  - src/types/index.ts
  - CLAUDE.md
  - docs/BILLING_RULES.md
updated: 2026-04-16
---

# Биллинг и монетизация

## Тарифные планы

| План | Цена | Что включено |
|------|------|-------------|
| **Free** | $0 | Базовый трекинг, ограниченное кол-во подписок и AI запросов |
| **Pro** | $2.99/мес или $26.99/год | Безлимит подписок, AI анализ, прогнозы, savings, отчёты |
| **Team/Organization** | — | Shared workspace, командные фичи |

## RevenueCat

Интеграция через `react-native-purchases` и `react-native-purchases-ui`.

### Ключи

| Среда | Ключ | Использование |
|-------|------|---------------|
| Sandbox/Dev | `test_KCkKkTcGjgMgysTZtGukFRBZBBh` | development, preview |
| Production (iOS) | `appl_IDgkDELtmOrLlMVaOpCcPemoqyH` | testflight, production |

### Entitlements

- `pro` — Pro план
- `team` — Team план

### Products

- `io.subradar.mobile.pro.monthly`
- `io.subradar.mobile.pro.yearly`
- `io.subradar.mobile.team.monthly`
- `io.subradar.mobile.team.yearly`

### Конфигурация

RevenueCat настраивается лениво в `DataLoader` (после загрузки нативных модулей):

```typescript
configureRevenueCat();          // При авторизации
loginRevenueCat(userId);        // Идентификация
logoutRevenueCat();             // При выходе
```

## BillingStatus

```typescript
interface BillingStatus {
  plan: 'free' | 'pro' | 'organization';
  status: 'active' | 'cancelled' | 'trialing';
  source?: 'own' | 'team' | 'grace_team' | 'grace_pro' | 'free';
  isTeamOwner?: boolean;
  isTeamMember?: boolean;
  hasOwnPro?: boolean;
  graceUntil?: string | null;
  graceDaysLeft?: number | null;
  hasBillingIssue?: boolean;
  cancelAtPeriodEnd?: boolean;
  trialUsed: boolean;
  trialDaysLeft?: number | null;
  subscriptionCount: number;
  subscriptionLimit: number | null;
  aiRequestsUsed: number;
  aiRequestsLimit: number | null;
}
```

## Хуки

```typescript
useBillingStatus() → useQuery(['billing', 'me'])
  // staleTime: 30s, refetchOnMount: 'always', retry: 1

usePlans() → useQuery(['billing', 'plans'])

useStartTrial() → useMutation → invalidate(['billing', 'me'])
```

## Определение плана в UI

```typescript
const isCancelled = billing?.status === 'cancelled' || billing?.cancelAtPeriodEnd === true;
const isPro = (billing?.plan === 'pro' || billing?.plan === 'organization') && !isCancelled;
const isTeam = billing?.plan === 'organization' && !isCancelled;
const isTrialing = billing?.status === 'trialing' && !billing?.cancelAtPeriodEnd;
```

## Gating фич

### Pro-gated секции на Analytics

- Forecast (30d, 6m, 12m)
- Savings Analysis
- AI Analysis

Используется компонент `BlurredProSection`:
- Если `isPro` — показывает контент
- Если нет — blurred overlay + кнопка upgrade

### Pro-gated виджет на Dashboard

- AI Insights — показывается только если `isPro && aiResult`
- Для не-Pro: тизер "AI can find savings" → кнопка "Try Pro"

## Grace Period

Когда подписка отменяется (команда распадается, или billing issue):

```typescript
access.shouldShowGraceBanner → true
access.graceReason          → 'team_expired' | 'pro_expired' | ...
access.graceDaysLeft        → number
```

Компоненты: `GraceBanner`, `ExpirationBanner`, `WinBackBanner`, `BillingIssueBanner`, `DoublePayBanner`.

## Degraded Mode

Когда пользователь теряет Pro-доступ:

```typescript
access.isInDegradedMode → true
access.hiddenSubsCount  → number
```

В degraded mode:
- Dashboard показывает только 3 первых подписки
- Hero card показывает hint о скрытых подписках
- Analytics показывает hint с полной суммой

## Триал

- Триал предлагается после добавления первой подписки (TrialOfferModal)
- `AsyncStorage.trial_offered` — флаг показа
- Start trial: `billingApi.startTrial()`

## Отмена подписки

Settings → Manage Subscription:
1. `CancellationInterceptModal` — предлагает остаться
2. Если trialing → `billingApi.cancel()` напрямую
3. Если RC subscriber → `RevenueCatUI.presentCustomerCenter()`
4. После закрытия CustomerCenter → `syncAfterCustomerCenter()` — проверяет entitlements и синхронизирует с бэкендом

## Team Upsell

Показывается Pro пользователям при:
- 8+ активных подписок
- 2+ дубликатов в категориях
- totalMonthly >= $50

Компоненты: `TeamUpsellModal`, `TeamSavingsBadge`.

## Связанные страницы

- [[ai-features]] — AI анализ (Pro-only)
- [[analytics]] — Pro-gated секции
- [[state-management]] — billing кеш в TanStack Query
