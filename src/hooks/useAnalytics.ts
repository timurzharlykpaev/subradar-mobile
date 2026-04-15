import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics';
import { useSettingsStore } from '../stores/settingsStore';

export function useAnalytics(params?: { month?: number; year?: number }) {
  const displayCurrency = useSettingsStore((s) => s.displayCurrency);
  return useQuery({
    queryKey: ['analytics', 'summary', displayCurrency, params],
    queryFn: () => analyticsApi.getSummary({ displayCurrency }).then((r) => r.data),
  });
}
