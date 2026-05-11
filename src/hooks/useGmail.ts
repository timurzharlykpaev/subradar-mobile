import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useCallback } from 'react';
import { gmailApi, GmailStatus, GmailScanResult } from '../api/gmail';
import i18n from '../i18n';

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
  }>({
    jobId: null,
    status: 'idle',
    result: null,
    error: null,
    cached: false,
  });
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const poll = useCallback(
    async (jobId: string, attemptsLeft: number) => {
      try {
        const s = await gmailApi.getScanStatus(jobId);
        if (s.status === 'completed') {
          setState({
            jobId,
            status: 'completed',
            result: s.result ?? null,
            error: null,
            cached: !!s.result?.cached,
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
          });
          return;
        }
        // Still pending/running.
        if (attemptsLeft <= 0) {
          // Bail to UI so the user isn't left with an infinite spinner
          // — the scan still runs server-side and the push will fire
          // when it finishes. Caller renders a "still scanning" hint.
          return;
        }
        pollTimer.current = setTimeout(
          () => poll(jobId, attemptsLeft - 1),
          2000,
        );
      } catch (err: any) {
        // 404 on the job means it expired or never existed (or another
        // user's id, but the server-side check covers that). Surface
        // as a failed state so the UI can show "couldn't reach scan"
        // and offer a retry.
        setState({
          jobId,
          status: 'failed',
          result: null,
          error: {
            statusCode: err?.response?.status,
            message: err?.message ?? 'Scan poll failed',
          },
          cached: false,
        });
      }
    },
    [],
  );

  const start = useCallback(
    async (opts?: { force?: boolean }) => {
      stopPolling();
      setState({
        jobId: null,
        status: 'pending',
        result: null,
        error: null,
        cached: false,
      });
      try {
        const job = await gmailApi.startScan(currentLocale(), opts?.force === true);
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
          });
          return job;
        }
        setState((prev) => ({
          ...prev,
          jobId: job.jobId,
          status: job.status,
          cached: job.cached,
        }));
        // 45 attempts × 2s = 90s, enough for the slowest realistic
        // scan today (~30s). After that we stop polling but the push
        // path still fires; the user comes back into a state where
        // the screen mount can re-fetch the same jobId.
        pollTimer.current = setTimeout(() => poll(job.jobId, 45), 2000);
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
          });
          return;
        }
        pollTimer.current = setTimeout(() => poll(jobId, 45), 2000);
      } catch (err: any) {
        setState({
          jobId,
          status: 'failed',
          result: null,
          error: {
            statusCode: err?.response?.status,
            message: err?.message ?? 'Scan poll failed',
          },
          cached: false,
        });
      }
    },
    [poll, stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    setState({
      jobId: null,
      status: 'idle',
      result: null,
      error: null,
      cached: false,
    });
  }, [stopPolling]);

  return { ...state, start, resume, reset };
}
