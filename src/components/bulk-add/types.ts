/**
 * Shared types for BulkAddSheet's per-mode child components.
 *
 * `BulkSub` is the concrete shape used by the bulk review flow: every field
 * that the review/save path relies on is non-optional (`name`, `amount`,
 * `currency`, `billingPeriod`). This is intentionally stricter than the
 * generic `ParsedSub` in `../add-subscription/types` which represents a
 * draft from the AI pipeline with all fields optional.
 */
export interface BulkSub {
  name: string;
  amount: number;
  currency: string;
  billingPeriod: 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY' | 'LIFETIME' | 'ONE_TIME';
  category?: string;
  iconUrl?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  isDuplicate?: boolean;
  // Optional fields the user may set in the bulk review/edit step before
  // saving — same names as the backend Subscription columns so saveSelected
  // can spread them straight into the create payload without aliasing.
  billingDay?: number;
  startDate?: string;
  nextPaymentDate?: string;
  notes?: string;
  tags?: string[];
  color?: string;
  currentPlan?: string;
  reminderDaysBefore?: number[];
}
