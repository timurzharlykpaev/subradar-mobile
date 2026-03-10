import { useBillingStatus } from './useBilling';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';

export const FREE_LIMITS = {
  maxSubscriptions: 3,
  maxAiRequests: 5,
};

export function usePlanLimits() {
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
  const { data: billing } = useBillingStatus();

  const plan = billing?.plan ?? 'free';
  const isPro = plan === 'pro' || plan === 'organization';

  const activeCount = subscriptions.filter(
    (s) => s.status === 'ACTIVE' || s.status === 'TRIAL'
  ).length;
  const subsLimitReached = !isPro && activeCount >= FREE_LIMITS.maxSubscriptions;

  return {
    plan,
    isPro,
    subsLimitReached,
    activeCount,
    maxSubscriptions: isPro ? Infinity : FREE_LIMITS.maxSubscriptions,
  };
}
