import { useBillingStatus } from './useBilling';
import { useRevenueCat } from './useRevenueCat';
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
  const { isPro: rcIsPro } = useRevenueCat();

  const rawPlan = billing?.plan ?? 'free';
  const isCancelled = billing?.status === 'cancelled' || billing?.cancelAtPeriodEnd === true;
  const plan = isCancelled ? 'free' : rawPlan;
  // Trust RevenueCat as source of truth for Pro status (handles sandbox/test purchases)
  const isPro = rcIsPro || ((plan === 'pro' || plan === 'organization') && !isCancelled);

  const activeCount = subscriptions.filter(
    (s) => s.status === 'ACTIVE' || s.status === 'TRIAL'
  ).length;
  // Server limit is authoritative when present; otherwise fall back to constant.
  const serverLimit = billing?.subscriptionLimit ?? null;
  const effectiveFreeLimit = serverLimit ?? FREE_LIMITS.maxSubscriptions;
  const subsLimitReached = !isPro && activeCount >= effectiveFreeLimit;
  const slotsLeft = isPro ? Infinity : Math.max(0, effectiveFreeLimit - activeCount);

  const cards = usePaymentCardsStore((s) => s.cards);
  const maxCards = plan === 'organization' ? Infinity : isPro ? PRO_LIMITS.maxCards : FREE_LIMITS.maxCards;
  const cardsLimitReached = cards.length >= maxCards;

  return {
    plan,
    isPro,
    isCancelled,
    subsLimitReached,
    activeCount,
    slotsLeft,
    maxSubscriptions: isPro ? Infinity : effectiveFreeLimit,
    cards,
    maxCards,
    cardsLimitReached,
  };
}
