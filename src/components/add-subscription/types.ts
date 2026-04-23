export type FlowState =
  | 'idle'
  | 'loading'
  | 'transcription'
  | 'confirm'
  | 'bulk-confirm'
  | 'wizard'
  | 'manual';

export type AddedViaSource = 'MANUAL' | 'AI_TEXT' | 'AI_SCREENSHOT';
