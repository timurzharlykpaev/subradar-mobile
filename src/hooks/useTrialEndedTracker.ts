import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffectiveAccess } from './useEffectiveAccess';
import { analytics } from '../services/analytics';

const WAS_TRIALING_KEY = 'trial:was_trialing';
const TRIAL_STARTED_AT_KEY = 'trial:started_at';

/**
 * Fires `trial_ended` exactly once when the internal (server-granted) trial
 * ends and the user drops to free.
 *
 * The backend detects trial expiry via a daily cron — the client is never
 * told directly. So we infer it from the billing `source` transition: while
 * `source === 'trial'` we persist a flag (+ first-seen timestamp); when a
 * later `/billing/me` shows the user is no longer trialing AND landed on
 * `free`, the trial expired without converting → emit `trial_ended` and clear
 * the flag. If they converted instead (source becomes `own`, plan ≠ free) we
 * clear the flag silently — that's a purchase, not churn.
 *
 * Persisted in AsyncStorage so it survives app restarts (the trial usually
 * ends while the app is closed; we catch it on the next open — exactly the
 * win-back audience). Mount once, at the app root.
 */
export function useTrialEndedTracker(): void {
  const access = useEffectiveAccess();
  // Guards against double-firing within a single session before the async
  // flag write/read settles.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!access || access.isLoading) return;

    const isTrialing = access.source === 'trial';
    const isFree = access.plan === 'free';

    if (isTrialing) {
      firedRef.current = false;
      AsyncStorage.getItem(WAS_TRIALING_KEY).then((v) => {
        if (v !== '1') {
          AsyncStorage.setItem(WAS_TRIALING_KEY, '1');
          AsyncStorage.setItem(TRIAL_STARTED_AT_KEY, String(Date.now()));
        }
      });
      return;
    }

    // No longer trialing — was the user trialing before?
    if (firedRef.current) return;
    AsyncStorage.getItem(WAS_TRIALING_KEY).then(async (v) => {
      if (v !== '1') return;
      firedRef.current = true;

      // Only count it as a trial *end* (churn) when they dropped to free.
      // source becoming `own`/`team` with a paid plan = conversion, not churn.
      if (isFree) {
        const startedRaw = await AsyncStorage.getItem(TRIAL_STARTED_AT_KEY);
        const startedAt = startedRaw ? Number(startedRaw) : null;
        const daysSinceStart =
          startedAt && !Number.isNaN(startedAt)
            ? Math.floor((Date.now() - startedAt) / 86_400_000)
            : null;
        analytics.trialEnded(daysSinceStart);
      }

      await AsyncStorage.multiRemove([WAS_TRIALING_KEY, TRIAL_STARTED_AT_KEY]);
    });
  }, [access?.source, access?.plan, access?.isLoading]);
}
