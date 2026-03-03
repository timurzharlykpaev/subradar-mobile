import { apiClient } from './client';

export const billingApi = {
  getMe: () => apiClient.get('/billing/me'),
  checkout: (planId: string) => apiClient.post('/billing/checkout', { planId }),
  cancel: () => apiClient.post('/billing/cancel'),
  getPlans: () => apiClient.get('/billing/plans'),
  startTrial: () => apiClient.post('/billing/trial'),
};
