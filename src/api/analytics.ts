import { apiClient } from './client';

export const analyticsApi = {
  getSummary: () => apiClient.get('/analytics/summary'),
  getMonthly: (year?: number) => apiClient.get('/analytics/monthly', { params: { year } }),
  getByCategory: () => apiClient.get('/analytics/by-category'),
  getByCard: () => apiClient.get('/analytics/by-card'),
  getForecast: () => apiClient.get("/analytics/upcoming"),
  getSavings: () => apiClient.get('/analytics/savings'),
  getTrials: () => apiClient.get('/analytics/trials'),
};
