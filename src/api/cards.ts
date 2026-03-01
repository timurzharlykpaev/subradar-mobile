import { apiClient } from './client';

export const cardsApi = {
  getAll: () => apiClient.get('/cards'),
  create: (data: any) => apiClient.post('/cards', data),
  update: (id: string, data: any) => apiClient.put(`/cards/${id}`, data),
  delete: (id: string) => apiClient.delete(`/cards/${id}`),
};
