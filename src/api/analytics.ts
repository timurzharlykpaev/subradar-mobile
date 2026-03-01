import { apiClient } from './client';

export const analyticsApi = {
  getSummary: () => apiClient.get('/analytics/summary'),
  getMonthly: (year?: number) => apiClient.get('/analytics/monthly', { params: { year } }),
  getByCategory: () => apiClient.get('/analytics/by-category'),
  getByCard: () => apiClient.get('/analytics/by-card'),
  generateReport: (data: { startDate: string; endDate: string; type: string }) =>
    apiClient.post('/analytics/report', data, { responseType: 'blob' }),
};
