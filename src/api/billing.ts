import { apiClient } from './client';

export const billingApi = {
  getMe: () => apiClient.get('/billing/me'),
  cancel: () => apiClient.post('/billing/cancel'),
  getPlans: () => apiClient.get('/billing/plans'),
  startTrial: () => apiClient.post('/billing/trial'),
  syncRevenueCat: (productId: string) => apiClient.post('/billing/sync-revenuecat', { productId }),
};
