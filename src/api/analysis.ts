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
  run: async (locale?: string): Promise<{ jobId?: string; status?: string; cached?: boolean; resultId?: string; error?: string; retryAfter?: number }> => {
    const { data } = await apiClient.post('/analysis/run', locale ? { locale } : undefined);
    return data;
  },
  getUsage: async (): Promise<AnalysisUsageResponse> => {
    const { data } = await apiClient.get('/analysis/usage');
    return data;
  },
};
