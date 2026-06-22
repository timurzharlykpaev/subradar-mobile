/**
 * Pure classification of a billing `source` into the trial-tracking action.
 * Kept in its own dependency-free module so it can be unit-tested without
 * pulling the React Native / TanStack Query import chain (which this repo's
 * ts-jest/node test env can't transform).
 *
 *   mark    source 'trial'                  → user is trialing, persist the flag
 *   churn   source 'free'                   → trial ended without converting → fire
 *   convert source 'own' | 'team'           → converted to a paid plan → clear, no fire
 *   wait    source 'grace_pro'|'grace_team' → NON-terminal; keep flag, decide later
 *   idle    anything else (unknown)          → do nothing
 *
 * `wait` is the crux: a trial can pass trial → grace → free, and treating grace
 * as terminal would drop the eventual free transition from the funnel.
 */
export type TrialTransition = 'mark' | 'churn' | 'convert' | 'wait' | 'idle';

export function classifyTrialTransition(
  source: string | undefined,
): TrialTransition {
  switch (source) {
    case 'trial':
      return 'mark';
    case 'free':
      return 'churn';
    case 'own':
    case 'team':
      return 'convert';
    case 'grace_pro':
    case 'grace_team':
      return 'wait';
    default:
      return 'idle';
  }
}
