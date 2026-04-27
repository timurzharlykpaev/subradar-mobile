import { apiClient } from './client';
import type { BillingMeResponse, TrialStatusResponse } from '../types/billing';

export const billingApi = {
  getMe: () => apiClient.get<BillingMeResponse>('/billing/me'),
  cancel: () => apiClient.post('/billing/cancel'),
  getPlans: () => apiClient.get('/billing/plans'),
  startTrial: () => apiClient.post<{ endsAt: string }>('/billing/trial'),
  trialStatus: () => apiClient.get<TrialStatusResponse>('/billing/trial'),
  syncRevenueCat: (productId: string) =>
    apiClient.post('/billing/sync-revenuecat', { productId }),
  reconcile: () =>
    apiClient.post<{ success: boolean; action: 'noop' | 'cancel_at_period_end' | 'downgraded'; reason: string }>(
      '/billing/reconcile',
    ),
};
