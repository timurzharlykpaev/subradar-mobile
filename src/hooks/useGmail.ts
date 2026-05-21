import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  gmailApi,
  GmailStatus,
  GmailScanResult,
  GmailScanProgress,
} from '../api/gmail';
import i18n from '../i18n';

// Persisted jobId so the user can navigate away, lock the phone, or
// fully background the app mid-scan and still come back to the same
// running/completed job. Cleared explicitly when the user saves all
// candidates or hits the Back button in the review sheet (so the
// next visit starts clean).
const ACTIVE_SCAN_STORAGE_KEY = 'gmail:scan:active-jobId';

// Broadcast event fired when the active scan pointer is cleared (after a
// successful import or an explicit reset). The dashboard banner uses a
// separate hook (useActiveGmailScan) with its own AsyncStorage-cached
// jobId — without this event it only re-reads on focus / foreground,
// so the "scan ready" banner could linger on the dashboard until the
// next time the user tabbed away and back. The event is fire-and-
// forget; listeners just call their reloadJobId() once.
export const GMAIL_SCAN_CLEARED_EVENT = 'gmail.scan.cleared';

const currentLocale = () => (i18n.language || 'en').split('-')[0];

/** Connection status — refetches on focus so toggling Gmail on/off in
 *  another device's settings shows up promptly. */
export function useGmailStatus() {
  return useQuery<GmailStatus>({
    queryKey: ['gmail', 'status'],
    queryFn: () => gmailApi.status().then((r) => r.data),
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

/** Get the consent URL — fired on tap, NOT on screen mount. Each call
 *  produces a new signed state nonce so opening the URL twice in
 *  quick succession works fine (server uses single-use Redis lock on
 *  callback). */
export function useGmailConnect() {
  return useMutation({
    mutationFn: () => gmailApi.connect().then((r) => r.data.authUrl),
  });
}

export function useGmailDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gmailApi.disconnect().then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmail', 'status'] });
    },
  });
}

/** Pro/Team-gated bulk scan. Free users get a 402 PRO_PLAN_REQUIRED
 *  which the caller should map to the paywall route. The mutation
 *  arg controls whether to bypass the backend's 10-min result cache
 *  (used by the "Scan again" CTA after reviewing a cached result).
 */
export function useGmailScan() {
  return useMutation<GmailScanResult, Error, { force?: boolean } | void>({
    mutationFn: (args) =>
      gmailApi.scan(currentLocale(), args?.force === true).then((r) => r.data),
  });
}

/**
 * Background-scan flow with polling. The scan runs server-side even
 * if the user backgrounds the app — a push notification on
 * completion deep-links them back to render the result. While the
 * screen is open we poll every 2s for up to 90s.
 *
 * Returns the same `GmailScanResult` shape as `useGmailScan` so
 * the existing review-sheet UI keeps working unchanged; the only
 * difference is the loader lifecycle (start → poll → result vs
 * single blocking request).
 */
export function useGmailScanJob() {
  const [state, setState] = useState<{
    jobId: string | null;
    status: 'idle' | 'pending' | 'running' | 'completed' | 'failed';
    result: GmailScanResult | null;
    error: { code?: string; message: string; statusCode?: number } | null;
    cached: boolean;
    progress: GmailScanProgress | null;
  }>({
    jobId: null,
    status: 'idle',
    result: null,
    error: null,
    cached: false,
    progress: null,
  });
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  // Adaptive polling backoff. The first ~15 s of a scan tend to be
  // the fetch stage (fast updates land); we poll aggressively at
  // 2 s. Once we cross into the AI-parse stage (~15-20 s in), the
  // status changes more slowly so we ease off to 4 s, then 8 s
  // past the 60 s mark. This cuts a typical 3-min poll burst from
  // ~90 requests to ~32 — kinder to backend throttling and the
  // device's radio + battery — without making the loader feel
  // less responsive (a 4 s gap is imperceptible against the
  // smoothly-incrementing email counter).
  const pickPollInterval = (attemptsDone: number, elapsedMs: number) => {
    if (elapsedMs < 15_000) return 2000;
    if (elapsedMs < 60_000) return 4000;
    return 8000;
  };

  const poll = useCallback(
    async (jobId: string, attemptsLeft: number, startedAtMs?: number) => {
      // First call doesn't have an anchor — start the clock here.
      const anchor = startedAtMs ?? Date.now();
      try {
        const s = await gmailApi.getScanStatus(jobId);
        if (s.status === 'completed') {
          setState({
            jobId,
            status: 'completed',
            result: s.result ?? null,
            error: null,
            cached: !!s.result?.cached,
            progress: null,
          });
          return;
        }
        if (s.status === 'failed') {
          setState({
            jobId,
            status: 'failed',
            result: null,
            error: s.error ?? { message: 'Scan failed' },
            cached: false,
            progress: null,
          });
          return;
        }
        // Still pending/running — bubble live progress to the UI.
        setState((prev) => ({
          ...prev,
          jobId,
          status: s.status,
          progress: s.progress ?? prev.progress,
        }));
        if (attemptsLeft <= 0) {
          // Bail to UI so the user isn't left with an infinite spinner
          // — the scan still runs server-side and the push will fire
          // when it finishes. Caller renders a "still scanning" hint.
          return;
        }
        const nextDelay = pickPollInterval(
          90 - attemptsLeft,
          Date.now() - anchor,
        );
        pollTimer.current = setTimeout(
          () => poll(jobId, attemptsLeft - 1, anchor),
          nextDelay,
        );
      } catch (err: any) {
        const status = err?.response?.status;
        const isNetworkError = !err?.response && /network|timeout/i.test(err?.message ?? '');
        const isTransient5xx = typeof status === 'number' && status >= 500;
        // Transient network blips and 5xx hiccups should NOT kill the
        // whole scan UI — the scan keeps running server-side. Retry
        // with a short backoff (1s, then poll cadence) up to 3 times
        // before surfacing as failed. 404 / 401 / 403 / 400 are
        // terminal (job expired, auth gone, validation rejected) and
        // get the failed state immediately.
        if ((isNetworkError || isTransient5xx) && attemptsLeft > 0) {
          const backoffMs = Math.min(8000, 1500 + (90 - attemptsLeft) * 500);
          pollTimer.current = setTimeout(
            () => poll(jobId, attemptsLeft - 1, anchor),
            backoffMs,
          );
          return;
        }
        setState({
          jobId,
          status: 'failed',
          result: null,
          error: {
            statusCode: status,
            message: err?.message ?? 'Scan poll failed',
          },
          cached: false,
          progress: null,
        });
      }
    },
    [],
  );

  // Polling cap covers ~3 min wall-clock, which fits the worst-case
  // 3000-msg scan from the largest inboxes we see. Past that we stop
  // polling but DON'T mark failed — the scan still runs server-side
  // and the push notification will fire when it completes, deep-
  // linking the user back to the same jobId.
  const POLL_ATTEMPTS = 90;

  const start = useCallback(
    async (opts?: { force?: boolean }) => {
      stopPolling();
      setState({
        jobId: null,
        status: 'pending',
        result: null,
        error: null,
        cached: false,
        progress: null,
      });
      try {
        const job = await gmailApi.startScan(currentLocale(), opts?.force === true);
        // Persist the jobId immediately so a hard-kill of the app
        // mid-scan can resume on next launch. Cached results don't
        // get persisted because they're already terminal.
        if (job.status !== 'completed') {
          AsyncStorage.setItem(ACTIVE_SCAN_STORAGE_KEY, job.jobId).catch(
            () => {
              /* best-effort */
            },
          );
        }
        // Cached results come back already completed → fetch the
        // status row immediately and render without ever showing a
        // loader. Saves one extra interactive frame.
        if (job.status === 'completed') {
          const status = await gmailApi.getScanStatus(job.jobId);
          setState({
            jobId: job.jobId,
            status: 'completed',
            result: status.result ?? null,
            error: null,
            cached: !!status.result?.cached,
            progress: null,
          });
          return job;
        }
        setState((prev) => ({
          ...prev,
          jobId: job.jobId,
          status: job.status,
          cached: job.cached,
        }));
        pollTimer.current = setTimeout(() => poll(job.jobId, POLL_ATTEMPTS), 2000);
        return job;
      } catch (err: any) {
        setState({
          jobId: null,
          status: 'failed',
          result: null,
          error: {
            statusCode: err?.response?.status,
            message: err?.response?.data?.message ?? err?.message ?? 'Scan failed',
            code: err?.response?.data?.code,
          },
          cached: false,
          progress: null,
        });
        throw err;
      }
    },
    [poll, stopPolling],
  );

  const resume = useCallback(
    async (jobId: string) => {
      stopPolling();
      setState({
        jobId,
        status: 'running',
        result: null,
        error: null,
        cached: false,
        progress: null,
      });
      // Re-persist so a future cold launch picks up the same job
      // (the previous persistence might have been wiped by a
      // memory-pressure kill that didn't run our reset path).
      AsyncStorage.setItem(ACTIVE_SCAN_STORAGE_KEY, jobId).catch(() => {
        /* best-effort */
      });
      try {
        const status = await gmailApi.getScanStatus(jobId);
        if (status.status === 'completed') {
          setState({
            jobId,
            status: 'completed',
            result: status.result ?? null,
            error: null,
            cached: !!status.result?.cached,
            progress: null,
          });
          return;
        }
        if (status.status === 'failed') {
          setState({
            jobId,
            status: 'failed',
            result: null,
            error: status.error ?? { message: 'Scan failed' },
            cached: false,
            progress: null,
          });
          return;
        }
        // Still pending/running — surface any progress data we
        // already have so the loader picks up mid-scan numbers.
        setState((prev) => ({
          ...prev,
          jobId,
          status: status.status,
          progress: status.progress ?? prev.progress,
        }));
        pollTimer.current = setTimeout(() => poll(jobId, POLL_ATTEMPTS), 2000);
      } catch (err: any) {
        // A 404 on resume means the job expired (>30 min TTL) or was
        // never the user's — drop the persisted pointer so a fresh
        // visit doesn't re-attempt the same dead jobId. Other errors
        // keep the persisted pointer so a transient network hiccup
        // doesn't lose the in-flight scan.
        if (err?.response?.status === 404) {
          AsyncStorage.removeItem(ACTIVE_SCAN_STORAGE_KEY).catch(() => {});
        }
        setState({
          jobId,
          status: 'failed',
          result: null,
          error: {
            statusCode: err?.response?.status,
            message: err?.message ?? 'Scan poll failed',
          },
          cached: false,
          progress: null,
        });
      }
    },
    [poll, stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    AsyncStorage.removeItem(ACTIVE_SCAN_STORAGE_KEY).catch(() => {
      /* best-effort */
    });
    // Tell the dashboard banner (useActiveGmailScan) to drop its cached
    // jobId immediately instead of waiting for the next focus event.
    DeviceEventEmitter.emit(GMAIL_SCAN_CLEARED_EVENT);
    setState({
      jobId: null,
      status: 'idle',
      result: null,
      error: null,
      cached: false,
      progress: null,
    });
  }, [stopPolling]);

  // Auto-recover the previously-running scan on mount + whenever
  // the app returns to the foreground. This is what makes the
  // "leave the screen, get a coffee, come back" UX work: regardless
  // of which screen the user navigates from, opening gmail-import
  // picks up the in-flight job instead of forcing a new scan.
  const recoverOnce = useRef(false);
  useEffect(() => {
    if (recoverOnce.current) return;
    recoverOnce.current = true;
    AsyncStorage.getItem(ACTIVE_SCAN_STORAGE_KEY)
      .then((storedJobId) => {
        if (storedJobId) {
          void resume(storedJobId);
        }
      })
      .catch(() => {
        /* recovery is best-effort */
      });
  }, [resume]);

  // App-state recovery: when the user toggles back from
  // backgrounded → active, refresh the poll. Without this the
  // polling chain might have been cut by AppState going inactive
  // (setTimeout pauses in the background on iOS), leaving the
  // user with stale state on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        AsyncStorage.getItem(ACTIVE_SCAN_STORAGE_KEY)
          .then((storedJobId) => {
            if (storedJobId) void resume(storedJobId);
          })
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, [resume]);

  return { ...state, start, resume, reset };
}
