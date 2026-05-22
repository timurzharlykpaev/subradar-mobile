---
title: "Биллинг и монетизация"
tags: [биллинг, revenuecat, подписка, триал, paywall, тарифы, effective-access]
sources:
  - src/hooks/useBilling.ts
  - src/hooks/useEffectiveAccess.ts
  - src/hooks/useCancelSubscription.ts
  - src/hooks/useRevenueCat.ts
  - src/types/billing.ts
  - src/utils/reconcileBillingDrift.ts
  - CLAUDE.md
  - docs/BILLING_RULES.md
updated: 2026-05-22
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

## BillingMeResponse и EffectiveAccess

Бэкенд `/billing/me` возвращает структурированный ответ `BillingMeResponse`,
который mobile резолвит в `EffectiveAccess` через [[state-management]] →
`useEffectiveAccess`.

```typescript
interface EffectiveAccess {
  // Эффективный план (учитывает trial > intro > paid > team-inherited > free)
  plan: 'free' | 'pro' | 'organization';
  source: 'own' | 'team' | 'trial' | 'intro' | 'free';
  state: 'active' | 'grace' | 'expired' | 'trialing' | 'cancelled';
  billingPeriod: 'monthly' | 'yearly' | null;

  isPro: boolean;             // plan !== 'free'
  isTeamOwner: boolean;
  isTeamMember: boolean;
  hasOwnPaidPlan: boolean;    // у юзера есть свой Apple receipt (не наследованный)

  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextPaymentDate: Date | null;
  graceExpiresAt: Date | null;
  graceDaysLeft: number | null;
  graceReason: GraceReason;   // 'team_expired' | 'pro_expired' | 'billing_issue' | null
  trialEndsAt: Date | null;
  billingIssueStartedAt: Date | null;

  flags: BillingFlags;        // hasBillingIssue, willCancel, etc.
  limits: BillingLimits;      // subscriptions, aiRequests, gmailScans
  actions: BillingActions;    // canStartTrial, canUpgrade, etc.
  banner: BillingBanner;      // priority + type для top-level баннера
  products: BillingProducts;  // ProductIDs от backend (см. [[paywall]])
}
```

### Effective access резолвер (приоритет)

Сервер мерджит источники доступа в один effective view:

```
trial > intro > own paid plan > team-inherited > grace > free
```

Поэтому `effective.plan === 'organization'` может быть результатом:
- own Team purchase (source='own')
- inherited через team owner (source='team')
- grace period после expiry (source='team', state='grace')

UI должен опираться на `source` + `state`, не только на `plan`.

### Identity cache

`useEffectiveAccess` использует `WeakMap<BillingMeResponse, EffectiveAccess>`
— TanStack Query structural sharing даёт one-and-the-same object reference
для byte-equal responses → consumers (AddSubscriptionSheet, BannerRenderer,
AIWizard) не получают fresh objects и chain of re-renders на каждый рендер.

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

Когда подписка отменяется (команда распадается, billing issue, expiry):
backend держит юзера на Pro/Team фичах ещё N дней (обычно 3-7).

```typescript
access.state === 'grace'
access.graceReason   → 'team_expired' | 'pro_expired' | 'billing_issue'
access.graceDaysLeft → number
access.graceExpiresAt → Date
```

Компоненты-баннеры (rendered через `BannerRenderer` с priority order):
`GraceBanner`, `ExpirationBanner`, `WinBackBanner`, `BillingIssueBanner`,
`DoublePayBanner`, `RefundBanner`.

## Reconciliation (RC ↔ backend drift)

Apple SDK и наш backend могут расходиться (webhook lag, sandbox quirks,
network issues). `reconcileBillingDrift()` (`src/utils/reconcileBillingDrift.ts`)
синхронизирует:

1. Fetch `Purchases.getCustomerInfo()` — actual entitlements от Apple
2. Сравни с `effective.plan` от backend
3. Если drift → вызови `billingApi.reconcile()` → backend pulls свежий
   state от RC REST API

**Когда триггерится:**
- `app/(tabs)/workspace.tsx` pull-to-refresh — самое видимое место drift'a
- `app/_layout.tsx` DataLoader cold start (если есть pending receipt)
- Commit `ba4d9c3`: backend в grace + RC active → trigger reconcile
- Commit `bc3d393`: cooldown + in-flight dedup чтобы не спамить

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

## Отмена подписки (тариф SubRadar, не отдельная подписка-сущность)

Через хук `useCancelSubscription` (`src/hooks/useCancelSubscription.ts`):

1. Если `isTrialing` → `billingApi.cancel()` напрямую (нет Apple receipt)
2. Иначе IAP path:
   - `checkRcEntitlement()` — снимок BEFORE state из RC
   - `RevenueCatUI.presentCustomerCenter()` (или fallback на
     `Linking.openURL('https://apps.apple.com/account/subscriptions')`)
   - После закрытия: `Purchases.invalidateCustomerInfoCache()` +
     `Purchases.syncPurchases()` — bust SDK in-memory cache
   - Снова `checkRcEntitlement()` + `rcHasPendingCancellation()` (проверка
     `willRenew=false`)
   - Если entitlement пропал ИЛИ pendingCancellation → `billingApi.cancel()`
     + `billingApi.reconcile()` (belt-and-suspenders)
3. `invalidateQueries(['billing'])` всегда — даже если юзер dismissed
   CustomerCenter, чтобы любые side-effects (renewal, plan switch) подхватились

## Team Upsell

Показывается Pro пользователям при:
- 8+ активных подписок
- 2+ дубликатов в категориях
- totalMonthly >= $50

Компоненты: `TeamUpsellModal`, `TeamSavingsBadge`.

## Связанные страницы

- [[paywall]] — IAP flow + sync retry + feature attribution
- [[ai-features]] — AI анализ (Pro-only)
- [[analytics]] — Pro-gated секции
- [[workspace]] — Team plan UI + transfer ownership
- [[state-management]] — billing кеш в TanStack Query
- [[reports]] — PDF generation gated на Pro
