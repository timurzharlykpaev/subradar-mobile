import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import i18n from '../i18n';
import { analysisApi } from '../api/analysis';
import { useSettingsStore } from '../stores/settingsStore';
import type { AnalysisStatusResponse } from '../types';

const ANALYSIS_KEYS = {
  // Currency is part of the key so switching currency re-fetches the backend's
  // converted view rather than reusing the stale (wrong-currency) cache.
  latest: (displayCurrency: string) => ['analysis', 'latest', displayCurrency] as const,
  status: (jobId: string) => ['analysis', 'status', jobId] as const,
  usage: ['analysis', 'usage'] as const,
};

export function useAnalysisLatest() {
  const displayCurrency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');
  return useQuery({
    queryKey: ANALYSIS_KEYS.latest(displayCurrency),
    queryFn: () => analysisApi.getLatest({ displayCurrency }),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAnalysisStatus(jobId: string | null) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.status(jobId || ''),
    queryFn: () => analysisApi.getStatus(jobId!),
    enabled: !!jobId,
    // A 429 means "slow down" — never retry it inline; pacing is owned by the
    // backoff in refetchInterval. Retrying a rate-limit immediately just burns
    // the budget faster. Allow a couple of retries for other transient errors.
    retry: (failureCount, error) => {
      if ((error as any)?.response?.status === 429) return false;
      return failureCount < 2;
    },
    refetchInterval: (query) => {
      const data = query.state.data as AnalysisStatusResponse | undefined;
      if (data?.status === 'COMPLETED' || data?.status === 'FAILED') return false;
      // Back off on consecutive failures (429 rate-limit, transient 5xx)
      // instead of a fixed cadence. A stuck / rate-limited job otherwise polls
      // hard and self-rate-limits (Sentry caught 19× 429 in one minute).
      // Cap at 30s so polling still recovers once the limit clears — on the
      // next success fetchFailureCount resets and we return to the base cadence.
      // Base interval is 5s (12/min): an analysis takes 15-30s, so 5s keeps
      // perceived latency low while staying well under the backend's per-route
      // poll ceiling even if a few clients share a carrier IP.
      const failures = query.state.fetchFailureCount;
      if (failures > 0) return Math.min(5000 * 2 ** failures, 30_000);
      return 5000;
    },
  });
}

export function useRunAnalysis() {
  const queryClient = useQueryClient();
  const storeLanguage = useSettingsStore((s) => s.language);
  const currency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');
  const region = useSettingsStore((s) => s.region || s.country || 'US');
  // i18n.language is the actual active UI locale; store value may be stale if
  // language was changed elsewhere (system detect, onboarding) without setLanguage.
  const locale = (i18n.language || storeLanguage || 'en').split('-')[0];
  return useMutation({
    mutationFn: () => analysisApi.run({ locale, currency, region }),
    onSuccess: () => {
      // Invalidate the whole `['analysis', 'latest', *]` family so the new
      // result is re-fetched regardless of which currency the user is on.
      queryClient.invalidateQueries({ queryKey: ['analysis', 'latest'] });
      queryClient.invalidateQueries({ queryKey: ANALYSIS_KEYS.usage });
    },
  });
}

export function useAnalysisUsage() {
  return useQuery({
    queryKey: ANALYSIS_KEYS.usage,
    queryFn: analysisApi.getUsage,
    staleTime: 60_000,
    retry: false,
  });
}

export function useAnalysisFlow() {
  const queryClient = useQueryClient();
  const { data: latest, isLoading: latestLoading, error: latestError } = useAnalysisLatest();
  const runAnalysis = useRunAnalysis();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { data: jobStatus } = useAnalysisStatus(activeJobId);
  // Guards autoTrigger from firing twice under React Strict Mode (double-mount
  // effects in dev) and from racing itself if the screen re-renders before the
  // mutateAsync promise settles.
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    if (latest?.job && latest.job.status !== 'COMPLETED' && latest.job.status !== 'FAILED') {
      setActiveJobId(latest.job.id);
    }
  }, [latest?.job]);

  useEffect(() => {
    if (jobStatus?.status === 'COMPLETED') {
      setActiveJobId(null);
      queryClient.invalidateQueries({ queryKey: ['analysis', 'latest'] });
    }
    if (jobStatus?.status === 'FAILED') {
      setActiveJobId(null);
    }
  }, [jobStatus?.status, queryClient]);

  const autoTrigger = useCallback(async () => {
    if (autoTriggeredRef.current) return;
    if (!latest || latest.result || latest.job || !latest.canRunManual) return;
    autoTriggeredRef.current = true;
    try {
      const res = await runAnalysis.mutateAsync();
      if (res.jobId) setActiveJobId(res.jobId);
    } catch {
      // Reset so a subsequent legitimate retry isn't blocked by the guard.
      autoTriggeredRef.current = false;
    }
  }, [latest, runAnalysis]);

  const manualRun = useCallback(async () => {
    try {
      const res = await runAnalysis.mutateAsync();
      if (res.jobId) {
        setActiveJobId(res.jobId);
      } else {
        // cached or instant result — just refresh the data
        queryClient.invalidateQueries({ queryKey: ['analysis', 'latest'] });
      }
      return res;
    } catch (e: any) {
      console.error('[Analysis] manualRun error:', e?.response?.status, e?.response?.data || e?.message);
      throw e;
    }
  }, [runAnalysis, queryClient]);

  return {
    result: latest?.result || null,
    job: activeJobId ? jobStatus : null,
    isLoading: latestLoading,
    isPlanRequired: (latestError as any)?.response?.status === 403,
    canRunManual: latest?.canRunManual ?? false,
    isRunning: !!activeJobId,
    autoTrigger,
    manualRun,
  };
}
