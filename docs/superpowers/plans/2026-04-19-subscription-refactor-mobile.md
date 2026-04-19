# Subscription System Refactor — Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate SubRadar mobile app to the new backend billing contract — single source of truth `/billing/me`, hardened RevenueCat SDK, unified banner rendering, restore on Settings, no local billing computations.

**Architecture:** `useEffectiveAccess` becomes a thin wrapper over backend response. All date/grace/flag logic removed. `BannerRenderer` renders the single prioritized banner from `billing.banner.priority`. RC SDK fails fast on test key in production, configures-before-login.

**Tech Stack:** React Native + Expo SDK 51, TypeScript strict, TanStack Query v5, Zustand (in-memory only), RevenueCat SDK, expo-secure-store, Sentry.

**Spec:** `docs/superpowers/specs/2026-04-19-subscription-system-refactor-design.md`

**Repo:** `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile`

**Prerequisite:** Backend plan deployed (new `/billing/me` contract live).

**Phases:**
1. Types + API layer
2. useRevenueCat hardening
3. useEffectiveAccess rewrite + legacy cleanup
4. BannerRenderer + banner component migration
5. RestorePurchasesButton + Settings integration
6. Paywall — products from backend + pending receipt
7. DataLoader async + pending receipt recovery
8. subscriptionsStore cleanup
9. Analytics events
10. Tests + verification

---

## Phase 1: Types + API layer

### Task 1.1: BillingMeResponse type

**Files:**
- Create: `src/types/billing.ts` (or replace if exists)

- [ ] **Step 1: Check if file exists**

```bash
ls src/types/billing.ts 2>&1
```

- [ ] **Step 2: Write/replace types**

```ts
export type BannerPriority =
  | 'billing_issue' | 'grace' | 'expiration'
  | 'double_pay' | 'annual_upgrade' | 'win_back' | 'none';

export type Plan = 'free' | 'pro' | 'organization';
export type PlanSource = 'own' | 'team' | 'trial' | 'grace_pro' | 'grace_team' | 'free';
export type BillingState =
  | 'active' | 'cancel_at_period_end' | 'billing_issue'
  | 'grace_pro' | 'grace_team' | 'free';
export type GraceReason = 'team_expired' | 'pro_expired' | null;

export interface BillingMeResponse {
  effective: {
    plan: Plan;
    source: PlanSource;
    state: BillingState;
    billingPeriod: 'monthly' | 'yearly' | null;
  };
  ownership: {
    hasOwnPaidPlan: boolean;
    isTeamOwner: boolean;
    isTeamMember: boolean;
    teamOwnerId: string | null;
    workspaceId: string | null;
  };
  dates: {
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    nextPaymentDate: string | null;
    graceExpiresAt: string | null;
    graceDaysLeft: number | null;
    trialEndsAt: string | null;
    billingIssueStartedAt: string | null;
  };
  flags: {
    cancelAtPeriodEnd: boolean;
    hasBillingIssue: boolean;
    trialEligible: boolean;
    shouldShowDoublePay: boolean;
    degradedMode: boolean;
    hiddenSubscriptionsCount: number;
    graceReason: GraceReason;
  };
  banner: {
    priority: BannerPriority;
    payload: Record<string, unknown>;
  };
  limits: {
    subscriptions: { used: number; limit: number | null };
    aiRequests: { used: number; limit: number; resetAt: string };
    canCreateOrg: boolean;
    canInvite: boolean;
  };
  actions: {
    canStartTrial: boolean;
    canCancel: boolean;
    canRestore: boolean;
    canUpgradeToYearly: boolean;
    canInviteProFriend: boolean;
  };
  products: {
    pro: { monthly: string; yearly: string };
    team: { monthly: string; yearly: string };
  };
  serverTime: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/billing.ts
git commit -m "feat(billing): BillingMeResponse types"
```

---

### Task 1.2: Update billingApi

**Files:**
- Modify: `src/api/billing.ts`

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Update `getMe` return type**

```ts
import type { BillingMeResponse } from '../types/billing';

export const billingApi = {
  getMe: () => apiClient.get<BillingMeResponse>('/billing/me'),
  syncRevenueCat: (productId: string) => apiClient.post('/billing/sync-revenuecat', { productId }),
  startTrial: () => apiClient.post<{ endsAt: string }>('/billing/trial'),
  trialStatus: () => apiClient.get<{ trial: { endsAt: string; plan: string; source: string; consumed: boolean } | null }>('/billing/trial'),
  cancel: () => apiClient.post('/billing/cancel'),
  // Keep: activateInvite, deactivateInvite, etc.
};
```

- [ ] **Step 3: Commit**

```bash
git add src/api/billing.ts
git commit -m "feat(billing): billing API contract updated to BillingMeResponse"
```

---

### Task 1.3: Update useBillingStatus hook

**Files:**
- Modify: `src/hooks/useBilling.ts`

- [ ] **Step 1: Rewrite useBillingStatus to return new shape**

```ts
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../api/billing';
import type { BillingMeResponse } from '../types/billing';

export function useBillingStatus() {
  return useQuery<BillingMeResponse>({
    queryKey: ['billing', 'me'],
    queryFn: async () => {
      const { data } = await billingApi.getMe();
      return data;
    },
    staleTime: 10_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
npx tsc --noEmit
```

It will show errors in consumers — these are fixed in later tasks.

- [ ] **Step 3: Commit (type errors expected in other files, fix in next tasks)**

```bash
git add src/hooks/useBilling.ts
git commit -m "feat(billing): useBillingStatus returns BillingMeResponse"
```

---

## Phase 2: useRevenueCat hardening

### Task 2.1: Fix test key fallback + isPro fallback

**Files:**
- Modify: `src/hooks/useRevenueCat.ts`

- [ ] **Step 1: Read current file (lines 1-100)**

- [ ] **Step 2: Replace initialization block**

```ts
import * as Sentry from '@sentry/react-native';
// existing imports...

const RC_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS ?? process.env.EXPO_PUBLIC_REVENUECAT_KEY;
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_KEY_ANDROID ?? process.env.EXPO_PUBLIC_REVENUECAT_KEY;

function resolveRcKey(): string | null {
  const key = Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID;
  if (!key) {
    if (!__DEV__) {
      Sentry.captureMessage('RevenueCat key missing in production build', 'fatal');
      throw new Error('RevenueCat key missing — billing will not work');
    }
    console.warn('[RC] key missing — billing disabled in dev');
    return null;
  }
  if (!__DEV__ && key.startsWith('test_')) {
    Sentry.captureMessage('RevenueCat TEST key in production build', 'fatal');
    throw new Error('RevenueCat misconfigured: test key in production');
  }
  return key;
}

let configurePromise: Promise<void> | null = null;

export function configureRevenueCat(): Promise<void> {
  if (configurePromise) return configurePromise;
  configurePromise = (async () => {
    const apiKey = resolveRcKey();
    if (!apiKey) return;  // dev fallback — no-op
    await Purchases.configure({ apiKey });
    if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  })();
  return configurePromise;
}

export async function loginRevenueCat(userId: string): Promise<void> {
  await configureRevenueCat();
  await Purchases.logIn(userId);
}

export async function logoutRevenueCat(): Promise<void> {
  try {
    await configureRevenueCat();
    await Purchases.logOut();
  } catch (e) {
    // tolerate — user may have been anon
  }
}

export function isRevenueCatAvailable(): boolean {
  return !!resolveRcKey();
}
```

- [ ] **Step 3: Fix isPro fallback (search for `activeKeys.length > 0`)**

```ts
const activeEntitlements = customerInfo?.entitlements?.active ?? {};
const activeKeys = Object.keys(activeEntitlements);
const isPro = activeKeys.some(k => /^(pro|team)$/i.test(k));
const isTeam = activeKeys.some(k => /^team$/i.test(k));
```
Remove the `|| activeKeys.length > 0` clause.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit src/hooks/useRevenueCat.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRevenueCat.ts
git commit -m "fix(rc): fail-fast on test key in prod, async init, safe isPro"
```

---

### Task 2.2: Test — RC hardening

**Files:**
- Create: `src/hooks/__tests__/useRevenueCat.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { configureRevenueCat } from '../useRevenueCat';
// Set env before importing

describe('useRevenueCat resolveRcKey', () => {
  const realDev = (global as any).__DEV__;
  afterEach(() => { (global as any).__DEV__ = realDev; });

  it('throws in prod when key is test_...', async () => {
    (global as any).__DEV__ = false;
    process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS = 'test_abc';
    jest.resetModules();
    await expect(async () => {
      const mod = await import('../useRevenueCat');
      await mod.configureRevenueCat();
    }).rejects.toThrow(/misconfigured/);
  });
});
```

Given Jest config complexity, this test may need adjustment. If infrastructure prevents it, skip and verify manually via a production build.

- [ ] **Step 2: Run + commit**

```bash
npx jest src/hooks/__tests__/useRevenueCat.spec.ts
git add src/hooks/__tests__/
git commit -m "test(rc): test key prod detection"
```

---

## Phase 3: useEffectiveAccess rewrite + legacy cleanup

### Task 3.1: Rewrite useEffectiveAccess as thin wrapper

**Files:**
- Modify: `src/hooks/useEffectiveAccess.ts`

- [ ] **Step 1: Replace whole file**

```ts
import { useBillingStatus } from './useBilling';
import type { BillingMeResponse } from '../types/billing';

export interface EffectiveAccess {
  plan: BillingMeResponse['effective']['plan'];
  source: BillingMeResponse['effective']['source'];
  state: BillingMeResponse['effective']['state'];
  billingPeriod: BillingMeResponse['effective']['billingPeriod'];
  isPro: boolean;
  isTeamOwner: boolean;
  isTeamMember: boolean;
  hasOwnPaidPlan: boolean;
  currentPeriodEnd: Date | null;
  nextPaymentDate: Date | null;
  graceDaysLeft: number | null;
  graceReason: BillingMeResponse['flags']['graceReason'];
  trialEndsAt: Date | null;
  flags: BillingMeResponse['flags'];
  limits: BillingMeResponse['limits'];
  actions: BillingMeResponse['actions'];
  banner: BillingMeResponse['banner'];
  products: BillingMeResponse['products'];
  isLoading: boolean;
}

export function useEffectiveAccess(): EffectiveAccess | null {
  const { data: b, isLoading } = useBillingStatus();
  if (!b) return isLoading ? null : null;
  return {
    plan: b.effective.plan,
    source: b.effective.source,
    state: b.effective.state,
    billingPeriod: b.effective.billingPeriod,
    isPro: b.effective.plan !== 'free',
    isTeamOwner: b.ownership.isTeamOwner,
    isTeamMember: b.ownership.isTeamMember,
    hasOwnPaidPlan: b.ownership.hasOwnPaidPlan,
    currentPeriodEnd: b.dates.currentPeriodEnd ? new Date(b.dates.currentPeriodEnd) : null,
    nextPaymentDate: b.dates.nextPaymentDate ? new Date(b.dates.nextPaymentDate) : null,
    graceDaysLeft: b.dates.graceDaysLeft,
    graceReason: b.flags.graceReason,
    trialEndsAt: b.dates.trialEndsAt ? new Date(b.dates.trialEndsAt) : null,
    flags: b.flags,
    limits: b.limits,
    actions: b.actions,
    banner: b.banner,
    products: b.products,
    isLoading,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEffectiveAccess.ts
git commit -m "refactor(billing): useEffectiveAccess as thin wrapper over /billing/me"
```

---

### Task 3.2: Remove nextPaymentDate local utils

**Files:**
- Delete: `src/utils/nextPaymentDate.ts`
- Delete: `src/__tests__/nextPaymentDate.test.ts`
- Modify: all consumers

- [ ] **Step 1: Find consumers**

```bash
grep -rn "nextPaymentDate\|computeNextPaymentDate\|resolveNextPaymentDate" src/ app/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Replace each consumer with backend `nextPaymentDate` field**

For each hit:
- In subscription detail / list components: the backend's Subscription entity already returns `nextPaymentDate` (check API). Use that directly.
- If consumers were using `resolveNextPaymentDate` — replace with `sub.nextPaymentDate ?? null`.

- [ ] **Step 3: Delete files**

```bash
rm src/utils/nextPaymentDate.ts src/__tests__/nextPaymentDate.test.ts
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Fix any remaining errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(billing): drop local nextPaymentDate — backend is source of truth"
```

---

### Task 3.3: Remove usePlanLimits and legacy helpers

**Files:**
- Delete or rewrite: `src/hooks/usePlanLimits.ts`

- [ ] **Step 1: Find usePlanLimits consumers**

```bash
grep -rn "usePlanLimits" src/ app/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Replace with `useEffectiveAccess().limits`**

For each consumer:
```ts
// before
const { canAddSubscription } = usePlanLimits();
// after
const access = useEffectiveAccess();
const canAdd = access ? access.limits.subscriptions.limit === null || access.limits.subscriptions.used < access.limits.subscriptions.limit : false;
```

- [ ] **Step 3: Delete usePlanLimits.ts if unused, else trim to wrapper**

```bash
rm src/hooks/usePlanLimits.ts  # if safe
```

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "refactor(billing): drop usePlanLimits, use useEffectiveAccess.limits"
```

---

## Phase 4: BannerRenderer + banner components

### Task 4.1: BannerRenderer component

**Files:**
- Create: `src/components/BannerRenderer.tsx`

- [ ] **Step 1: Write component**

```tsx
import React from 'react';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { BillingIssueBanner } from './BillingIssueBanner';
import { GraceBanner } from './GraceBanner';
import { ExpirationBanner } from './ExpirationBanner';
import { DoublePayBanner } from './DoublePayBanner';
import { AnnualUpgradeBanner } from './AnnualUpgradeBanner';
import { WinBackBanner } from './WinBackBanner';

export function BannerRenderer() {
  const access = useEffectiveAccess();
  if (!access) return null;
  const { priority, payload } = access.banner;
  switch (priority) {
    case 'billing_issue': return <BillingIssueBanner payload={payload} />;
    case 'grace':         return <GraceBanner payload={payload} />;
    case 'expiration':    return <ExpirationBanner payload={payload} />;
    case 'double_pay':    return <DoublePayBanner payload={payload} />;
    case 'annual_upgrade':return <AnnualUpgradeBanner payload={payload} />;
    case 'win_back':      return <WinBackBanner payload={payload} />;
    default: return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BannerRenderer.tsx
git commit -m "feat(ui): BannerRenderer picks banner by priority"
```

---

### Task 4.2: Migrate banner components to payload prop

**Files:**
- Modify: `src/components/BillingIssueBanner.tsx`
- Modify: `src/components/GraceBanner.tsx`
- Modify: `src/components/ExpirationBanner.tsx`
- Modify: `src/components/DoublePayBanner.tsx`
- Modify: `src/components/AnnualUpgradeBanner.tsx`
- Modify: `src/components/WinBackBanner.tsx`

For each file:

- [ ] **Step 1: Change the component signature to accept `payload: Record<string, unknown>`**

```tsx
interface Props { payload: Record<string, unknown> }
export function GraceBanner({ payload }: Props) {
  const daysLeft = (payload as any).daysLeft as number ?? 0;
  const reason = (payload as any).reason as 'pro_expired' | 'team_expired' ?? 'pro_expired';
  // ... use daysLeft + reason for rendering
}
```

Before: the component called `useEffectiveAccess()` itself and decided when to render. Now parent (BannerRenderer) decides — banner just renders.

- [ ] **Step 2: Remove self-visibility logic**

Delete any `if (!shouldShow) return null` at the top — BannerRenderer already filters.

- [ ] **Step 3: Keep analytics** — track `banner_shown` once per mount:

```tsx
useEffect(() => {
  analytics.track('banner_shown', { priority: 'grace', daysLeft, reason });
}, []);
```

- [ ] **Step 4: Commit per banner or all together**

```bash
git add src/components/
git commit -m "refactor(ui): banner components accept payload prop"
```

---

### Task 4.3: Place BannerRenderer on screens

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/(tabs)/subscriptions.tsx`

- [ ] **Step 1: On each screen, remove direct banner imports + direct usage**

```bash
grep -n "GraceBanner\|BillingIssueBanner\|ExpirationBanner\|DoublePayBanner\|WinBackBanner\|AnnualUpgradeBanner" app/
```

- [ ] **Step 2: Replace with single `<BannerRenderer />`**

```tsx
import { BannerRenderer } from '../../src/components/BannerRenderer';

// inside screen:
<SafeAreaView>
  <BannerRenderer />
  {/* rest of screen */}
</SafeAreaView>
```

- [ ] **Step 3: Type-check + run dev**

```bash
npx tsc --noEmit
npm run start:dev
```
Open dev build, verify banners appear on correct screens.

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "refactor(ui): use BannerRenderer on all tab screens"
```

---

## Phase 5: Restore Purchases on Settings

### Task 5.1: Extract RestorePurchasesButton

**Files:**
- Create: `src/components/RestorePurchasesButton.tsx`

- [ ] **Step 1: Find existing restore logic in paywall**

```bash
grep -n "restorePurchases\|Restore Purchases" app/paywall.tsx
```

- [ ] **Step 2: Extract to reusable component**

```tsx
import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRevenueCat, isRevenueCatAvailable } from '../hooks/useRevenueCat';
import { billingApi } from '../api/billing';
import { analytics } from '../services/analytics';

interface Props {
  origin: 'paywall' | 'settings';
  styleLink?: boolean;
}

export function RestorePurchasesButton({ origin, styleLink = false }: Props) {
  const [loading, setLoading] = useState(false);
  const { restorePurchases } = useRevenueCat();
  const queryClient = useQueryClient();
  
  const onPress = async () => {
    if (!isRevenueCatAvailable()) {
      Alert.alert('Недоступно', 'Покупки не настроены на этой сборке');
      return;
    }
    analytics.track('restore_initiated', { origin });
    setLoading(true);
    try {
      const { success, productId } = await restorePurchases();
      if (success && productId) {
        await billingApi.syncRevenueCat(productId);
      }
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      analytics.track('restore_completed', { origin, success });
      Alert.alert(success ? 'Готово' : 'Не найдено', success ? 'Покупки восстановлены' : 'Активных подписок не найдено');
    } catch (e: any) {
      analytics.track('restore_failed', { origin, message: e?.message });
      Alert.alert('Ошибка', e?.message ?? 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <TouchableOpacity onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator /> : (
        <Text style={{ color: styleLink ? '#06B6D4' : undefined, textAlign: 'center', padding: 12 }}>
          Восстановить покупки
        </Text>
      )}
    </TouchableOpacity>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RestorePurchasesButton.tsx
git commit -m "feat(ui): reusable RestorePurchasesButton"
```

---

### Task 5.2: Use RestorePurchasesButton on paywall + settings

**Files:**
- Modify: `app/paywall.tsx`
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Paywall — replace inline restore with component**

Find inline restore `TouchableOpacity` in paywall and replace:
```tsx
import { RestorePurchasesButton } from '../src/components/RestorePurchasesButton';
// ...
<RestorePurchasesButton origin="paywall" styleLink />
```

- [ ] **Step 2: Settings — add restore button under subscription section**

```tsx
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Подписка</Text>
  {/* existing plan badge + status */}
  <RestorePurchasesButton origin="settings" styleLink />
</View>
```

- [ ] **Step 3: Test in dev**

```bash
npm run start:dev
```

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat(ui): restore purchases available on settings"
```

---

## Phase 6: Paywall products from backend + pending receipt

### Task 6.1: Products from backend

**Files:**
- Modify: `app/paywall.tsx`

- [ ] **Step 1: Find hardcoded PRODUCT_IDS**

```bash
grep -n "PRODUCT_IDS\|io.subradar.mobile" app/paywall.tsx
```

- [ ] **Step 2: Replace with `access.products`**

```tsx
const access = useEffectiveAccess();
const productIds = access?.products ?? null;
if (!productIds) return <LoadingState />;

// Use productIds.pro.monthly instead of PRODUCT_IDS.pro.monthly
```

- [ ] **Step 3: Remove fallback prices object**

Find hardcoded fallback prices (`app/paywall.tsx:167-174` per spec) and delete. If offerings are null, show loading or retry state.

- [ ] **Step 4: Commit**

```bash
git add app/paywall.tsx
git commit -m "refactor(paywall): product IDs from backend, no hardcoded fallback prices"
```

---

### Task 6.2: Pending receipt + retry modal

**Files:**
- Modify: `app/paywall.tsx`
- Add: `src/components/SyncRetryModal.tsx`

- [ ] **Step 1: Install expo-secure-store if missing**

```bash
npm ls expo-secure-store 2>&1 | head -3
```

- [ ] **Step 2: Create SyncRetryModal**

```tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function SyncRetryModal({ visible, onRetry, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
            Синхронизация подписки задерживается
          </Text>
          <Text style={{ marginBottom: 16 }}>
            Ваша покупка прошла, но мы пока не получили подтверждение. Попробуем ещё раз?
          </Text>
          <TouchableOpacity onPress={onRetry} style={{ padding: 12, backgroundColor: '#06B6D4', borderRadius: 8 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Проверить ещё раз</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={{ padding: 12 }}>
            <Text style={{ textAlign: 'center', color: '#888' }}>Позже</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: Wire into paywall purchase flow**

```tsx
import * as SecureStore from 'expo-secure-store';
import { SyncRetryModal } from '../src/components/SyncRetryModal';

const [showSyncRetry, setShowSyncRetry] = useState(false);
const [lastProductId, setLastProductId] = useState<string | null>(null);

async function onPurchase(pkg: PurchasesPackage) {
  await SecureStore.setItemAsync('pending_receipt', pkg.product.identifier);
  setLastProductId(pkg.product.identifier);
  
  analytics.track('purchase_initiated', { productId: pkg.product.identifier });
  const purchaseResult = await purchasePackage(pkg);
  if (!purchaseResult) {
    await SecureStore.deleteItemAsync('pending_receipt');
    return;
  }
  
  const syncOk = await attemptSync(pkg.product.identifier);
  if (syncOk) {
    await SecureStore.deleteItemAsync('pending_receipt');
    await queryClient.refetchQueries({ queryKey: ['billing'] });
  } else {
    setShowSyncRetry(true);
  }
}

async function attemptSync(productId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    analytics.track('sync_retry_attempt', { attempt: attempt + 1, productId });
    try {
      await billingApi.syncRevenueCat(productId);
      analytics.track('sync_retry_succeeded', { attempt: attempt + 1, productId });
      return true;
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  analytics.track('sync_retry_exhausted', { productId });
  return false;
}

async function onSyncRetryPressed() {
  if (!lastProductId) return;
  setShowSyncRetry(false);
  const ok = await attemptSync(lastProductId);
  if (ok) {
    await SecureStore.deleteItemAsync('pending_receipt');
    await queryClient.refetchQueries({ queryKey: ['billing'] });
  } else {
    setShowSyncRetry(true);
  }
}

// Render at bottom of component:
<SyncRetryModal 
  visible={showSyncRetry} 
  onRetry={onSyncRetryPressed} 
  onDismiss={() => setShowSyncRetry(false)} 
/>
```

- [ ] **Step 4: Commit**

```bash
git add app/paywall.tsx src/components/SyncRetryModal.tsx
git commit -m "feat(paywall): pending receipt + sync retry modal"
```

---

## Phase 7: DataLoader async + pending recovery

### Task 7.1: DataLoader async RC init + pending receipt recovery

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Read current DataLoader (around line 143)**

- [ ] **Step 2: Rewrite useEffect**

```tsx
import * as SecureStore from 'expo-secure-store';
import * as Sentry from '@sentry/react-native';
import { billingApi } from '../src/api/billing';
import { configureRevenueCat, loginRevenueCat, logoutRevenueCat } from '../src/hooks/useRevenueCat';

useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      if (!isAuthenticated) {
        await logoutRevenueCat();
        return;
      }
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;
      
      await loginRevenueCat(userId);
      
      // Pending receipt recovery
      const pending = await SecureStore.getItemAsync('pending_receipt');
      if (pending && !cancelled) {
        try {
          await billingApi.syncRevenueCat(pending);
          await SecureStore.deleteItemAsync('pending_receipt');
          queryClient.invalidateQueries({ queryKey: ['billing'] });
          analytics.track('pending_receipt_recovered', { productId: pending });
        } catch (e) {
          analytics.track('pending_receipt_recovery_failed', { productId: pending });
          // Keep it for next launch
        }
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { source: 'rc_init' } });
    }
  })();
  return () => { cancelled = true; };
}, [isAuthenticated]);
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "fix(rc): async configure-before-login + pending receipt recovery"
```

---

## Phase 8: Subscriptions store cleanup

### Task 8.1: Remove AsyncStorage persist

**Files:**
- Modify: `src/stores/subscriptionsStore.ts`

- [ ] **Step 1: Locate persist middleware**

```bash
grep -n "persist\|AsyncStorage" src/stores/subscriptionsStore.ts
```

- [ ] **Step 2: Remove `persist(...)` wrapping**

Before:
```ts
export const useSubscriptionsStore = create(
  persist<SubsState>((set, get) => ({ /* ... */ }), {
    name: 'subscriptions', storage: createJSONStorage(() => AsyncStorage),
  })
);
```
After:
```ts
export const useSubscriptionsStore = create<SubsState>((set, get) => ({ /* ... */ }));
```

- [ ] **Step 3: Remove any imports of AsyncStorage if unused**

- [ ] **Step 4: Commit**

```bash
git add src/stores/subscriptionsStore.ts
git commit -m "refactor(subs): drop AsyncStorage persist — TanStack Query is single cache"
```

---

## Phase 9: Analytics events

### Task 9.1: Add new analytics events to catalogue

**Files:**
- Modify: `src/services/analytics.ts`

- [ ] **Step 1: Add event names to catalogue**

```ts
const BILLING_EVENTS = [
  'sync_retry_attempt',
  'sync_retry_succeeded',
  'sync_retry_exhausted',
  'pending_receipt_recovered',
  'pending_receipt_recovery_failed',
  'restore_initiated',
  'restore_completed',
  'restore_failed',
  'banner_shown',
  'banner_action_tapped',
] as const;
```

- [ ] **Step 2: Add helpers if catalogue uses a class**

If analytics service uses typed methods (not just `track(name)`), add them:
```ts
syncRetryAttempt(attempt: number, productId: string) {
  this.track('sync_retry_attempt', { attempt, productId });
}
// similar for others
```

- [ ] **Step 3: Commit**

```bash
git add src/services/analytics.ts
git commit -m "feat(analytics): billing retry + restore + banner events"
```

---

## Phase 10: Tests + verification

### Task 10.1: Test useEffectiveAccess

**Files:**
- Create: `src/hooks/__tests__/useEffectiveAccess.spec.tsx`

- [ ] **Step 1: Write test**

```tsx
import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useEffectiveAccess } from '../useEffectiveAccess';
import { billingApi } from '../../api/billing';

jest.mock('../../api/billing');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useEffectiveAccess', () => {
  it('null when loading', async () => {
    (billingApi.getMe as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEffectiveAccess(), { wrapper });
    expect(result.current).toBeNull();
  });
  
  it('maps response fields', async () => {
    const mockResponse = {
      data: {
        effective: { plan: 'pro', source: 'own', state: 'active', billingPeriod: 'monthly' },
        ownership: { hasOwnPaidPlan: true, isTeamOwner: false, isTeamMember: false, teamOwnerId: null, workspaceId: null },
        dates: {
          currentPeriodStart: '2026-04-01T00:00:00Z',
          currentPeriodEnd: '2026-05-01T00:00:00Z',
          nextPaymentDate: '2026-05-01T00:00:00Z',
          graceExpiresAt: null, graceDaysLeft: null, trialEndsAt: null, billingIssueStartedAt: null,
        },
        flags: { cancelAtPeriodEnd: false, hasBillingIssue: false, trialEligible: false,
                 shouldShowDoublePay: false, degradedMode: false, hiddenSubscriptionsCount: 0, graceReason: null },
        banner: { priority: 'annual_upgrade', payload: { plan: 'pro' } },
        limits: { subscriptions: { used: 7, limit: null }, aiRequests: { used: 12, limit: 200, resetAt: '2026-05-01' }, canCreateOrg: false, canInvite: true },
        actions: { canStartTrial: false, canCancel: true, canRestore: true, canUpgradeToYearly: true, canInviteProFriend: true },
        products: { pro: { monthly: 'x', yearly: 'y' }, team: { monthly: 'a', yearly: 'b' } },
        serverTime: '2026-04-19T00:00:00Z',
      },
    };
    (billingApi.getMe as jest.Mock).mockResolvedValue(mockResponse);
    const { result, rerender } = renderHook(() => useEffectiveAccess(), { wrapper });
    await new Promise(r => setTimeout(r, 10));
    rerender({});
    expect(result.current?.plan).toBe('pro');
    expect(result.current?.banner.priority).toBe('annual_upgrade');
  });
});
```

- [ ] **Step 2: Run**

```bash
npx jest src/hooks/__tests__/useEffectiveAccess.spec.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/
git commit -m "test(billing): useEffectiveAccess snapshot + loading"
```

---

### Task 10.2: Test BannerRenderer

**Files:**
- Create: `src/components/__tests__/BannerRenderer.spec.tsx`

- [ ] **Step 1: Write test**

```tsx
import { render } from '@testing-library/react-native';
import React from 'react';
import { BannerRenderer } from '../BannerRenderer';
import * as hooks from '../../hooks/useEffectiveAccess';

jest.mock('../../hooks/useEffectiveAccess');

function mockAccess(priority: any, payload: any = {}) {
  (hooks.useEffectiveAccess as jest.Mock).mockReturnValue({
    banner: { priority, payload },
  });
}

describe('BannerRenderer', () => {
  it('renders nothing for none', () => {
    mockAccess('none');
    const { toJSON } = render(<BannerRenderer />);
    expect(toJSON()).toBeNull();
  });
  
  it('renders GraceBanner for grace', () => {
    mockAccess('grace', { daysLeft: 3, reason: 'pro_expired' });
    const { getByTestId } = render(<BannerRenderer />);
    expect(getByTestId('grace-banner')).toBeTruthy();
  });
});
```

Add `testID="grace-banner"` to `GraceBanner` root view if not present.

- [ ] **Step 2: Commit**

```bash
git add src/components/__tests__/
git commit -m "test(ui): BannerRenderer priority routing"
```

---

### Task 10.3: Full test suite + lint + typecheck

- [ ] **Step 1: Run tests**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
npm test
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Lint**

```bash
npm run lint 2>/dev/null || echo "no lint script"
```

- [ ] **Step 4: Start dev + manual smoke**

```bash
npm run start:dev
```
Open app on device / simulator, verify:
- Settings shows correct plan badge
- Opening paywall shows prices from backend
- Restore purchases button visible on Settings
- Banner shows correctly based on state

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(billing): type + test fixes post-refactor"
```

---

### Task 10.4: Translations for new banner payload fields

**Files:**
- Modify: all `*.json` under `src/i18n/locales/` (or wherever translations live)

- [ ] **Step 1: Find existing banner translations**

```bash
grep -rn "grace\|expiration\|billingIssue\|doublePay\|annualUpgrade\|winBack" src/i18n/
```

- [ ] **Step 2: Per feedback memory — translate every new i18n key in ALL 10 locales immediately**

For any new key added to banners / retry modal / restore button labels, add corresponding translation to every locale file.

Example new keys:
```json
{
  "billing": {
    "syncRetryTitle": "Синхронизация задерживается",
    "syncRetryMessage": "Покупка прошла, но подтверждение ещё не дошло",
    "syncRetryCta": "Проверить ещё раз",
    "restorePurchases": "Восстановить покупки",
    "restoreSuccess": "Покупки восстановлены",
    "restoreNotFound": "Активных подписок не найдено"
  }
}
```

Replace hardcoded strings in components with `t('billing.syncRetryTitle')`.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/
git commit -m "i18n(billing): add translations for refactor UI in all locales"
```

---

## Self-Review

Before ending, verify:
1. Every spec section applicable to mobile has a task.
2. No placeholders remain.
3. Function + hook names consistent.
4. All backend contract fields consumed correctly.
5. Every new string is translated in every locale.

---

## Execution Handoff

After backend plan completes and is stable, proceed to execute this mobile plan.
