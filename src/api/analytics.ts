import { apiClient } from './client';

export const analyticsApi = {
  getSummary: () => apiClient.get('/analytics/summary'),
  getMonthly: (months?: number) => apiClient.get('/analytics/monthly', { params: { months } }),
  getByCategory: () => apiClient.get('/analytics/by-category'),
  getByCard: () => apiClient.get('/analytics/by-card'),
  getForecast: () => apiClient.get('/analytics/upcoming'),
  getTrials: () => apiClient.get('/analytics/trials'),
};
