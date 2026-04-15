import { apiClient } from './client';

function withDisplayCurrency(
  params: Record<string, unknown> | undefined,
  displayCurrency?: string,
): Record<string, unknown> {
  if (!displayCurrency) return params ?? {};
  return { ...(params ?? {}), displayCurrency };
}

export const analyticsApi = {
  getSummary: (opts?: { displayCurrency?: string }) =>
    apiClient.get('/analytics/summary', {
      params: withDisplayCurrency(undefined, opts?.displayCurrency),
    }),
  getMonthly: (months?: number, opts?: { displayCurrency?: string }) =>
    apiClient.get('/analytics/monthly', {
      params: withDisplayCurrency({ months }, opts?.displayCurrency),
    }),
  getByCategory: (opts?: { displayCurrency?: string }) =>
    apiClient.get('/analytics/by-category', {
      params: withDisplayCurrency(undefined, opts?.displayCurrency),
    }),
  getByCard: (opts?: { displayCurrency?: string }) =>
    apiClient.get('/analytics/by-card', {
      params: withDisplayCurrency(undefined, opts?.displayCurrency),
    }),
  getForecast: (opts?: { displayCurrency?: string }) =>
    apiClient.get('/analytics/forecast', {
      params: withDisplayCurrency(undefined, opts?.displayCurrency),
    }),
  getUpcoming: (days?: number, opts?: { displayCurrency?: string }) =>
    apiClient.get('/analytics/upcoming', {
      params: withDisplayCurrency({ days }, opts?.displayCurrency),
    }),
  getTrials: (opts?: { displayCurrency?: string }) =>
    apiClient.get('/analytics/trials', {
      params: withDisplayCurrency(undefined, opts?.displayCurrency),
    }),
  getSavings: (opts?: { displayCurrency?: string }) =>
    apiClient.get('/analytics/savings', {
      params: withDisplayCurrency(undefined, opts?.displayCurrency),
    }),
};
