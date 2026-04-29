import { apiClient } from './client';
import type { BillingMeResponse, TrialStatusResponse } from '../types/billing';

/**
 * Generate a per-call idempotency key. Same key on retry of the same
 * logical operation makes the backend replay the cached response instead
 * of re-running the side effect. Different logical operation = different key.
 *
 * Lightweight UUID-ish generator — we don't need cryptographic strength,
 * just enough entropy that two separate user actions never collide. Falls
 * back to timestamp+random if `crypto.randomUUID` isn't available
 * (older RN runtimes).
 */
function newIdempotencyKey(): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const billingApi = {
  getMe: () => apiClient.get<BillingMeResponse>('/billing/me'),
  cancel: () =>
    apiClient.post(
      '/billing/cancel',
      undefined,
      { headers: { 'Idempotency-Key': newIdempotencyKey() } },
    ),
  getPlans: () => apiClient.get('/billing/plans'),
  startTrial: () => apiClient.post<{ endsAt: string }>('/billing/trial'),
  trialStatus: () => apiClient.get<TrialStatusResponse>('/billing/trial'),
  syncRevenueCat: (productId: string) =>
    apiClient.post(
      '/billing/sync-revenuecat',
      { productId },
      { headers: { 'Idempotency-Key': newIdempotencyKey() } },
    ),
  reconcile: () =>
    apiClient.post<{ success: boolean; action: 'noop' | 'cancel_at_period_end' | 'downgraded'; reason: string }>(
      '/billing/reconcile',
    ),
};
