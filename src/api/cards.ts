import { apiClient } from './client';

export const cardsApi = {
  getAll: () => apiClient.get('/payment-cards'),
  create: (data: any) => apiClient.post('/payment-cards', data),
  update: (id: string, data: any) => apiClient.patch(`/payment-cards/${id}`, data),
  delete: (id: string) => apiClient.delete(`/payment-cards/${id}`),
};
