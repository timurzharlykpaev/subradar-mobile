import { useBillingStatus } from './useBilling';
import type {
  BillingActions,
  BillingBanner,
  BillingEffective,
  BillingFlags,
  BillingLimits,
  BillingProducts,
  GraceReason,
} from '../types/billing';

/**
 * Thin wrapper over `/billing/me`.
 *
 * All fields are derived directly from the backend response — no local
 * grace / flag / date computations. Date strings are parsed into `Date`
 * instances here for ergonomic consumption.
 *
 * Returns `null` while the query has no data (initial load or after logout).
 */
export interface EffectiveAccess {
  plan: BillingEffective['plan'];
  source: BillingEffective['source'];
  state: BillingEffective['state'];
  billingPeriod: BillingEffective['billingPeriod'];

  isPro: boolean;
  isTeamOwner: boolean;
  isTeamMember: boolean;
  hasOwnPaidPlan: boolean;

  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextPaymentDate: Date | null;
  graceExpiresAt: Date | null;
  graceDaysLeft: number | null;
  graceReason: GraceReason;
  trialEndsAt: Date | null;
  billingIssueStartedAt: Date | null;

  flags: BillingFlags;
  limits: BillingLimits;
  actions: BillingActions;
  banner: BillingBanner;
  products: BillingProducts;

  isLoading: boolean;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Identity cache keyed by the BillingMeResponse object. TanStack Query
// does structural sharing — when the server response is byte-equal, the
// returned `data` object keeps the same reference across refetches. Map
// that reference to a single mapped EffectiveAccess so consumers
// (AddSubscriptionSheet, BannerRenderer, AIWizard, …) don't see a fresh
// object — and a fresh chain of re-renders — on every render.
//
// Implemented with a module-level WeakMap instead of `useMemo` so the
// hook stays callable as a plain function in unit tests (where there is
// no React render context). WeakMap also lets us share the result
// across multiple `useEffectiveAccess()` call sites in different
// components — they all get the same reference.
const accessCache = new WeakMap<object, EffectiveAccess>();

function mapAccess(b: NonNullable<ReturnType<typeof useBillingStatus>['data']>, isLoading: boolean): EffectiveAccess {
  return {
    plan: b.effective.plan,
    source: b.effective.source,
    state: b.effective.state,
    billingPeriod: b.effective.billingPeriod,

    isPro: b.effective.plan !== 'free',
    isTeamOwner: b.ownership.isTeamOwner,
    isTeamMember: b.ownership.isTeamMember,
    hasOwnPaidPlan: b.ownership.hasOwnPaidPlan,

    currentPeriodStart: toDate(b.dates.currentPeriodStart),
    currentPeriodEnd: toDate(b.dates.currentPeriodEnd),
    nextPaymentDate: toDate(b.dates.nextPaymentDate),
    graceExpiresAt: toDate(b.dates.graceExpiresAt),
    graceDaysLeft: b.dates.graceDaysLeft,
    graceReason: b.flags.graceReason,
    trialEndsAt: toDate(b.dates.trialEndsAt),
    billingIssueStartedAt: toDate(b.dates.billingIssueStartedAt),

    flags: b.flags,
    limits: b.limits,
    actions: b.actions,
    banner: b.banner,
    products: b.products,

    isLoading,
  };
}

export function useEffectiveAccess(): EffectiveAccess | null {
  const { data: b, isLoading } = useBillingStatus();
  if (!b) return null;

  const cached = accessCache.get(b);
  if (cached && cached.isLoading === isLoading) return cached;

  const result = mapAccess(b, isLoading);
  accessCache.set(b, result);
  return result;
}
