import { apiClient } from './client';

export const receiptsApi = {
  upload: (subscriptionId: string, formData: FormData) =>
    apiClient.post(`/subscriptions/${subscriptionId}/receipts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: (subscriptionId: string) =>
    apiClient.get(`/subscriptions/${subscriptionId}/receipts`),
  delete: (subscriptionId: string, receiptId: string) =>
    apiClient.delete(`/subscriptions/${subscriptionId}/receipts/${receiptId}`),
};
