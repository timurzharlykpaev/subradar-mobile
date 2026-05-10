import { billingApi } from '../api/billing';

let Purchases: any = null;
try {
  const rc = require('react-native-purchases');
  Purchases = rc.default || rc;
} catch {}

type DriftResult = {
  ran: boolean;
  // 'upgraded' added when backend infers a fresh INITIAL_PURCHASE /
  // PRODUCT_CHANGE / RENEWAL from RC (e.g. user re-subscribed after grace
  // or upgraded mid-cycle). Old clients only check `ran` so this is safe.
  action?: 'noop' | 'cancel_at_period_end' | 'downgraded' | 'upgraded';
};

// Throttle the auto-fire callers (cold start, AppState foreground, screen
// mounts, pull-to-refresh) so a heavy navigation session — or persistent
// drift the server can't yet resolve — doesn't blast `/billing/reconcile`
// past the server-side throttle (429 ThrottlerException). One reconcile
// per ~30s is enough to converge real drift without hammering.
const COOLDOWN_MS = 30_000;

// When the server actually says we're throttled, back off long enough for
// its rate-limit window to fully reset. Anything shorter risks immediately
// re-tripping on the next AppState transition.
const RATE_LIMITED_COOLDOWN_MS = 5 * 60_000;

let cooldownUntil = 0;
let inFlight: Promise<DriftResult> | null = null;

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
 *
 * Concurrency-safe: if a check is already in flight, callers share the
 * same promise. After completion a short cooldown prevents the 429 storm
 * we hit in 1.3.22 when 4+ surfaces (cold start, AppState foreground,
 * settings mount, plan mount, pull-to-refresh × 2) auto-fire in rapid
 * succession.
 */
export async function reconcileBillingDrift(): Promise<DriftResult> {
  if (inFlight) return inFlight;
  if (Date.now() < cooldownUntil) return { ran: false };

  inFlight = runReconcileBillingDrift().finally(() => {
    inFlight = null;
    // Math.max so a 429-bumped 5-min cooldown isn't shortened back to 30s.
    cooldownUntil = Math.max(cooldownUntil, Date.now() + COOLDOWN_MS);
  });
  return inFlight;
}

/**
 * Test-only escape hatch. Lets the unit tests reset module-level cooldown
 * state between cases without forcing a full module re-import.
 */
export function __resetReconcileBillingDriftForTests(): void {
  cooldownUntil = 0;
  inFlight = null;
}

async function runReconcileBillingDrift(): Promise<DriftResult> {
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

    // Determine which plan tier RC is actually advertising right now.
    // Used to detect "backend thinks Pro, RC has only Team" — the most
    // common Sandbox post-replay drift the previous reasons missed.
    const rcHasTeam = Object.keys(active).some((k) => /team|org/i.test(k));
    const rcHasPro = Object.keys(active).some((k) =>
      /pro|premium/i.test(k) && !/team|org/i.test(k),
    );
    const rcTier: 'organization' | 'pro' | 'free' = rcHasTeam
      ? 'organization'
      : rcHasPro
        ? 'pro'
        : 'free';

    // Drift can flow in several directions:
    //   (a) backend thinks user is paid but RC has nothing → lost
    //       EXPIRATION webhook, downgrade to free.
    //   (b) backend thinks `active` but matching RC sub is not renewing
    //       → lost CANCELLATION webhook, flip cancel_at_period_end.
    //   (c) backend thinks `cancel_at_period_end` but matching RC sub IS
    //       renewing → lost UNCANCELLATION webhook (Apple lets users
    //       undo cancel from Settings → Resubscribe). Without this case
    //       the user sees an expiration banner forever, since reconcile
    //       only ever previously fired in directions a/b.
    //   (d) backend's effective plan disagrees with RC's active tier
    //       (e.g. backend says Pro/grace_pro but RC has only a Team
    //       entitlement active). Apple is the source of truth — we
    //       force a reconcile so backend re-reads RC and converges.
    //       This is the case the user hit in sandbox: Pro lifecycle
    //       lingered while a freshly-replayed Team became the only
    //       active entitlement on the same Apple ID.
    let driftReason:
      | 'no_rc'
      | 'should_cancel'
      | 'should_uncancel'
      | 'plan_mismatch'
      | null = null;
    if (!rcActive) {
      driftReason = 'no_rc';
    } else if (rcTier !== 'free' && rcTier !== me.effective.plan) {
      driftReason = 'plan_mismatch';
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
    let res;
    try {
      res = await billingApi.reconcile();
    } catch (e: any) {
      // Server's per-user throttle bucket is full — back off long enough
      // for its window to reset. Without this we'd retry on the next
      // AppState transition (often <30s away) and immediately re-trip.
      if (e?.response?.status === 429) {
        cooldownUntil = Date.now() + RATE_LIMITED_COOLDOWN_MS;
        console.warn('[BillingDrift] reconcile rate-limited; backing off 5min');
        return { ran: false };
      }
      throw e;
    }
    const action = res?.data?.action ?? 'noop';
    console.log('[BillingDrift] reconcile result:', action, res?.data?.reason);
    return { ran: action !== 'noop', action };
  } catch (e: any) {
    console.warn('[BillingDrift] check failed:', e?.message);
    return { ran: false };
  }
}
