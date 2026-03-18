export type BillingPeriod = 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY' | 'LIFETIME' | 'ONE_TIME';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'TRIAL';
export type Category = 'STREAMING' | 'AI_SERVICES' | 'INFRASTRUCTURE' | 'MUSIC' | 'GAMING' | 'PRODUCTIVITY' | 'HEALTH' | 'NEWS' | 'OTHER';
export type CardBrand = 'VISA' | 'MC' | 'AMEX' | 'MIR' | 'OTHER';
export type SourceType = 'MANUAL' | 'AI_VOICE' | 'AI_SCREENSHOT' | 'AI_TEXT';
export type ReportType = 'SUMMARY' | 'DETAILED' | 'TAX' | 'AUDIT';
export type ReportStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
export type Theme = 'light' | 'dark' | 'system';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'KZT' | 'RUB' | 'UAH' | 'TRY';

export interface Subscription {
  id: string;
  name: string;
  category: Category;
  amount: number;
  currency: string;
  billingPeriod: BillingPeriod;
  billingDay?: number;
  nextPaymentDate?: string;
  startDate?: string;
  status: SubscriptionStatus;
  currentPlan?: string;
  availablePlans?: Record<string, unknown>[];
  trialEndDate?: string;
  cancelledAt?: string;
  paymentCardId?: string;
  paymentCard?: PaymentCard;
  iconUrl?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  managePlanUrl?: string;
  notes?: string;
  isBusinessExpense?: boolean;
  taxCategory?: string;
  reminderEnabled?: boolean;
  reminderDaysBefore?: number[];
  addedVia?: SourceType;
  aiMetadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentCard {
  id: string;
  nickname: string;
  last4: string;
  brand: CardBrand;
  color: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  defaultCurrency?: string;
  locale?: string;
  timezone?: string;
  dateFormat?: string;
  country?: string;
  onboardingCompleted?: boolean;
  notificationsEnabled?: boolean;
}

export interface Receipt {
  id: string;
  subscriptionId?: string;
  filename: string;
  fileUrl: string;
  amount?: number;
  currency?: string;
  receiptDate?: string;
  uploadedAt: string;
}

export interface Report {
  id: string;
  type: ReportType;
  status: ReportStatus;
  from: string;
  to: string;
  fileUrl?: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalMonthly: number;
  totalYearly: number;
  renewingSoon: number;
  savingsPossible?: number;
  byCategory: { category: string; amount: number }[];
  monthlyTrend: { month: string; amount: number }[];
  topSubscriptions: Subscription[];
}

export interface BillingPlanFeature {
  key: string;
  value: number | boolean | null;
  label: string;
}

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string | null;
  trialDays?: number;
  variantId?: string;
  features: BillingPlanFeature[];
}

export interface BillingStatus {
  plan: 'free' | 'pro' | 'organization';
  status: 'active' | 'cancelled' | 'trialing';
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  trialUsed: boolean;
  trialDaysLeft?: number | null;
  subscriptionCount: number;
  subscriptionLimit: number | null;
  aiRequestsUsed: number;
  aiRequestsLimit: number | null;
}

export interface AISearchResult {
  name: string;
  category: Category;
  plans: { name: string; price: number; currency: string; period: BillingPeriod }[];
  serviceUrl?: string;
  iconUrl?: string;
}
