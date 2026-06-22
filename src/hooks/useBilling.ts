import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../api/billing';
import type { BillingMeResponse } from '../types/billing';
import { analytics } from '../services/analytics';

export function useBillingStatus() {
  return useQuery<BillingMeResponse>({
    queryKey: ['billing', 'me'],
    queryFn: async () => {
      try {
        const r = await billingApi.getMe();
        if (__DEV__) console.log('[Billing] /billing/me response:', JSON.stringify(r.data).slice(0, 200));
        return r.data;
      } catch (e: any) {
        if (__DEV__) console.error('[Billing] /billing/me error:', e?.response?.status, e?.response?.data);
        throw e;
      }
    },
    // Billing state doesn't change on a second-by-second basis. A 60s
    // staleTime is short enough for trial-end / cancel-at-period-end UI
    // to update promptly, but long enough to coalesce the common
    // "Home + AddSheet + BannerRenderer all mount at once" case into a
    // single network call. Targeted invalidations (RC entitlement
    // changes, post-purchase, post-cancel) still refresh immediately.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => billingApi.getPlans().then((r) => r.data),
  });
}

export function useStartTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.startTrial().then((r) => r.data),
    onSuccess: () => {
      // Single point covering every caller (onboarding modal, ProFeatureModal,
      // dashboard). Was defined on the analytics service but never fired —
      // without it the churn funnel has no trial_started entry node.
      analytics.trialStarted('pro');
      qc.invalidateQueries({ queryKey: ['billing', 'me'] });
    },
  });
}
