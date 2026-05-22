---
title: "Paywall и IAP"
tags: [paywall, revenuecat, iap, монетизация, биллинг, экран]
sources:
  - app/paywall.tsx
  - src/hooks/useRevenueCat.ts
  - src/hooks/useEffectiveAccess.ts
  - src/api/billing.ts
  - src/components/RestorePurchasesButton.tsx
  - src/components/SyncRetryModal.tsx
  - src/components/PurchaseSuccessScreen.tsx
updated: 2026-05-22
---

# Paywall и IAP

Экран `app/paywall.tsx` — нативный paywall с RevenueCat IAP, prefill из
query params, attribution per gated feature, sync retry на post-purchase
backend delays.

## Query params (deep-link)

```
/paywall?prefill=pro-yearly&feature=magic_mail
```

| Param | Возможные значения | Использование |
|-------|-------------------|---------------|
| `prefill` | `pro-yearly`, `pro-monthly`, `org-yearly`, `org-monthly` | Преселект плана + периода |
| `feature` | `magic_mail`, `magic_image`, ... | Аттрибуция paywall view → purchase per feature |

Источник `feature` пропагируется в `analytics.paywallViewed(source, feature)`
→ воронка `tile_tap → paywall → purchase` измеряется per gated tile.

## Plans (UI shape)

```typescript
PLANS = [
  { id: 'free', features: [subs_3, ai_5, basic_analytics], missing: [...] },
  { id: 'pro',  features: [unlimited_subs, ai_200, advanced_analytics, pdf_reports] },
  { id: 'org',  features: [everything_pro, team_access, member_analytics, members_10] },
]
```

UI `'org'` маппится в backend key `'team'`.

## RevenueCat ключи

См. [[billing]] для полного списка. Sandbox vs production выбирается через
`expo-constants.releaseChannel`.

| Среда | Ключ |
|-------|------|
| Sandbox/Dev/TestFlight | `test_KCkKkTcGjgMgysTZtGukFRBZBBh` |
| Production (iOS) | `appl_IDgkDELtmOrLlMVaOpCcPemoqyH` |

## Products → RC packages

Backend в `/billing/me` возвращает `products`:
```typescript
products: {
  pro:  { monthly: 'io.subradar.mobile.pro.monthly', yearly: 'io.subradar.mobile.pro.yearly' },
  team: { monthly: 'io.subradar.mobile.team.monthly', yearly: 'io.subradar.mobile.team.yearly' },
}
```

UI находит RC package:
```typescript
findPackage(planId, period) →
  offerings.current.availablePackages.find(p =>
    p.product.identifier === productIdFor(planId, period))
```

Hardcoded fallback НЕ используется — если backend ещё не отдал ProductIDs,
показывается placeholder `…` пока offerings load.

## Покупка

```
1. user tap Continue → handleAction()
2. RevenueCat.purchasePackage(pkg) → Apple sheet → success
3. attemptSync(productId) — pой ретраев до 5 раз
   - billingApi.syncRevenueCat(productId)
   - refetchQueries(['billing'])
   - проверка `effective.plan` tier ≥ ожидаемый (free=0, pro=1, org=2)
   - backoff: 1.5s, 3s, 4.5s, 6s, 7.5s
4. Success → PurchaseSuccessScreen
5. Failure (5 retries exhausted) → SyncRetryModal с manual retry
```

### Plan tier check (важно)

`effective.plan === 'pro'` literal check ломается когда юзер уже team owner
и купил Pro — server merge даёт `effective.plan='organization'` (org > pro).
Поэтому проверяем **tier hierarchy**:
- expected tier = `/team|org/i.test(productId) ? 2 : 1`
- actual tier = `{ free: 0, pro: 1, organization: 2 }[plan]`
- success когда `actualTier >= expectedTier`

## Pending receipt persistence

`PENDING_RECEIPT_KEY = 'pending_receipt'` в SecureStore — маркер "Apple
receipt valid, backend sync ещё не прошёл". `DataLoader` на cold start
reconcile-ит через `reconcileBillingDrift()`.

## Restore purchases

`RestorePurchasesButton` → `Purchases.restorePurchases()` → если active
entitlement найден → `billingApi.syncRevenueCat()` → invalidate billing.

Используется когда:
- Юзер переустановил app
- Сменил Apple ID, потом вернулся
- Купил на одном устройстве, открыл на другом

## Team member edge case

Если `access.source === 'team' && !hasOwnPaidPlan` и юзер пытается купить
Pro → confirm dialog с предупреждением. Apple часто отказывает ("Purchases
unavailable") потому что Apple ID уже видит team entitlement как active
(Family Sharing, cached state).

## Trial offer

`hasTrialOffer` (от RC) + `access.actions.canStartTrial` (от backend) →
если оба true, paywall показывает trial CTA. Иначе обычный purchase.

## Close button delay

`setShowClose(true)` через 3 секунды — снижает impulsive dismissals от
случайного тапа.

## Prices unavailable state

Если RC offerings не резолвятся за 10 секунд → "Prices unavailable" state
с Retry кнопкой. Лучше чем silent infinite spinner.

## Analytics events

- `paywall_viewed { source, feature? }` — на mount
- `paywall_plan_selected { plan, period }` — при тапе на план
- `purchase_started { plan, period, productId }`
- `purchase_completed { plan, period, productId }`
- `sync_retry_attempt { attempt, productId }`
- `sync_retry_succeeded { attempt, productId }`
- `sync_retry_exhausted { productId, error }`

## Связанные страницы

- [[billing]] — `useEffectiveAccess`, RevenueCat configure, products
- [[gmail-import]] — отправляет `feature=magic_mail` сюда
- [[review-prompt]] — `markNegative()` при mount paywall
- [[known-issues]] — RC unavailable в Expo Go, sandbox lag
