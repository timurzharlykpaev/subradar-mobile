import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Discrete "wow moment" gates. Each one is allowed to ask for a review at
 * most once per device (regardless of cooldown), so a user who already
 * declined after `subscription_added_3plus` doesn't get re-prompted on the
 * same moment three days later.
 */
export type ReviewTrigger =
  | 'subscription_added_3plus'
  | 'analytics_viewed'
  | 'cancelled_subscription'
  | 'gmail_import_complete'
  | 'onboarding_completed'
  | 'streak_5_days'
  | 'manual_settings';

/**
 * Mirror of platform-level constraints from SKStoreReviewController +
 * Google Play In-App Review. The platforms self-throttle (Apple: 3
 * requests / 365 days; Google: ~3-4 per quarter), but we add our own
 * gating so we don't burn the budget on weak moments.
 */
const MIN_DAYS_SINCE_INSTALL = 2;          // give the user time to settle in
const MIN_DAYS_BETWEEN_PROMPTS = 120;      // ~3 prompts/year max from our side
const NEGATIVE_COOLDOWN_MS = 5 * 60_000;   // 5 min after paywall/error
const STREAK_THRESHOLD = 5;                // days for streak trigger

interface ReviewPromptState {
  installedAt: number | null;              // epoch ms; set on first app open
  lastPromptedAt: number | null;
  promptCount: number;
  /** Triggers that have already requested at least once. */
  firedTriggers: Record<ReviewTrigger, true | undefined>;
  /** Last paywall / error / crash timestamp — suppress prompts for a window. */
  lastNegativeAt: number | null;
  /** Last calendar date (YYYY-MM-DD) the app was opened. Used for streak. */
  lastActiveDay: string | null;
  consecutiveDays: number;

  // --- Actions ---
  /** Call on every app cold-start. Idempotent. */
  recordAppOpen: () => void;
  /** Call right before showing a paywall or surfacing a runtime error. */
  markNegative: () => void;
  /**
   * Returns true if conditions are met (caller may then fire the native prompt).
   * Records the fact internally — caller should NOT call twice for the same
   * trigger in a single session.
   */
  shouldPrompt: (trigger: ReviewTrigger) => boolean;
  /** Call after the native prompt was actually invoked. */
  markPrompted: () => void;
  /** Dev/QA helper, not exposed in UI. */
  reset: () => void;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.round((tb - ta) / 86_400_000);
}

export const useReviewPromptStore = create<ReviewPromptState>()(
  persist(
    (set, get) => ({
      installedAt: null,
      lastPromptedAt: null,
      promptCount: 0,
      firedTriggers: {} as ReviewPromptState['firedTriggers'],
      lastNegativeAt: null,
      lastActiveDay: null,
      consecutiveDays: 0,

      recordAppOpen: () => {
        const now = Date.now();
        const today = todayKey();
        const { installedAt, lastActiveDay, consecutiveDays } = get();
        const patch: Partial<ReviewPromptState> = {};
        if (installedAt == null) patch.installedAt = now;
        if (lastActiveDay !== today) {
          const gap = lastActiveDay ? daysBetween(lastActiveDay, today) : null;
          if (gap === 1) {
            patch.consecutiveDays = consecutiveDays + 1;
          } else {
            // First day, or there was a break — restart the streak at 1.
            patch.consecutiveDays = 1;
          }
          patch.lastActiveDay = today;
        }
        if (Object.keys(patch).length > 0) set(patch);
      },

      markNegative: () => set({ lastNegativeAt: Date.now() }),

      shouldPrompt: (trigger) => {
        const s = get();
        // Manual setting bypasses our gating — but is still subject to the
        // OS-level throttle inside SKStoreReviewController.
        if (trigger === 'manual_settings') return true;

        if (s.firedTriggers[trigger]) return false;
        if (s.installedAt == null) return false;
        const sinceInstallDays =
          (Date.now() - s.installedAt) / 86_400_000;
        if (sinceInstallDays < MIN_DAYS_SINCE_INSTALL) return false;
        if (
          s.lastNegativeAt != null &&
          Date.now() - s.lastNegativeAt < NEGATIVE_COOLDOWN_MS
        ) {
          return false;
        }
        if (s.lastPromptedAt != null) {
          const sincePromptDays =
            (Date.now() - s.lastPromptedAt) / 86_400_000;
          if (sincePromptDays < MIN_DAYS_BETWEEN_PROMPTS) return false;
        }
        // Streak gate is special — only fire when the threshold is actually met.
        if (trigger === 'streak_5_days' && s.consecutiveDays < STREAK_THRESHOLD) {
          return false;
        }
        // Atomically mark this trigger as fired so a re-entrant caller in the
        // same render cycle doesn't double-prompt.
        set({
          firedTriggers: { ...s.firedTriggers, [trigger]: true },
        });
        return true;
      },

      markPrompted: () =>
        set((s) => ({
          lastPromptedAt: Date.now(),
          promptCount: s.promptCount + 1,
        })),

      reset: () =>
        set({
          installedAt: null,
          lastPromptedAt: null,
          promptCount: 0,
          firedTriggers: {} as ReviewPromptState['firedTriggers'],
          lastNegativeAt: null,
          lastActiveDay: null,
          consecutiveDays: 0,
        }),
    }),
    {
      name: 'subradar-review-prompt',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
