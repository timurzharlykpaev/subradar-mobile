import { useCallback } from 'react';
import { useReviewPromptStore, type ReviewTrigger } from '../stores/reviewPromptStore';
import { requestInAppReview } from '../utils/requestInAppReview';
import { analytics } from '../services/analytics';

/**
 * Single entrypoint for asking the user to rate the app from a wow moment.
 *
 * Call `promptIfEligible(trigger)` from a successful, positive code path
 * (subscription added, AI analytics surfaced, import finished, etc.). The
 * hook handles all the throttling — install age, per-trigger budget, our
 * 120-day cooldown, the 5-min negative-event blackout — and only ever
 * surfaces the OS-native rating dialog when the conditions line up.
 *
 * Call `markNegative()` right before a paywall opens, an error toast fires,
 * or any other moment that would poison the request.
 *
 * Never wrap the call in any UI affordance ("Would you like to rate us?")
 * — the native prompt IS the affordance, and adding our own pre-prompt is
 * an App Store guideline violation (4.5.6).
 */
export function useReviewPrompt() {
  const shouldPrompt = useReviewPromptStore((s) => s.shouldPrompt);
  const markPrompted = useReviewPromptStore((s) => s.markPrompted);
  const markNegative = useReviewPromptStore((s) => s.markNegative);

  const promptIfEligible = useCallback(
    async (trigger: ReviewTrigger): Promise<boolean> => {
      if (!shouldPrompt(trigger)) return false;
      // Fire-and-forget tracking — never block on analytics.
      try {
        analytics.track('review_prompt_shown', { trigger });
      } catch {}
      const shown = await requestInAppReview();
      if (shown) markPrompted();
      return shown;
    },
    [shouldPrompt, markPrompted],
  );

  return { promptIfEligible, markNegative };
}
