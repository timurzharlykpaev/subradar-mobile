import { apiClient } from './client';
import type { AnalysisLatestResponse, AnalysisStatusResponse, AnalysisUsageResponse } from '../types';

export const analysisApi = {
  getLatest: async (): Promise<AnalysisLatestResponse> => {
    const { data } = await apiClient.get('/analysis/latest');
    return data;
  },
  getStatus: async (jobId: string): Promise<AnalysisStatusResponse> => {
    const { data } = await apiClient.get(`/analysis/status/${jobId}`);
    return data;
  },
  run: async (
    opts?: { locale?: string; currency?: string; region?: string },
  ): Promise<{ jobId?: string; status?: string; cached?: boolean; resultId?: string; error?: string; retryAfter?: number }> => {
    const body: Record<string, string> = {};
    if (opts?.locale) body.locale = opts.locale;
    if (opts?.currency) body.currency = opts.currency;
    if (opts?.region) body.country = opts.region;
    const { data } = await apiClient.post('/analysis/run', Object.keys(body).length ? body : undefined);
    return data;
  },
  getUsage: async (): Promise<AnalysisUsageResponse> => {
    const { data } = await apiClient.get('/analysis/usage');
    return data;
  },
};
