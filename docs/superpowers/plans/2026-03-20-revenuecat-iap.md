# RevenueCat IAP Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate RevenueCat SDK for native Apple IAP subscriptions, keep Lemon Squeezy for web, backend handles both webhooks.

**Architecture:** Mobile installs `react-native-purchases` + `react-native-purchases-ui`, initializes in _layout.tsx, new `useRevenueCat` hook for purchases/entitlements, paywall uses native IAP instead of web checkout, backend adds RevenueCat webhook endpoint + `billingSource` field on User.

**Tech Stack:** react-native-purchases, react-native-purchases-ui, NestJS, TypeORM

**Spec:** `docs/superpowers/specs/2026-03-20-revenuecat-iap-design.md`

---

## Task 1: Install RevenueCat SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
npm install --save react-native-purchases react-native-purchases-ui
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: install react-native-purchases and react-native-purchases-ui"
```

---

## Task 2: Create useRevenueCat hook

**Files:**
- Create: `src/hooks/useRevenueCat.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useRevenueCat.ts
import { useEffect, useState, useCallback } from 'react';
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Alert, Platform } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || 'test_KCkKkTcGjgMgysTZtGukFRBZBBh';

let configured = false;

export function configureRevenueCat() {
  if (configured) return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({
    apiKey: API_KEY,
    appUserID: null,
  });
  configured = true;
}

export async function loginRevenueCat(userId: string) {
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('RevenueCat logIn failed:', e);
  }
}

export async function logoutRevenueCat() {
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('RevenueCat logOut failed:', e);
  }
}

export function useRevenueCat() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [info, off] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (mounted) {
          setCustomerInfo(info);
          setOfferings(off);
        }
      } catch (e) {
        console.warn('RevenueCat load failed:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const listener = (info: CustomerInfo) => {
      if (mounted) setCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const isPro = !!(
    customerInfo?.entitlements.active['pro'] ||
    customerInfo?.entitlements.active['team']
  );

  const isTeam = !!customerInfo?.entitlements.active['team'];

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return !!(info.entitlements.active['pro'] || info.entitlements.active['team']);
    } catch (error: any) {
      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return false;
      }
      if (error.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
        await restorePurchases();
        return isPro;
      }
      Alert.alert('Purchase Error', error.message);
      return false;
    }
  }, [isPro]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return !!(info.entitlements.active['pro'] || info.entitlements.active['team']);
    } catch (error: any) {
      Alert.alert('Restore Error', error.message);
      return false;
    }
  }, []);

  return {
    customerInfo,
    offerings,
    isPro,
    isTeam,
    purchasePackage,
    restorePurchases,
    loading,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useRevenueCat.ts
git commit -m "feat: create useRevenueCat hook with purchase, restore, entitlement checking"
```

---

## Task 3: Initialize SDK and identify user in _layout.tsx

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add RevenueCat initialization**

Read `app/_layout.tsx`. Add import at top:
```typescript
import { configureRevenueCat, loginRevenueCat, logoutRevenueCat } from '../src/hooks/useRevenueCat';
```

Call `configureRevenueCat()` early — right after the `Notifications.setNotificationHandler` block (line ~28), before any component:
```typescript
configureRevenueCat();
```

- [ ] **Step 2: Add logIn/logOut in DataLoader**

In the `DataLoader` component, inside the `useEffect` that checks `isAuthenticated`:

After `if (!isAuthenticated) return;` add:
```typescript
    // Identify user in RevenueCat for webhook correlation
    import('../src/stores/authStore').then(({ useAuthStore }) => {
      const userId = useAuthStore.getState().userId;
      if (userId) loginRevenueCat(userId);
    });
```

Also add a cleanup or separate effect for logout. Find where logout happens in the app (likely in authStore or settings). The simplest approach: in DataLoader, add:
```typescript
    if (!isAuthenticated) {
      logoutRevenueCat();
      return;
    }
```

Move the `logoutRevenueCat()` call BEFORE the early return.

- [ ] **Step 3: Commit**

```bash
git add "app/_layout.tsx"
git commit -m "feat: initialize RevenueCat SDK and identify user on login"
```

---

## Task 4: Update paywall to use native purchases

**Files:**
- Modify: `app/paywall.tsx`

- [ ] **Step 1: Read the full file, then update imports and add useRevenueCat**

Add import:
```typescript
import { useRevenueCat } from '../src/hooks/useRevenueCat';
import { PurchasesPackage } from 'react-native-purchases';
```

Inside the component, add:
```typescript
const { offerings, purchasePackage, restorePurchases, isPro: rcIsPro } = useRevenueCat();
```

- [ ] **Step 2: Replace hardcoded prices with App Store prices**

Find the `getPrice` function (returns hardcoded `$2.99`, `$24.99`, etc). Replace with logic that reads from offerings:

```typescript
const getPrice = (planId: string): { price: string; period: string } => {
  if (planId === 'free') return { price: t('paywall.free_price', 'Free'), period: '' };

  // Try to get real prices from RevenueCat offerings
  const current = offerings?.current;
  if (current) {
    if (planId === 'pro') {
      const pkg = billingPeriod === 'yearly' ? current.annual : current.monthly;
      if (pkg) return { price: pkg.product.priceString, period: `/${billingPeriod === 'yearly' ? t('paywall.year', 'yr') : t('paywall.month', 'mo')}` };
    }
    if (planId === 'org') {
      const pkg = billingPeriod === 'yearly'
        ? current.availablePackages.find(p => p.identifier === 'team_annual' || p.product.identifier === 'io.subradar.mobile.team.yearly')
        : current.availablePackages.find(p => p.identifier === 'team_monthly' || p.product.identifier === 'io.subradar.mobile.team.monthly');
      if (pkg) return { price: pkg.product.priceString, period: `/${billingPeriod === 'yearly' ? t('paywall.year', 'yr') : t('paywall.month', 'mo')}` };
    }
  }

  // Fallback to hardcoded prices
  if (planId === 'pro') {
    return billingPeriod === 'yearly'
      ? { price: '$24.99', period: `/${t('paywall.year', 'yr')}` }
      : { price: '$2.99', period: `/${t('paywall.month', 'mo')}` };
  }
  return billingPeriod === 'yearly'
    ? { price: '$79.99', period: `/${t('paywall.year', 'yr')}` }
    : { price: '$9.99', period: `/${t('paywall.month', 'mo')}` };
};
```

- [ ] **Step 3: Replace handleAction to use native IAP**

Replace the `handleAction` function. Keep trial logic, but replace the web checkout redirect with native purchase:

```typescript
const handleAction = async () => {
  if (selected === 'free') { router.back(); return; }

  // Trial flow stays the same
  if (selected === 'pro' && canTrial) {
    try {
      await startTrialMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      Alert.alert(
        t('subscription_plan.trial_activated'),
        t('subscription_plan.trial_activated_msg'),
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || '');
    }
    return;
  }

  // Already on this plan
  const currentMatch =
    (selected === 'pro' && billing?.plan === 'pro') ||
    (selected === 'org' && billing?.plan === 'organization');
  if (currentMatch && !isTrialing) return;

  // Native IAP purchase
  const current = offerings?.current;
  if (!current) {
    Alert.alert(t('common.error'), 'No offerings available');
    return;
  }

  let pkg: PurchasesPackage | undefined;
  if (selected === 'pro') {
    pkg = billingPeriod === 'yearly' ? current.annual ?? undefined : current.monthly ?? undefined;
  } else {
    pkg = current.availablePackages.find(p =>
      p.identifier === (billingPeriod === 'yearly' ? 'team_annual' : 'team_monthly') ||
      p.product.identifier === (billingPeriod === 'yearly' ? 'io.subradar.mobile.team.yearly' : 'io.subradar.mobile.team.monthly')
    );
  }

  if (!pkg) {
    Alert.alert(t('common.error'), 'Package not found');
    return;
  }

  const success = await purchasePackage(pkg);
  if (success) {
    await queryClient.invalidateQueries({ queryKey: ['billing'] });
    Alert.alert(
      t('subscription_plan.upgrade_success', 'Success!'),
      t('subscription_plan.upgrade_success_msg', 'Welcome to Pro!'),
      [{ text: 'OK', onPress: () => router.back() }]
    );
  }
};
```

- [ ] **Step 4: Add Restore Purchases button at bottom**

Find the ScrollView bottom area (before closing `</ScrollView>`). Add:

```tsx
{/* Restore Purchases */}
<TouchableOpacity
  style={{ alignItems: 'center', paddingTop: 16 }}
  onPress={async () => {
    const restored = await restorePurchases();
    if (restored) {
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      Alert.alert(t('paywall.restored', 'Restored!'), t('paywall.restored_msg', 'Your subscription has been restored.'));
      router.back();
    }
  }}
>
  <Text style={{ color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>
    {t('paywall.restore_purchases', 'Restore Purchases')}
  </Text>
</TouchableOpacity>
```

- [ ] **Step 5: Add i18n keys for new strings**

Add to all 9 locale files in the `paywall` or `subscription_plan` section:
- en: `"restore_purchases": "Restore Purchases"`, `"restored": "Restored!"`, `"restored_msg": "Your subscription has been restored."`, `"upgrade_success": "Success!"`, `"upgrade_success_msg": "Welcome to Pro!"`

For brevity, en + ru are required, rest use fallbacks.

- [ ] **Step 6: Commit**

```bash
git add "app/paywall.tsx" src/locales/
git commit -m "feat: paywall uses native IAP via RevenueCat instead of web checkout"
```

---

## Task 5: Backend — add billingSource to User + RevenueCat webhook

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/users/entities/user.entity.ts`
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/billing/billing.controller.ts`
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/billing/billing.service.ts`
- Create: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/migrations/1742500100000-AddBillingSource.ts`

- [ ] **Step 1: Add billingSource to User entity**

In `user.entity.ts`, before `@CreateDateColumn()`, add:
```typescript
@Column({ nullable: true })
billingSource: string;
```

- [ ] **Step 2: Create migration**

Create `src/migrations/1742500100000-AddBillingSource.ts`:
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingSource1742500100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billingSource" varchar`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "billingSource"`);
  }
}
```

- [ ] **Step 3: Add RevenueCat webhook endpoint to controller**

In `billing.controller.ts`, add new endpoint:

```typescript
@Post('revenuecat-webhook')
async revenuecatWebhook(
  @Headers('authorization') authorization: string,
  @Body() body: any,
) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret || authorization !== `Bearer ${secret}`) {
    throw new BadRequestException('Invalid webhook authorization');
  }
  await this.billingService.handleRevenueCatWebhook(body);
  return { received: true };
}
```

- [ ] **Step 4: Add handleRevenueCatWebhook to service**

In `billing.service.ts`, add method:

```typescript
private readonly RC_PRODUCT_TO_PLAN: Record<string, string> = {
  'io.subradar.mobile.pro.monthly': 'pro',
  'io.subradar.mobile.pro.yearly': 'pro',
  'io.subradar.mobile.team.monthly': 'organization',
  'io.subradar.mobile.team.yearly': 'organization',
};

async handleRevenueCatWebhook(body: any): Promise<void> {
  const event = body?.event;
  if (!event) return;

  const type: string = event.type;
  const appUserId: string = event.app_user_id;
  const productId: string = event.product_id;

  if (!appUserId || appUserId.startsWith('$RCAnonymousID')) {
    this.logger.warn(`RevenueCat webhook: anonymous user, skipping. Type: ${type}`);
    return;
  }

  const user = await this.usersService.findById(appUserId).catch(() => null);
  if (!user) {
    this.logger.warn(`RevenueCat webhook: user ${appUserId} not found`);
    return;
  }

  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE': {
      const plan = this.RC_PRODUCT_TO_PLAN[productId] || 'pro';
      user.plan = plan;
      user.billingSource = 'revenuecat';
      await this.usersService.save(user);
      this.logger.log(`RevenueCat: ${type} — user ${appUserId} → plan ${plan}`);
      break;
    }
    case 'CANCELLATION': {
      // Don't downgrade immediately — access continues until period end
      this.logger.log(`RevenueCat: CANCELLATION — user ${appUserId} will expire at period end`);
      break;
    }
    case 'EXPIRATION': {
      user.plan = 'free';
      user.billingSource = null;
      await this.usersService.save(user);
      this.logger.log(`RevenueCat: EXPIRATION — user ${appUserId} → free`);
      break;
    }
    case 'BILLING_ISSUE': {
      this.logger.warn(`RevenueCat: BILLING_ISSUE — user ${appUserId}, product ${productId}`);
      break;
    }
    default:
      this.logger.log(`RevenueCat: unhandled event type ${type}`);
  }
}
```

Also update existing Lemon Squeezy webhook handler to set `billingSource = 'lemon_squeezy'` when processing subscription events. Find the handleWebhook method and add `user.billingSource = 'lemon_squeezy'` before save.

- [ ] **Step 5: Ensure UsersService has save method**

Check if `usersService.save(user)` exists. If not, add to users.service.ts:
```typescript
async save(user: User): Promise<User> {
  return this.repo.save(user);
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add -A
git commit -m "feat: add RevenueCat webhook endpoint and billingSource to User"
```

---

## Task 6: Settings — Customer Center + Restore Purchases

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Read settings.tsx and add RevenueCat imports**

Add imports:
```typescript
import RevenueCatUI from 'react-native-purchases-ui';
import { useRevenueCat } from '../../src/hooks/useRevenueCat';
```

Add hook usage inside component:
```typescript
const { restorePurchases } = useRevenueCat();
```

- [ ] **Step 2: Add Manage Subscription button**

Find the billing/plan section in settings (where plan info is displayed). Add a "Manage Subscription" button:

```tsx
<TouchableOpacity
  style={[styles.settingsRow, { backgroundColor: colors.card, borderColor: colors.border }]}
  onPress={async () => {
    // If paid via RevenueCat (IAP) → native Customer Center
    // If paid via Lemon Squeezy (web) → open web portal
    // For now, try RevenueCat Customer Center
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch {
      // Fallback or user has no RC subscription
      Alert.alert(t('settings.manage_sub_web', 'Visit the web app to manage your subscription.'));
    }
  }}
>
  <Ionicons name="card-outline" size={20} color={colors.text} />
  <Text style={{ flex: 1, fontSize: 15, color: colors.text, marginLeft: 12 }}>
    {t('settings.manage_subscription', 'Manage Subscription')}
  </Text>
  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
</TouchableOpacity>
```

- [ ] **Step 3: Add Restore Purchases button**

Below Manage Subscription:
```tsx
<TouchableOpacity
  style={[styles.settingsRow, { backgroundColor: colors.card, borderColor: colors.border }]}
  onPress={async () => {
    const restored = await restorePurchases();
    if (restored) {
      Alert.alert(t('paywall.restored', 'Restored!'), t('paywall.restored_msg', 'Your subscription has been restored.'));
    } else {
      Alert.alert(t('settings.no_purchases', 'No active subscriptions found to restore.'));
    }
  }}
>
  <Ionicons name="refresh-outline" size={20} color={colors.text} />
  <Text style={{ flex: 1, fontSize: 15, color: colors.text, marginLeft: 12 }}>
    {t('settings.restore_purchases', 'Restore Purchases')}
  </Text>
</TouchableOpacity>
```

- [ ] **Step 4: Add i18n keys**

Add to en.json and ru.json (others use fallbacks):
```json
"manage_subscription": "Manage Subscription",
"restore_purchases": "Restore Purchases",
"no_purchases": "No active subscriptions found to restore.",
"manage_sub_web": "Visit the web app to manage your subscription."
```

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/settings.tsx" src/locales/
git commit -m "feat: add Manage Subscription and Restore Purchases to Settings"
```

---

## Task 7: Verify build and test

- [ ] **Step 1: TypeScript check mobile**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
npx tsc --noEmit
```

- [ ] **Step 2: Run mobile tests**

```bash
npm test
```

- [ ] **Step 3: TypeScript check backend**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npx tsc --noEmit
```

- [ ] **Step 4: Run backend tests**

```bash
npm test
```

- [ ] **Step 5: Fix any issues and commit**
