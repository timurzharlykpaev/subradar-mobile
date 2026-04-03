import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { analysisApi } from '../api/analysis';
import type { AnalysisStatusResponse } from '../types';

const ANALYSIS_KEYS = {
  latest: ['analysis', 'latest'] as const,
  status: (jobId: string) => ['analysis', 'status', jobId] as const,
  usage: ['analysis', 'usage'] as const,
};

export function useAnalysisLatest() {
  return useQuery({
    queryKey: ANALYSIS_KEYS.latest,
    queryFn: analysisApi.getLatest,
    staleTime: 30_000,
    retry: false,
  });
}

export function useAnalysisStatus(jobId: string | null) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.status(jobId || ''),
    queryFn: () => analysisApi.getStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as AnalysisStatusResponse | undefined;
      if (!data) return 3000;
      if (data.status === 'COMPLETED' || data.status === 'FAILED') return false;
      return 3000;
    },
  });
}

export function useRunAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: analysisApi.run,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANALYSIS_KEYS.latest });
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

  useEffect(() => {
    if (latest?.job && latest.job.status !== 'COMPLETED' && latest.job.status !== 'FAILED') {
      setActiveJobId(latest.job.id);
    }
  }, [latest?.job]);

  useEffect(() => {
    if (jobStatus?.status === 'COMPLETED') {
      setActiveJobId(null);
      queryClient.invalidateQueries({ queryKey: ANALYSIS_KEYS.latest });
    }
    if (jobStatus?.status === 'FAILED') {
      setActiveJobId(null);
    }
  }, [jobStatus?.status, queryClient]);

  const autoTrigger = useCallback(async () => {
    if (latest && !latest.result && !latest.job && latest.canRunManual) {
      const res = await runAnalysis.mutateAsync();
      if (res.jobId) setActiveJobId(res.jobId);
    }
  }, [latest, runAnalysis]);

  const manualRun = useCallback(async () => {
    const res = await runAnalysis.mutateAsync();
    if (res.jobId) setActiveJobId(res.jobId);
    return res;
  }, [runAnalysis]);

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
