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
