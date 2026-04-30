import { billingApi } from '../api/billing';

let Purchases: any = null;
try {
  const rc = require('react-native-purchases');
  Purchases = rc.default || rc;
} catch {}

/**
 * Detect and recover from RC ↔ backend drift. The classic shape:
 *
 *   RC `customerInfo.entitlements.active = {}`        ← user has nothing
 *   `/billing/me effective.plan = 'organization'`      ← backend disagrees
 *
 * Most often caused by a lost EXPIRATION webhook or by a manual / legacy
 * plan grant that predates the RC integration. We ask the backend to
 * verify against RC and reset state when RC indeed has nothing active.
 *
 * Returns whether a reconcile was issued so callers can decide if the
 * billing query needs to be invalidated (avoids a refetch on the no-op
 * path, which is the common case).
 */
export async function reconcileBillingDrift(): Promise<{
  ran: boolean;
  action?: 'noop' | 'cancel_at_period_end' | 'downgraded';
}> {
  try {
    const meRes = await billingApi.getMe();
    const me = meRes?.data;
    if (!me) return { ran: false };

    // Only RC is in scope on mobile. If backend doesn't think the user has
    // their own paid plan there's nothing to reconcile (team members get
    // their plan from the owner, not from RC entitlements).
    const backendPaid =
      me.effective.plan !== 'free' && me.ownership.hasOwnPaidPlan;
    if (!backendPaid) return { ran: false };

    if (!Purchases || typeof Purchases.getCustomerInfo !== 'function') {
      return { ran: false };
    }

    // Force a fresh RC snapshot before checking — without this we read the
    // SDK's stale in-memory cache and miss recent cancellations / expirations.
    try {
      if (typeof Purchases.invalidateCustomerInfoCache === 'function') {
        await Purchases.invalidateCustomerInfoCache();
      }
    } catch {}

    const info = await Purchases.getCustomerInfo();
    const active = info?.entitlements?.active ?? {};
    const rcActive = Object.keys(active).length > 0;

    // Match the active entitlement to the backend's current plan: org →
    // team*, pro → pro/premium*. Only this entitlement's renewal status
    // counts — iterating ALL subscriptions in subsMap previously tripped
    // on a user's historical cancelled Pro and falsely flagged a
    // freshly-purchased Team as pending cancel.
    const subsMap = (info as any)?.subscriptionsByProductIdentifier;
    const tierTokens =
      me.effective.plan === 'organization'
        ? ['team', 'org']
        : me.effective.plan === 'pro'
          ? ['pro', 'premium']
          : [];
    let currentWillRenew: boolean | undefined;
    if (rcActive && tierTokens.length > 0 && subsMap && typeof subsMap === 'object') {
      const currentEnt = Object.entries(active).find(([name]) =>
        tierTokens.some((tok) => name.toLowerCase().includes(tok)),
      );
      const currentProductId = (currentEnt?.[1] as any)?.productIdentifier;
      if (currentProductId && subsMap[currentProductId]) {
        const wr = subsMap[currentProductId].willRenew;
        if (typeof wr === 'boolean') currentWillRenew = wr;
      }
    }

    // Drift can flow in BOTH directions:
    //   (a) backend thinks user is paid but RC has nothing → lost
    //       EXPIRATION webhook, downgrade to free.
    //   (b) backend thinks `active` but matching RC sub is not renewing
    //       → lost CANCELLATION webhook, flip cancel_at_period_end.
    //   (c) backend thinks `cancel_at_period_end` but matching RC sub IS
    //       renewing → lost UNCANCELLATION webhook (Apple lets users
    //       undo cancel from Settings → Resubscribe). Without this case
    //       the user sees an expiration banner forever, since reconcile
    //       only ever previously fired in directions a/b.
    let driftReason: 'no_rc' | 'should_cancel' | 'should_uncancel' | null = null;
    if (!rcActive) {
      driftReason = 'no_rc';
    } else if (me.effective.state === 'active' && currentWillRenew === false) {
      driftReason = 'should_cancel';
    } else if (
      me.effective.state === 'cancel_at_period_end' &&
      currentWillRenew === true
    ) {
      driftReason = 'should_uncancel';
    }
    if (!driftReason) return { ran: false };

    console.log(
      '[BillingDrift] drift detected (%s, backendState=%s, willRenew=%s); running reconcile',
      driftReason,
      me.effective.state,
      currentWillRenew,
    );
    const res = await billingApi.reconcile();
    const action = res?.data?.action ?? 'noop';
    console.log('[BillingDrift] reconcile result:', action, res?.data?.reason);
    return { ran: action !== 'noop', action };
  } catch (e: any) {
    console.warn('[BillingDrift] check failed:', e?.message);
    return { ran: false };
  }
}
