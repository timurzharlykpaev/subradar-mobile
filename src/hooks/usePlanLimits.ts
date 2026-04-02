import { useBillingStatus } from './useBilling';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';

export const FREE_LIMITS = {
  maxSubscriptions: 3,
  maxAiRequests: 5,
  maxCards: 2,
};

export const PRO_LIMITS = {
  maxCards: 10,
};

export function usePlanLimits() {
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
  const { data: billing } = useBillingStatus();

  const rawPlan = billing?.plan ?? 'free';
  const isCancelled = billing?.status === 'cancelled' || (billing?.status === 'trialing' && billing?.cancelAtPeriodEnd);
  const plan = isCancelled ? 'free' : rawPlan;
  const isPro = (plan === 'pro' || plan === 'organization') && !isCancelled;

  const activeCount = subscriptions.filter(
    (s) => s.status === 'ACTIVE' || s.status === 'TRIAL'
  ).length;
  const subsLimitReached = !isPro && activeCount >= FREE_LIMITS.maxSubscriptions;

  const cards = usePaymentCardsStore((s) => s.cards);
  const maxCards = plan === 'organization' ? Infinity : isPro ? PRO_LIMITS.maxCards : FREE_LIMITS.maxCards;
  const cardsLimitReached = cards.length >= maxCards;

  return {
    plan,
    isPro,
    isCancelled,
    subsLimitReached,
    activeCount,
    maxSubscriptions: isPro ? Infinity : FREE_LIMITS.maxSubscriptions,
    cards,
    maxCards,
    cardsLimitReached,
  };
}
