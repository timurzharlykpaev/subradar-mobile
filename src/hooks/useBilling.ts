import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../api/billing';
import type { BillingMeResponse } from '../types/billing';

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
    staleTime: 10_000,
    refetchOnMount: 'always',
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', 'me'] }),
  });
}
