export type FlowState =
  | 'idle'
  | 'loading'
  | 'transcription'
  | 'confirm'
  | 'bulk-confirm'
  | 'wizard'
  | 'manual';

export type AddedViaSource = 'MANUAL' | 'AI_TEXT' | 'AI_SCREENSHOT';

// Loading stages shown during AI processing in AddSubscriptionSheet. Kept here
// so both the orchestrator and the extracted LoadingView can share the type.
// (AIWizard has its own LoadingStage with different values — keep distinct.)
export type LoadingStage = 'transcribing' | 'analyzing' | 'thinking' | 'saving';

/**
 * Shape of a subscription draft as it flows through the AI pipeline
 * (wizard → confirm → bulk-confirm → bulk-edit → save). Kept in the shared
 * add-subscription types module so every view (AIWizard, BulkEditModal,
 * BulkConfirmView, ConfirmView, orchestrator) imports from one canonical
 * place instead of reaching into AIWizard's 1200-line component file.
 */
export interface ParsedSub {
  name?: string;
  amount?: number;
  currency?: string;
  billingPeriod?: 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY';
  category?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  iconUrl?: string;
  paymentCardId?: string;
  startDate?: string;
  nextPaymentDate?: string;
  billingDay?: number;
  notes?: string;
  reminderDaysBefore?: number[];
}
