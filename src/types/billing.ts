/**
 * Billing contract types — mirror the backend `/billing/me` response.
 *
 * This is the single source of truth for billing state on the client.
 * No local computations — all date / grace / flag logic lives on the server.
 */

export type BannerPriority =
  | 'billing_issue'
  | 'grace'
  | 'expiration'
  | 'double_pay'
  | 'annual_upgrade'
  | 'win_back'
  | 'none';

export type Plan = 'free' | 'pro' | 'organization';

export type PlanSource =
  | 'own'
  | 'team'
  | 'trial'
  | 'grace_pro'
  | 'grace_team'
  | 'free';

export type BillingState =
  | 'active'
  | 'cancel_at_period_end'
  | 'billing_issue'
  | 'grace_pro'
  | 'grace_team'
  | 'free';

export type GraceReason = 'team_expired' | 'pro_expired' | null;

export type BillingCycle = 'monthly' | 'yearly' | null;

export interface BillingEffective {
  plan: Plan;
  source: PlanSource;
  state: BillingState;
  billingPeriod: BillingCycle;
}

export interface BillingOwnership {
  hasOwnPaidPlan: boolean;
  isTeamOwner: boolean;
  isTeamMember: boolean;
  teamOwnerId: string | null;
  workspaceId: string | null;
}

export interface BillingDates {
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  graceExpiresAt: string | null;
  graceDaysLeft: number | null;
  trialEndsAt: string | null;
  billingIssueStartedAt: string | null;
}

export interface BillingFlags {
  cancelAtPeriodEnd: boolean;
  hasBillingIssue: boolean;
  trialEligible: boolean;
  shouldShowDoublePay: boolean;
  degradedMode: boolean;
  hiddenSubscriptionsCount: number;
  graceReason: GraceReason;
}

export interface BillingBanner {
  priority: BannerPriority;
  payload: Record<string, unknown>;
}

export interface BillingSubscriptionsLimit {
  used: number;
  limit: number | null;
}

export interface BillingAiRequestsLimit {
  used: number;
  /**
   * `null` means unlimited. Backend source: plans.config.ts `aiRequestsLimit`.
   * UI renders `limit ?? '∞'` — check for null before numeric comparisons.
   */
  limit: number | null;
  resetAt: string;
}

export interface BillingLimits {
  subscriptions: BillingSubscriptionsLimit;
  aiRequests: BillingAiRequestsLimit;
  canCreateOrg: boolean;
  canInvite: boolean;
}

export interface BillingActions {
  canStartTrial: boolean;
  canCancel: boolean;
  canRestore: boolean;
  canUpgradeToYearly: boolean;
  canInviteProFriend: boolean;
}

export interface BillingProductIds {
  monthly: string;
  yearly: string;
}

export interface BillingProducts {
  pro: BillingProductIds;
  team: BillingProductIds;
}

export interface BillingMeResponse {
  effective: BillingEffective;
  ownership: BillingOwnership;
  dates: BillingDates;
  flags: BillingFlags;
  banner: BillingBanner;
  limits: BillingLimits;
  actions: BillingActions;
  products: BillingProducts;
  serverTime: string;
}

export interface TrialStatusResponse {
  trial: {
    endsAt: string;
    plan: string;
    source: string;
    consumed: boolean;
  } | null;
}
