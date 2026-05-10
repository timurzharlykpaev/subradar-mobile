/**
 * Tests for reconcileBillingDrift's concurrency/cooldown wrapper.
 *
 * The interesting logic is the dedup/back-off envelope around the actual
 * RC ↔ backend comparison: it's what stops 4+ auto-fire surfaces from
 * stampeding the rate-limited `/billing/reconcile` endpoint (the 429
 * storm we hit in 1.3.22).
 *
 * Strategy:
 *   - mock `react-native-purchases` so the module-load `require()` succeeds
 *     and getCustomerInfo returns RC data that flags drift
 *   - mock `../../api/billing` so we can assert how often `reconcile()` was
 *     actually called and inject 429 responses
 *   - reset module state between cases via the test-only escape hatch
 */

type ReconcileFn = () => Promise<{ data: { action: string; reason: string } }>;
type GetMeFn = () => Promise<{ data: any }>;

function setupMocks(opts: {
  reconcile?: ReconcileFn;
  getMe?: GetMeFn;
  customerInfo?: any;
} = {}) {
  jest.resetModules();

  const reconcile = jest.fn(
    opts.reconcile ??
      (async () => ({ data: { action: 'downgraded', reason: 'rc_inactive' } })),
  );
  const getMe = jest.fn(
    opts.getMe ??
      (async () => ({
        data: {
          effective: { plan: 'organization', state: 'active' },
          ownership: { hasOwnPaidPlan: true },
        },
      })),
  );

  jest.doMock('../../api/billing', () => ({
    billingApi: { getMe, reconcile },
  }));

  // Drift trigger: backend says organization/active but RC reports nothing
  // active → driftReason = 'no_rc'.
  const customerInfo = opts.customerInfo ?? {
    entitlements: { active: {} },
    subscriptionsByProductIdentifier: {},
  };
  jest.doMock(
    'react-native-purchases',
    () => ({
      __esModule: true,
      default: {
        getCustomerInfo: jest.fn().mockResolvedValue(customerInfo),
        invalidateCustomerInfoCache: jest.fn().mockResolvedValue(undefined),
      },
    }),
    { virtual: true },
  );

  return { reconcile, getMe };
}

describe('reconcileBillingDrift dedup + cooldown', () => {
  let nowSpy: jest.SpyInstance | null = null;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    nowSpy?.mockRestore();
    nowSpy = null;
  });

  it('dedupes concurrent in-flight calls into a single reconcile', async () => {
    const { reconcile } = setupMocks();
    const mod = await import('../reconcileBillingDrift');
    mod.__resetReconcileBillingDriftForTests();

    // Fire 5 concurrent calls — every screen mount + AppState handler racing
    // at startup. Wrapper must collapse them into a single backend call.
    const results = await Promise.all([
      mod.reconcileBillingDrift(),
      mod.reconcileBillingDrift(),
      mod.reconcileBillingDrift(),
      mod.reconcileBillingDrift(),
      mod.reconcileBillingDrift(),
    ]);

    expect(reconcile).toHaveBeenCalledTimes(1);
    // All 5 callers see the same drift result (so each can decide to invalidate).
    for (const r of results) {
      expect(r.ran).toBe(true);
      expect(r.action).toBe('downgraded');
    }
  });

  it('returns {ran:false} on subsequent calls within 30s cooldown', async () => {
    let now = 1_000_000;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

    const { reconcile } = setupMocks();
    const mod = await import('../reconcileBillingDrift');
    mod.__resetReconcileBillingDriftForTests();

    const first = await mod.reconcileBillingDrift();
    expect(first.ran).toBe(true);
    expect(reconcile).toHaveBeenCalledTimes(1);

    // 10s later — still within 30s cooldown. Should short-circuit.
    now += 10_000;
    const second = await mod.reconcileBillingDrift();
    expect(second).toEqual({ ran: false });
    expect(reconcile).toHaveBeenCalledTimes(1);

    // 25s later (35s total since first) — past cooldown. Fires again.
    now += 25_000;
    const third = await mod.reconcileBillingDrift();
    expect(third.ran).toBe(true);
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it('extends cooldown to 5min when reconcile returns 429', async () => {
    let now = 5_000_000;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

    const throttled = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429 },
    });
    const { reconcile } = setupMocks({
      reconcile: jest.fn().mockRejectedValue(throttled),
    });
    const mod = await import('../reconcileBillingDrift');
    mod.__resetReconcileBillingDriftForTests();

    const first = await mod.reconcileBillingDrift();
    // 429 must surface as a no-op to the caller — never a thrown rejection,
    // since callers like AppState use it best-effort.
    expect(first).toEqual({ ran: false });
    expect(reconcile).toHaveBeenCalledTimes(1);

    // Just past the normal 30s cooldown — but the 429 back-off should
    // still suppress this call (5min, not 30s).
    now += 60_000;
    const second = await mod.reconcileBillingDrift();
    expect(second).toEqual({ ran: false });
    expect(reconcile).toHaveBeenCalledTimes(1);

    // Past the 5min back-off — fires again.
    now += 5 * 60_000;
    const third = await mod.reconcileBillingDrift();
    expect(third).toEqual({ ran: false });
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it('skips reconcile entirely when backend reports no paid plan (no cooldown burned)', async () => {
    const { reconcile, getMe } = setupMocks({
      getMe: async () => ({
        data: {
          effective: { plan: 'free', state: 'active' },
          ownership: { hasOwnPaidPlan: false },
        },
      }),
    });
    const mod = await import('../reconcileBillingDrift');
    mod.__resetReconcileBillingDriftForTests();

    const r = await mod.reconcileBillingDrift();
    expect(r).toEqual({ ran: false });
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(reconcile).not.toHaveBeenCalled();
  });
});
