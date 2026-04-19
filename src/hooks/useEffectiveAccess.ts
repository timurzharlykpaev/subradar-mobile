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

export function useEffectiveAccess(): EffectiveAccess | null {
  const { data: b, isLoading } = useBillingStatus();
  if (!b) return null;

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
