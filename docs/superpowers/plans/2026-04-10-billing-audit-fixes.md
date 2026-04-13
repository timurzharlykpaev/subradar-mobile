# Billing Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all CRITICAL and HIGH issues from the billing/subscriptions audit across mobile and backend repos.

**Architecture:** Two repos modified in parallel. Backend fixes go first (security, data integrity), then mobile fixes (SDK integration, UI sync). Each task is atomic and independently deployable.

**Tech Stack:** NestJS (backend), React Native + Expo (mobile), RevenueCat SDK, TanStack Query v5, TypeORM

**Repos:**
- Backend: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend`
- Mobile: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile`

---

## Task 1: Backend — Add `billingPeriod` and `downgradedAt` to ALLOWED_KEYS

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/users/users.service.ts:48-55`

- [ ] **Step 1: Add missing keys to whitelist**

```typescript
// users.service.ts, line 48-55 — replace the ALLOWED_KEYS Set:
    const ALLOWED_KEYS = new Set([
      'name', 'avatarUrl', 'fcmToken', 'refreshToken', 'magicLinkToken', 'magicLinkExpiry',
      'lemonSqueezyCustomerId', 'plan', 'billingSource', 'billingPeriod', 'trialUsed', 'trialStartDate', 'trialEndDate',
      'aiRequestsUsed', 'aiRequestsMonth', 'proInviteeEmail', 'isActive',
      'timezone', 'locale', 'country', 'defaultCurrency', 'dateFormat',
      'onboardingCompleted', 'notificationsEnabled', 'emailNotifications', 'reminderDaysBefore',
      'cancelAtPeriodEnd', 'currentPeriodEnd', 'status', 'downgradedAt', 'weeklyDigestEnabled',
    ]);
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add src/users/users.service.ts
git commit -m "fix(billing): add billingPeriod, downgradedAt, weeklyDigestEnabled to update whitelist"
```

---

## Task 2: Backend — Fix RevenueCat webhook auth normalization

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/billing/billing.controller.ts:48-68`

- [ ] **Step 1: Fix the auth comparison to use canonical form**

Replace lines 48-68:
```typescript
  @Post('revenuecat-webhook')
  async revenuecatWebhook(
    @Headers('authorization') authorization: string,
    @Body() body: any,
  ) {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (!secret || !authorization) {
      throw new BadRequestException('Invalid webhook authorization');
    }

    // Always compare the bare token value (strip Bearer prefix if present)
    const incoming = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : authorization;
    const incomingBuf = Buffer.from(incoming);
    const secretBuf = Buffer.from(secret);
    if (incomingBuf.length !== secretBuf.length || !timingSafeEqual(incomingBuf, secretBuf)) {
      throw new BadRequestException('Invalid webhook authorization');
    }
    await this.billingService.handleRevenueCatWebhook(body);
    return { received: true };
  }
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add src/billing/billing.controller.ts
git commit -m "fix(billing): normalize RC webhook auth to canonical form — compare bare secret only"
```

---

## Task 3: Backend — Fix Lemon Squeezy webhook rawBody capture

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/main.ts:13-15`

- [ ] **Step 1: Add raw body capture for webhook route**

After line 11 (`const app = ...`) and before the existing bodyParser lines, add:
```typescript
  // Capture raw body for Lemon Squeezy webhook HMAC verification
  // Must be registered BEFORE the general JSON bodyParser
  app.use('/api/v1/billing/webhook', bodyParser.json({
    limit: '1mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add src/main.ts
git commit -m "fix(billing): capture raw body for LS webhook HMAC verification"
```

---

## Task 4: Backend — Add `syncRevenueCat` server-side verification

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/billing/billing.service.ts:348-376`

- [ ] **Step 1: Add RC REST API verification before trusting productId**

Replace `syncRevenueCat` method (lines 348-376):
```typescript
  async syncRevenueCat(userId: string, productId: string): Promise<void> {
    // Verify the user actually has an active entitlement via RevenueCat REST API
    const rcApiKey = this.cfg.get('REVENUECAT_API_KEY', '');
    if (rcApiKey) {
      try {
        const res = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${userId}`,
          { headers: { Authorization: `Bearer ${rcApiKey}` } },
        );
        if (res.ok) {
          const data = (await res.json()) as any;
          const entitlements = data?.subscriber?.entitlements ?? {};
          const hasActive = Object.values(entitlements).some(
            (e: any) => e.expires_date === null || new Date(e.expires_date) > new Date(),
          );
          if (!hasActive) {
            this.logger.warn(`syncRevenueCat: user ${userId} has no active RC entitlement — rejecting sync`);
            return;
          }
        }
      } catch (e) {
        // If RC API is down, fall through to trust the client (better UX than blocking purchase)
        this.logger.warn(`syncRevenueCat: RC API check failed, proceeding with client data: ${e}`);
      }
    }

    // Try exact match first, then partial match for flexibility
    let plan = this.RC_PRODUCT_TO_PLAN[productId];

    if (!plan) {
      const lower = productId.toLowerCase();
      if (lower.includes('team') || lower.includes('org')) {
        plan = 'organization';
      } else if (lower.includes('pro') || lower.includes('premium')) {
        plan = 'pro';
      } else {
        this.logger.warn(`syncRevenueCat: unknown productId "${productId}", defaulting to pro`);
        plan = 'pro';
      }
    }

    const billingPeriod = this.extractBillingPeriod(productId);
    const user = await this.usersService.findById(userId);
    user.plan = plan;
    user.billingPeriod = billingPeriod;
    user.billingSource = 'revenuecat';
    user.cancelAtPeriodEnd = false;
    user.currentPeriodEnd = null;
    await this.usersService.save(user);
    this.logger.log(`syncRevenueCat: user ${userId} → plan ${plan} (${billingPeriod}, product: ${productId})`);
  }
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add src/billing/billing.service.ts
git commit -m "fix(billing): verify RC entitlement server-side before syncing productId"
```

---

## Task 5: Backend — Handle UNCANCELLATION webhook + fix cancelSubscription trial/RC collision

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/billing/billing.service.ts`

- [ ] **Step 1: Add UNCANCELLATION handler after EXPIRATION case (around line 192)**

Insert before the `case 'BILLING_ISSUE':` block:
```typescript
      case 'UNCANCELLATION': {
        user.cancelAtPeriodEnd = false;
        user.currentPeriodEnd = null;
        await this.usersService.save(user);
        this.logger.log(`RevenueCat: UNCANCELLATION — user ${appUserId}, subscription restored`);
        break;
      }
```

- [ ] **Step 2: Fix cancelSubscription trial branch to check billingSource (line 429)**

Replace the trial cancellation block (lines 428-437):
```typescript
    // Cancel trial: clear trial dates, reset plan to free
    // Only if not already paying via RevenueCat (trial superseded by real purchase)
    if (user.trialEndDate && new Date(user.trialEndDate) > new Date() && user.billingSource !== 'revenuecat') {
      await this.usersService.update(userId, {
        plan: 'free',
        trialEndDate: undefined as any,
        billingSource: undefined as any,
      });
      this.logger.log(`cancelSubscription: trial cancelled for user ${userId}`);
      return;
    }
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add src/billing/billing.service.ts
git commit -m "fix(billing): handle UNCANCELLATION webhook, guard trial cancel against RC subscriptions"
```

---

## Task 6: Backend — Add `getEffectivePlan` helper for trial expiry enforcement

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/billing/billing.service.ts`

- [ ] **Step 1: Add getEffectivePlan method (after extractBillingPeriod, around line 46)**

```typescript
  /**
   * Returns the effective plan considering trial expiry.
   * Database may have plan='pro' for expired trials — this returns 'free' in that case.
   */
  getEffectivePlan(user: any): string {
    if (user.plan === 'free') return 'free';
    // If user has RC or LS billing source, trust the plan field
    if (user.billingSource) return user.plan;
    // If trialing and trial still active, trust the plan
    if (user.trialEndDate && new Date(user.trialEndDate) > new Date()) return user.plan;
    // If trial expired and no billing source — effective plan is free
    if (user.trialUsed && !user.billingSource) return 'free';
    return user.plan;
  }
```

- [ ] **Step 2: Use getEffectivePlan in consumeAiRequest (line 331)**

Replace `const planConfig = PLANS[user.plan] ?? PLANS.free;` with:
```typescript
    const effectivePlan = this.getEffectivePlan(user);
    const planConfig = PLANS[effectivePlan] ?? PLANS.free;
```

- [ ] **Step 3: Use getEffectivePlan in getBillingInfo (line 380)**

Replace `const planConfig = PLANS[user.plan] ?? PLANS.free;` with:
```typescript
    const effectivePlan = this.getEffectivePlan(user);
    const planConfig = PLANS[effectivePlan] ?? PLANS.free;
```

And update the return (line 408) to use effectivePlan:
```typescript
    return {
      plan: effectivePlan,
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add src/billing/billing.service.ts
git commit -m "fix(billing): add getEffectivePlan helper — expired trials enforced as free"
```

---

## Task 7: Backend — Fix downgradeExpiredTrials cron to clear billingPeriod

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/subscriptions/trial-checker.cron.ts:170-173`

- [ ] **Step 1: Add billingPeriod: null to the downgrade update**

Replace lines 170-173:
```typescript
        await this.userRepo.update(user.id, {
          plan: 'free',
          trialEndDate: undefined as any,
          billingPeriod: null as any,
        });
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add src/subscriptions/trial-checker.cron.ts
git commit -m "fix(billing): clear billingPeriod when downgrading expired trials"
```

---

## Task 8: Backend — Fix invitee downgrade to check their own billing source

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/billing/billing.service.ts:109-124`

- [ ] **Step 1: Guard invitee downgrade with billingSource check**

Replace the invitee downgrade block inside `subscription_cancelled` (lines 115-120):
```typescript
            if (user.proInviteeEmail) {
              const invitee = await this.usersService.findByEmail(user.proInviteeEmail);
              // Only downgrade invitee if they don't have their own paid subscription
              if (invitee && !invitee.billingSource) {
                await this.usersService.update(invitee.id, { plan: 'free' });
              }
              await this.usersService.update(user.id, { proInviteeEmail: undefined as any });
            }
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add src/billing/billing.service.ts
git commit -m "fix(billing): don't downgrade invitee who has own paid subscription"
```

---

## Task 9: Mobile — Fix `PURCHASES_ERROR_CODE` import and RC logout

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/hooks/useRevenueCat.ts:4-15`
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/app/_layout.tsx:85-86`

- [ ] **Step 1: Fix PURCHASES_ERROR_CODE fallback in useRevenueCat.ts**

Replace lines 4-16:
```typescript
let Purchases: any = null;
let PURCHASES_ERROR_CODE: any = {};
let LOG_LEVEL: any = {};

try {
  const rc = require('react-native-purchases');
  const mod = rc.default || rc;
  // Verify the native module is actually available (not just JS wrapper)
  if (mod && typeof mod.configure === 'function') {
    Purchases = mod;
    // PURCHASES_ERROR_CODE may be on the named export or on the default export
    PURCHASES_ERROR_CODE = rc.PURCHASES_ERROR_CODE ?? mod.PURCHASES_ERROR_CODE ?? {};
    LOG_LEVEL = rc.LOG_LEVEL ?? mod.LOG_LEVEL ?? {};
  }
} catch {
  // Native module not linked (Expo Go, simulator without dev build)
}
```

- [ ] **Step 2: Add RC logout when user signs out in _layout.tsx**

Replace lines 85-86:
```typescript
  useEffect(() => {
    if (!isAuthenticated) {
      // Clean up RevenueCat identity when user signs out
      logoutRevenueCat().catch(() => {});
      return;
    }
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
git add src/hooks/useRevenueCat.ts app/_layout.tsx
git commit -m "fix(rc): fix PURCHASES_ERROR_CODE import fallback, add logoutRevenueCat on sign out"
```

---

## Task 10: Mobile — Fix `restorePurchases` case-insensitive + listener race condition

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/hooks/useRevenueCat.ts`

- [ ] **Step 1: Fix restorePurchases to use case-insensitive check (line 196)**

Replace lines 191-202:
```typescript
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; customerInfo: any | null }> => {
    if (!isAvailable()) return { success: false, customerInfo: null };
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const activeKeys = Object.keys(info?.entitlements?.active ?? {});
      const success = activeKeys.some((k: string) => /^(pro|team)$/i.test(k));
      return { success, customerInfo: info };
    } catch (error: any) {
      Alert.alert('Restore Error', error?.message || 'Unknown error');
      return { success: false, customerInfo: null };
    }
  }, []);
```

- [ ] **Step 2: Fix isTeam to use case-insensitive check (line 156)**

Replace line 156:
```typescript
  const isTeam = activeKeys.some((k: string) => /^team$/i.test(k));
```

- [ ] **Step 3: Fix listener to re-add after configure (lines 116-145)**

Replace the useEffect at lines 116-145:
```typescript
  useEffect(() => {
    mountedRef.current = true;
    let removeListener: (() => void) | null = null;

    const setup = async () => {
      await loadOfferings();

      // Add listener after offerings load (guaranteed configured at this point)
      if (configured && isAvailable()) {
        const listener = (info: any) => {
          try {
            if (mountedRef.current && info) setCustomerInfo(info);
          } catch {}
        };
        try {
          Purchases.addCustomerInfoUpdateListener(listener);
          removeListener = () => {
            try { Purchases.removeCustomerInfoUpdateListener(listener); } catch {}
          };
        } catch (e) {
          console.warn('RevenueCat listener failed:', e);
        }
      }
    };

    setup();

    return () => {
      mountedRef.current = false;
      if (removeListener) removeListener();
    };
  }, [loadOfferings]);
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
git add src/hooks/useRevenueCat.ts
git commit -m "fix(rc): case-insensitive restore/isTeam, fix listener race condition"
```

---

## Task 11: Mobile — Fix `syncAfterCustomerCenter` case-insensitive + null guard

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/app/(tabs)/settings.tsx:68-82`

- [ ] **Step 1: Fix entitlement check to use case-insensitive and add null guard**

Replace the `syncAfterCustomerCenter` function (lines 68-82):
```typescript
  const syncAfterCustomerCenter = useCallback(async () => {
    try {
      if (Purchases && typeof Purchases.getCustomerInfo === 'function') {
        const info = await Purchases.getCustomerInfo();
        const activeKeys = Object.keys(info?.entitlements?.active ?? {});
        const hasProEntitlement = activeKeys.some((k: string) => /^(pro|team)$/i.test(k));
        // If user no longer has Pro entitlement, sync cancellation to backend
        if (!hasProEntitlement && billing?.plan && billing.plan !== 'free') {
          await billingApi.cancel().catch(() => {});
        }
      }
    } catch {}
    // Always refetch billing data to pick up any changes
    await queryClient.invalidateQueries({ queryKey: ['billing'] });
  }, [billing?.plan, queryClient]);
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
git add app/(tabs)/settings.tsx
git commit -m "fix(settings): case-insensitive entitlement check in syncAfterCustomerCenter"
```

---

## Task 12: Mobile — Fix duplicate `@UseGuards` on backend controller (quick cleanup)

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/billing/billing.controller.ts:179-192`

- [ ] **Step 1: Remove duplicate decorators**

Replace lines 179-192:
```typescript
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  async cancelBilling(@Request() req) {
    await this.billingService.cancelSubscription(req.user.id);
    return { message: 'Subscription cancelled' };
  }
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add src/billing/billing.controller.ts
git commit -m "fix(billing): remove duplicate UseGuards/ApiBearerAuth on cancelBilling"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] **Backend type check:** `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npx tsc --noEmit`
- [ ] **Backend tests:** `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend && npm test`
- [ ] **Mobile type check:** `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit`
- [ ] **Mobile tests:** `cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npm test`
- [ ] **Review all changed files with `git diff`**
