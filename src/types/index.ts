export type BillingPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionStatus = 'active' | 'trial' | 'paused' | 'cancelled';
export type CardBrand = 'Visa' | 'Mastercard' | 'Amex' | 'Mir' | 'Other';
export type ReportType = 'summary' | 'detailed' | 'tax';
export type Theme = 'light' | 'dark' | 'system';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'KZT' | 'RUB' | 'UAH' | 'TRY';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan?: 'free' | 'pro';
}

export interface Subscription {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  period: BillingPeriod;
  billingDay: number;
  nextDate: string;
  status: SubscriptionStatus;
  cardId?: string;
  plan?: string;
  websiteUrl?: string;
  cancelUrl?: string;
  notes?: string;
  isBusinessExpense?: boolean;
  taxCategory?: string;
  reminderEnabled?: boolean;
  reminderDays?: number;
  createdAt: string;
}

export interface PaymentCard {
  id: string;
  nickname: string;
  last4: string;
  brand: CardBrand;
  color: string;
}

export interface Receipt {
  id: string;
  subscriptionId: string;
  url: string;
  amount?: number;
  date: string;
  createdAt: string;
}

export interface Report {
  id: string;
  type: ReportType;
  startDate: string;
  endDate: string;
  url?: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalMonthly: number;
  totalYearly: number;
  renewingSoon: number;
  savings?: number;
  byCategory: { category: string; amount: number }[];
  monthlyTrend: { month: string; amount: number }[];
  topSubscriptions: Subscription[];
}

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: BillingPeriod;
  features: string[];
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
  category: string;
  plans: { name: string; price: number; currency: string; period: BillingPeriod }[];
  websiteUrl?: string;
  logoUrl?: string;
}
