import { useQuery, useMutation } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { billingApi } from '../api/billing';

export function useBillingStatus() {
  return useQuery({
    queryKey: ['billing', 'me'],
    queryFn: () => billingApi.getMe().then((r) => r.data),
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
  });
}
