import { useCallback, useEffect, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gmailApi } from '../api/gmail';
import { GMAIL_SCAN_CLEARED_EVENT } from './useGmail';

const ACTIVE_SCAN_STORAGE_KEY = 'gmail:scan:active-jobId';

/**
 * Read-only companion to `useGmailScanJob`. Used by the dashboard banner so
 * the user can see scan progress (and tap to jump to results) from outside
 * the gmail-import screen. It polls the same `getScanStatus` endpoint that
 * the gmail-import screen uses, so the backend's 60 req/min/user budget is
 * the same either way.
 *
 * Polling cadence is intentionally slower than the in-screen hook (5 s vs
 * 2 s during fetch stage) because the dashboard isn't the "primary" view
 * of the scan and the radio + battery cost compounds when this poller can
 * run for the full 3-minute lifetime of a scan even while the user is on
 * the home tab. The screen-level hook still does the aggressive polling
 * when the user actually opens gmail-import.
 *
 * State recovery:
 *   - on mount + on focus (useFocusEffect) re-reads AsyncStorage so when
 *     gmail-import clears the active jobId (after import/back), the
 *     dashboard banner disappears immediately on the next focus event.
 *   - on AppState → 'active' re-reads too, mirroring the screen-level
 *     hook's recovery behaviour (a long backgrounded session can outlive
 *     the JS-side state).
 */
export function useActiveGmailScan() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const qc = useQueryClient();

  const reloadJobId = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(ACTIVE_SCAN_STORAGE_KEY);
      setActiveJobId((prev) => {
        // Reset the dismissed flag whenever the jobId changes — a fresh
        // scan should never be hidden by a leftover dismissal from the
        // previous run.
        if (stored !== prev) setDismissed(false);
        return stored;
      });
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    void reloadJobId();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void reloadJobId();
    });
    // gmail-import's scan.reset() fires this event after a successful
    // import. Without it the banner can linger on the dashboard until
    // the user tabs away + back, because useFocusEffect only fires on
    // navigation focus and the banner shares no React state with the
    // hook that did the reset.
    const clearedSub = DeviceEventEmitter.addListener(
      GMAIL_SCAN_CLEARED_EVENT,
      () => {
        // Optimistically clear local state — the event itself IS the
        // "scan cleared" signal, so we trust it instead of round-tripping
        // through AsyncStorage. Even now that useGmail.reset() awaits the
        // removeItem before emitting, native AsyncStorage batching can
        // still reorder a read against a just-completed write in pathological
        // cases, so we belt-and-suspenders by zeroing state in the listener
        // and only use reloadJobId as a re-check.
        setActiveJobId(null);
        setDismissed(false);
        qc.removeQueries({ queryKey: ['gmail', 'scan', 'active'] });
        void reloadJobId();
      },
    );
    return () => {
      sub.remove();
      clearedSub.remove();
    };
  }, [reloadJobId, qc]);

  useFocusEffect(
    useCallback(() => {
      void reloadJobId();
    }, [reloadJobId]),
  );

  const enabled = !!activeJobId && !dismissed;
  const { data } = useQuery({
    queryKey: ['gmail', 'scan', 'active', activeJobId],
    queryFn: () => gmailApi.getScanStatus(activeJobId!),
    enabled,
    // Poll until terminal state. 5 s during running covers the early-fetch
    // burst comfortably without thrashing — gmail-import's hook still does
    // the 2 s aggressive poll when the user is actually watching the loader.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 5000;
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: (failureCount, err: any) => {
      // 404 means the job expired/cleared server-side — drop the local
      // pointer + stop polling. Anything else is a transient hiccup; let
      // React Query retry a couple of times.
      if (err?.response?.status === 404) {
        AsyncStorage.removeItem(ACTIVE_SCAN_STORAGE_KEY).catch(() => {});
        setActiveJobId(null);
        return false;
      }
      return failureCount < 2;
    },
  });

  const dismiss = useCallback(() => {
    setDismissed(true);
    // Drop server-side state pointer too so a future visit to gmail-import
    // doesn't auto-resume a completed scan the user has already dismissed.
    AsyncStorage.removeItem(ACTIVE_SCAN_STORAGE_KEY).catch(() => {});
    qc.removeQueries({ queryKey: ['gmail', 'scan', 'active'] });
  }, [qc]);

  const status = data?.status ?? null;
  const isVisible = !!activeJobId && !dismissed && status !== null;

  return {
    isVisible,
    jobId: activeJobId,
    status,
    progress: data?.progress ?? null,
    candidateCount: data?.result?.candidates?.length ?? 0,
    dismiss,
  };
}
