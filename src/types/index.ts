export type BillingPeriod = 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY' | 'LIFETIME' | 'ONE_TIME';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'TRIAL' | 'ARCHIVED';
export type Category = 'STREAMING' | 'AI_SERVICES' | 'INFRASTRUCTURE' | 'MUSIC' | 'GAMING' | 'PRODUCTIVITY' | 'HEALTH' | 'NEWS' | 'DEVELOPER' | 'EDUCATION' | 'FINANCE' | 'DESIGN' | 'SECURITY' | 'SPORT' | 'BUSINESS' | 'OTHER';
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
  reminderDaysBefore?: number[] | null;
  color?: string | null;
  tags?: string[] | null;
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

// Analysis types
export type AnalysisJobStatus = 'QUEUED' | 'COLLECTING' | 'NORMALIZING' | 'LOOKING_UP' | 'ANALYZING' | 'COMPLETED' | 'FAILED';
export type RecommendationType = 'CANCEL' | 'DOWNGRADE' | 'SWITCH_PLAN' | 'SWITCH_PROVIDER' | 'BUNDLE' | 'LOW_USAGE';
export type RecommendationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Recommendation {
  type: RecommendationType;
  priority: RecommendationPriority;
  subscriptionId: string;
  subscriptionName: string;
  title: string;
  description: string;
  estimatedSavingsMonthly: number;
  alternativeProvider?: string;
  alternativePrice?: number;
  alternativePlan?: string;
  confidence: number;
}

export interface DuplicateGroup {
  reason: string;
  subscriptions: { id: string; name: string; amount: number }[];
  suggestion: string;
  estimatedSavingsMonthly: number;
}

export interface AnalysisLatestResponse {
  result: {
    id: string;
    summary: string;
    totalMonthlySavings: number;
    currency: string;
    recommendations: Recommendation[];
    duplicates: DuplicateGroup[];
    subscriptionCount: number;
    createdAt: string;
    expiresAt: string;
  } | null;
  job: {
    id: string;
    status: AnalysisJobStatus;
    createdAt: string;
  } | null;
  canRunManual: boolean;
  nextAutoAnalysis: string | null;
}

export interface AnalysisStatusResponse {
  id: string;
  status: AnalysisJobStatus;
  stageProgress: {
    collect: 'pending' | 'done';
    normalize: 'pending' | 'done';
    marketLookup: 'pending' | 'done';
    aiAnalyze: 'pending' | 'done';
    store: 'pending' | 'done';
  };
  resultId: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AnalysisUsageResponse {
  autoAnalysesUsed: number;
  autoAnalysesLimit: number;
  manualAnalysesUsed: number;
  manualAnalysesLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  periodStart: string;
  periodEnd: string;
  lastAnalysisAt: string | null;
  cooldownEndsAt: string | null;
}
