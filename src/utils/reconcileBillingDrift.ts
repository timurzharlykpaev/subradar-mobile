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

    const info = await Purchases.getCustomerInfo();
    const active = info?.entitlements?.active ?? {};
    const rcActive = Object.keys(active).length > 0;
    if (rcActive) return { ran: false };

    console.log(
      '[BillingDrift] RC entitlements empty but backend reports paid plan; running reconcile',
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
