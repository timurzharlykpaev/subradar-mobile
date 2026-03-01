import { apiClient } from './client';

export const reportsApi = {
  generate: (data: { startDate: string; endDate: string; type: 'summary' | 'detailed' | 'tax' }) =>
    apiClient.post('/reports/generate', data),
  list: () => apiClient.get('/reports'),
  download: (id: string) => apiClient.get(`/reports/${id}/download`, { responseType: 'blob' }),
};
