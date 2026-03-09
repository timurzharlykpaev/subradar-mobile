import { apiClient } from './client';

export const subscriptionsApi = {
  getAll: (params?: any) => apiClient.get('/subscriptions', { params }),
  getById: (id: string) => apiClient.get(`/subscriptions/${id}`),
  create: (data: any) => apiClient.post('/subscriptions', data),
  update: (id: string, data: any) => apiClient.patch(`/subscriptions/${id}`, data),
  delete: (id: string) => apiClient.delete(`/subscriptions/${id}`),
  cancel: (id: string) => apiClient.post(`/subscriptions/${id}/cancel`),
  pause: (id: string) => apiClient.post(`/subscriptions/${id}/pause`),
  restore: (id: string) => apiClient.post(`/subscriptions/${id}/restore`),
  archive: (id: string) => apiClient.post(`/subscriptions/${id}/archive`),
  uploadReceipt: (id: string, formData: FormData) =>
    apiClient.post(`/subscriptions/${id}/receipts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
