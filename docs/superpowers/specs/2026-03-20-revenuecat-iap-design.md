# RevenueCat IAP Integration — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Summary

Integrate RevenueCat SDK for native Apple IAP subscriptions. Keep Lemon Squeezy for web. Backend handles both webhooks. Mobile paywall uses native purchases instead of browser checkout.

## Products (App Store Connect)

| Product ID | Plan | Period |
|-----------|------|--------|
| `io.subradar.mobile.pro.monthly` | Pro | Monthly |
| `io.subradar.mobile.pro.yearly` | Pro | Yearly |
| `io.subradar.mobile.team.monthly` | Team | Monthly |
| `io.subradar.mobile.team.yearly` | Team | Yearly |

## RevenueCat Config

- **API Key:** `test_KCkKkTcGjgMgysTZtGukFRBZBBh` (test, swap to production key later)
- **Entitlements:** `pro`, `team`
- **Offering:** Default with 4 packages mapped to above products
- **Webhook URL:** `https://api.subradar.ai/api/v1/billing/revenuecat-webhook`

---

## 1. SDK Initialization

### Location: `app/_layout.tsx`
- Call `Purchases.configure()` early, before auth check
- `apiKey`: from env `EXPO_PUBLIC_REVENUECAT_API_KEY` or hardcoded test key
- `storeKitVersion: STOREKIT_2`
- Debug logs in `__DEV__` mode only

### User Identification
- After login (when userId available): `Purchases.logIn(userId)`
- On logout: `Purchases.logOut()`
- This ties RevenueCat customer to our backend userId, critical for webhook `app_user_id`

---

## 2. Hook: useRevenueCat

### Location: `src/hooks/useRevenueCat.ts`

```typescript
interface UseRevenueCatReturn {
  customerInfo: CustomerInfo | null;
  isPro: boolean;        // entitlement 'pro' or 'team' active
  isTeam: boolean;       // entitlement 'team' active
  offerings: Offerings | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  loading: boolean;
}
```

- Fetches customerInfo on mount + listener for updates
- Fetches offerings on mount
- `isPro` checks `customerInfo.entitlements.active['pro'] || customerInfo.entitlements.active['team']`
- `isTeam` checks `customerInfo.entitlements.active['team']`
- `purchasePackage` wraps `Purchases.purchasePackage`, returns true if entitlement activated
- `restorePurchases` wraps `Purchases.restorePurchases`

---

## 3. Paywall Changes

### Location: `app/paywall.tsx`

### Keep existing UI, replace payment mechanism:
- Load offerings from `useRevenueCat().offerings`
- Show real App Store prices from `product.priceString` instead of hardcoded `$2.99`
- Show intro price / free trial if available from `product.introPrice`
- CTA button:
  - Free → close paywall
  - Pro/Team → `purchasePackage(selectedPackage)` (native IAP sheet)
  - On success → entitlement check → close paywall + refresh billing status
- Add "Restore Purchases" link at bottom (required by App Store Review)
- Remove `useCheckout()` / `Linking.openURL()` flow for mobile

### Package mapping:
```
offerings.current.monthly   → Pro Monthly
offerings.current.annual    → Pro Yearly
Custom 'team_monthly'       → Team Monthly
Custom 'team_annual'        → Team Yearly
```

---

## 4. Backend: RevenueCat Webhook

### New endpoint: `POST /billing/revenuecat-webhook`

### Location: `src/billing/billing.controller.ts` + `billing.service.ts`

### Auth: Check `Authorization` header against env `REVENUECAT_WEBHOOK_SECRET`

### Event handling:

| Event Type | Action |
|-----------|--------|
| `INITIAL_PURCHASE` | Set `user.plan` based on product_id, set `billingSource = 'revenuecat'` |
| `RENEWAL` | Extend period (plan already correct) |
| `CANCELLATION` | Mark `cancelAtPeriodEnd = true` |
| `EXPIRATION` | Set `user.plan = 'free'`, clear `billingSource` |
| `PRODUCT_CHANGE` | Update plan (pro ↔ organization) |
| `BILLING_ISSUE` | Log warning |

### Product → Plan mapping:
```
io.subradar.mobile.pro.monthly    → 'pro'
io.subradar.mobile.pro.yearly     → 'pro'
io.subradar.mobile.team.monthly   → 'organization'
io.subradar.mobile.team.yearly    → 'organization'
```

### New field on User entity:
- `billingSource: 'lemon_squeezy' | 'revenuecat' | null`
- Lemon Squeezy webhook sets `billingSource = 'lemon_squeezy'`
- RevenueCat webhook sets `billingSource = 'revenuecat'`

---

## 5. Customer Center + Settings

### Location: `app/(tabs)/settings.tsx`

### Manage Subscription button:
- If `billingSource === 'revenuecat'` → `RevenueCatUI.presentCustomerCenter()`
- If `billingSource === 'lemon_squeezy'` → `Linking.openURL(customerPortalUrl)`
- If free → hide button

### Restore Purchases button:
- Always visible in Settings
- `Purchases.restorePurchases()` → update UI
- Required for App Store Review

---

## 6. Integration with existing useBilling / usePlanLimits

### useBilling stays as-is for backend billing status (GET /billing/me)
### usePlanLimits reads from useBilling (backend is source of truth for limits)
### useRevenueCat is the purchase/entitlement layer — triggers purchases and checks IAP status
### Backend webhook keeps user.plan in sync — so useBilling returns correct data after webhook fires

Flow:
```
User taps Upgrade → purchasePackage() → Apple IAP sheet → success
→ RevenueCat processes receipt → webhook to backend
→ Backend updates user.plan → useBilling re-fetches → UI updates
```

---

## 7. Files to modify/create

### Mobile — new:
- `src/hooks/useRevenueCat.ts` — new hook
- Install: `npm install react-native-purchases react-native-purchases-ui`

### Mobile — modify:
- `app/_layout.tsx` — Purchases.configure() + logIn/logOut
- `app/paywall.tsx` — native purchases instead of web checkout
- `app/(tabs)/settings.tsx` — Customer Center + Restore Purchases
- `app.json` — no special config needed for RevenueCat with Expo

### Backend — modify:
- `src/billing/billing.controller.ts` — new revenuecat-webhook endpoint
- `src/billing/billing.service.ts` — handleRevenueCatWebhook method
- `src/users/entities/user.entity.ts` — add `billingSource` column
- Migration for `billingSource` column
- `.env` — add `REVENUECAT_WEBHOOK_SECRET`

### Out of scope:
- Google Play Billing (Android) — future
- RevenueCat Paywall templates (using custom paywall)
- Lemon Squeezy removal (stays for web)
