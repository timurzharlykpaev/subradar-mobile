import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics';

export function useAnalytics(params?: { month?: number; year?: number }) {
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => analyticsApi.getSummary().then((r) => r.data),
  });
}
