import { apiClient } from './client';
import { ReportType } from '../types';

export const reportsApi = {
  generate: (data: { startDate: string; endDate: string; type: ReportType }) =>
    apiClient.post('/reports/generate', data),
  list: () => apiClient.get('/reports'),
  download: (id: string) => apiClient.get(`/reports/${id}/download`, { responseType: 'blob' }),
};
