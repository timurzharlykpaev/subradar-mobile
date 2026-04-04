import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { billingApi } from '../api/billing';

export function useBillingStatus() {
  return useQuery({
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
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: 1,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => billingApi.getPlans().then((r) => r.data),
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (planId: string) => billingApi.checkout(planId).then((r) => r.data),
    onSuccess: (data: { url: string }) => {
      if (data?.url) Linking.openURL(data.url);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.message || 'Payment provider error. Please try again.';
      if (__DEV__) console.warn('Checkout error:', msg);
    },
  });
}

export function useStartTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.startTrial().then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', 'me'] }),
  });
}
