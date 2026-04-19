/**
 * Tests for useEffectiveAccess — a thin synchronous mapper over useBillingStatus().
 *
 * The hook contains no React state of its own: it calls useBillingStatus() and
 * maps the response. That lets us mock useBillingStatus at module load time and
 * invoke useEffectiveAccess as a plain function — no RN renderer needed.
 *
 * We verify:
 *   - returns null while the query is loading (no data yet)
 *   - maps every field of BillingMeResponse to EffectiveAccess correctly
 *   - parses ISO date strings into Date instances
 *   - sets isPro=false for free plan, true for paid
 */
import type { BillingMeResponse } from '../../types/billing';

const mockUseBillingStatus = jest.fn();

jest.mock('../useBilling', () => ({
  useBillingStatus: () => mockUseBillingStatus(),
}));

// Re-import after the mock is set up
import { useEffectiveAccess } from '../useEffectiveAccess';

function fullResponse(overrides: Partial<BillingMeResponse> = {}): BillingMeResponse {
  const base: BillingMeResponse = {
    effective: { plan: 'pro', source: 'own', state: 'active', billingPeriod: 'monthly' },
    ownership: {
      hasOwnPaidPlan: true,
      isTeamOwner: false,
      isTeamMember: false,
      teamOwnerId: null,
      workspaceId: null,
    },
    dates: {
      currentPeriodStart: '2026-04-01T00:00:00.000Z',
      currentPeriodEnd: '2026-05-01T00:00:00.000Z',
      nextPaymentDate: '2026-05-01T00:00:00.000Z',
      graceExpiresAt: null,
      graceDaysLeft: null,
      trialEndsAt: null,
      billingIssueStartedAt: null,
    },
    flags: {
      cancelAtPeriodEnd: false,
      hasBillingIssue: false,
      trialEligible: false,
      shouldShowDoublePay: false,
      degradedMode: false,
      hiddenSubscriptionsCount: 0,
      graceReason: null,
    },
    banner: {
      priority: 'annual_upgrade',
      payload: { plan: 'pro', monthlyPrice: 2.99, yearlyPrice: 23.99 },
    },
    limits: {
      subscriptions: { used: 7, limit: null },
      aiRequests: { used: 12, limit: 200, resetAt: '2026-05-01T00:00:00.000Z' },
      canCreateOrg: false,
      canInvite: true,
    },
    actions: {
      canStartTrial: false,
      canCancel: true,
      canRestore: true,
      canUpgradeToYearly: true,
      canInviteProFriend: true,
    },
    products: {
      pro: { monthly: 'io.subradar.mobile.pro.monthly', yearly: 'io.subradar.mobile.pro.yearly' },
      team: { monthly: 'io.subradar.mobile.team.monthly', yearly: 'io.subradar.mobile.team.yearly' },
    },
    serverTime: '2026-04-19T00:00:00.000Z',
  };
  return { ...base, ...overrides };
}

describe('useEffectiveAccess', () => {
  beforeEach(() => {
    mockUseBillingStatus.mockReset();
  });

  it('returns null while the query is loading (no data)', () => {
    mockUseBillingStatus.mockReturnValue({ data: undefined, isLoading: true });
    expect(useEffectiveAccess()).toBeNull();
  });

  it('returns null when data is undefined even after loading finished (logged-out edge)', () => {
    mockUseBillingStatus.mockReturnValue({ data: undefined, isLoading: false });
    expect(useEffectiveAccess()).toBeNull();
  });

  it('maps every BillingMeResponse field onto EffectiveAccess', () => {
    const response = fullResponse();
    mockUseBillingStatus.mockReturnValue({ data: response, isLoading: false });

    const access = useEffectiveAccess();
    expect(access).not.toBeNull();

    // effective.* flattened onto top level
    expect(access!.plan).toBe('pro');
    expect(access!.source).toBe('own');
    expect(access!.state).toBe('active');
    expect(access!.billingPeriod).toBe('monthly');

    // derived flags
    expect(access!.isPro).toBe(true);

    // ownership passed through
    expect(access!.isTeamOwner).toBe(false);
    expect(access!.isTeamMember).toBe(false);
    expect(access!.hasOwnPaidPlan).toBe(true);

    // ISO strings → Date instances
    expect(access!.currentPeriodStart).toBeInstanceOf(Date);
    expect(access!.currentPeriodStart!.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(access!.currentPeriodEnd).toBeInstanceOf(Date);
    expect(access!.currentPeriodEnd!.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(access!.nextPaymentDate).toBeInstanceOf(Date);
    expect(access!.nextPaymentDate!.toISOString()).toBe('2026-05-01T00:00:00.000Z');

    // nullable dates stay null when backend sends null
    expect(access!.graceExpiresAt).toBeNull();
    expect(access!.trialEndsAt).toBeNull();
    expect(access!.billingIssueStartedAt).toBeNull();
    expect(access!.graceDaysLeft).toBeNull();

    // nested objects are passed through
    expect(access!.banner.priority).toBe('annual_upgrade');
    expect(access!.banner.payload).toEqual({
      plan: 'pro',
      monthlyPrice: 2.99,
      yearlyPrice: 23.99,
    });
    expect(access!.flags).toEqual(response.flags);
    expect(access!.limits).toEqual(response.limits);
    expect(access!.actions).toEqual(response.actions);
    expect(access!.products).toEqual(response.products);

    // isLoading echoed back
    expect(access!.isLoading).toBe(false);
  });

  it('returns isPro=false for a free plan', () => {
    const response = fullResponse({
      effective: { plan: 'free', source: 'free', state: 'free', billingPeriod: null },
      ownership: {
        hasOwnPaidPlan: false,
        isTeamOwner: false,
        isTeamMember: false,
        teamOwnerId: null,
        workspaceId: null,
      },
      banner: { priority: 'none', payload: {} },
    });
    mockUseBillingStatus.mockReturnValue({ data: response, isLoading: false });

    const access = useEffectiveAccess();
    expect(access!.plan).toBe('free');
    expect(access!.isPro).toBe(false);
    expect(access!.banner.priority).toBe('none');
    expect(access!.billingPeriod).toBeNull();
  });

  it('returns isPro=true for pro plan from team source', () => {
    const response = fullResponse({
      effective: { plan: 'pro', source: 'team', state: 'active', billingPeriod: 'yearly' },
      ownership: {
        hasOwnPaidPlan: false,
        isTeamOwner: false,
        isTeamMember: true,
        teamOwnerId: 'owner-1',
        workspaceId: 'ws-1',
      },
    });
    mockUseBillingStatus.mockReturnValue({ data: response, isLoading: false });

    const access = useEffectiveAccess();
    expect(access!.isPro).toBe(true);
    expect(access!.isTeamMember).toBe(true);
    expect(access!.source).toBe('team');
  });

  it('parses grace dates when the backend sends them', () => {
    const response = fullResponse({
      effective: { plan: 'pro', source: 'grace_pro', state: 'grace_pro', billingPeriod: 'monthly' },
      dates: {
        currentPeriodStart: null,
        currentPeriodEnd: null,
        nextPaymentDate: null,
        graceExpiresAt: '2026-04-22T00:00:00.000Z',
        graceDaysLeft: 3,
        trialEndsAt: null,
        billingIssueStartedAt: null,
      },
      flags: {
        cancelAtPeriodEnd: false,
        hasBillingIssue: false,
        trialEligible: false,
        shouldShowDoublePay: false,
        degradedMode: false,
        hiddenSubscriptionsCount: 0,
        graceReason: 'pro_expired',
      },
      banner: { priority: 'grace', payload: { daysLeft: 3, reason: 'pro_expired' } },
    });
    mockUseBillingStatus.mockReturnValue({ data: response, isLoading: false });

    const access = useEffectiveAccess();
    expect(access!.graceDaysLeft).toBe(3);
    expect(access!.graceReason).toBe('pro_expired');
    expect(access!.graceExpiresAt).toBeInstanceOf(Date);
    expect(access!.graceExpiresAt!.toISOString()).toBe('2026-04-22T00:00:00.000Z');
  });
});
