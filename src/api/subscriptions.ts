import { apiClient } from './client';

// Hard cap: защищает мобилку от OOM при большом числе подписок.
// Согласовано с backend лимитами (Pro: 500, Team: 2000) — Pro получает всё,
// у Team первые 500 самых дорогих, что покрывает 99% UI-сценариев.
const SUBSCRIPTIONS_DEFAULT_LIMIT = 500;

export const subscriptionsApi = {
  getAll: (params?: any) =>
    apiClient.get('/subscriptions', {
      params: {
        limit: SUBSCRIPTIONS_DEFAULT_LIMIT,
        sort: 'amount',
        order: 'DESC',
        ...params,
      },
    }),
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
