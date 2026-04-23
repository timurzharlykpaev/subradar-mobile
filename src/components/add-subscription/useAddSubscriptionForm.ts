import { useCallback, useState } from 'react';

/**
 * Default manual-form values for AddSubscriptionSheet.
 *
 * Exported so the orchestrator can spread-override fields (e.g., seed
 * `currency` from the user's display currency) and so tests can assert
 * against a single source of truth.
 *
 * Getters for `startDate` / `nextPaymentDate` are intentionally evaluated at
 * module load — good enough for a form that's always remounted per sheet open.
 */
export type BillingPeriod =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'
  | 'LIFETIME'
  | 'ONE_TIME';

export interface AddSubscriptionForm {
  name: string;
  category: string;
  amount: string;
  currency: string;
  billingPeriod: BillingPeriod;
  billingDay: string;
  paymentCardId: string;
  currentPlan: string;
  serviceUrl: string;
  cancelUrl: string;
  notes: string;
  iconUrl: string;
  isTrial: boolean;
  trialEndDate: string;
  startDate: string;
  nextPaymentDate: string;
  reminderDaysBefore: number[];
  color: string;
  tags: string[];
}

export const emptyForm: AddSubscriptionForm = {
  name: '',
  category: 'STREAMING',
  amount: '',
  currency: 'USD',
  billingPeriod: 'MONTHLY',
  billingDay: '1',
  paymentCardId: '',
  currentPlan: '',
  serviceUrl: '',
  cancelUrl: '',
  notes: '',
  iconUrl: '',
  isTrial: false,
  trialEndDate: '',
  startDate: new Date().toISOString().split('T')[0],
  nextPaymentDate: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0]; })(),
  reminderDaysBefore: [3],
  color: '',
  tags: [],
};

/**
 * Form state hook for the manual "Add subscription" flow.
 *
 * Lifts form + disclosure state out of AddSubscriptionSheet so a keystroke
 * in `name`/`amount`/etc. re-renders ManualFormView only — the orchestrator
 * stays stable because child flow views (Idle/Loading/Confirm/Wizard) are
 * memoized and don't depend on form state.
 */
export function useAddSubscriptionForm(initial: AddSubscriptionForm = emptyForm) {
  const [form, setForm] = useState<AddSubscriptionForm>(initial);
  const [moreExpanded, setMoreExpanded] = useState(false);
  // Pre-existing dead state kept for API parity (may be dropped in B7).
  const [manualExpanded, setManualExpanded] = useState(false);

  const setF = useCallback(<K extends keyof AddSubscriptionForm>(
    key: K,
    value: AddSubscriptionForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setForm(initial);
    setMoreExpanded(false);
    setManualExpanded(false);
  }, [initial]);

  return {
    form,
    setForm,
    setF,
    moreExpanded,
    setMoreExpanded,
    manualExpanded,
    setManualExpanded,
    reset,
  };
}

export type AddSubscriptionFormCtx = ReturnType<typeof useAddSubscriptionForm>;
