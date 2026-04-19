import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../src/theme';
import { useEffectiveAccess } from '../src/hooks/useEffectiveAccess';
import { useQueryClient } from '@tanstack/react-query';
import { useRevenueCat, isRevenueCatAvailable } from '../src/hooks/useRevenueCat';
import { billingApi } from '../src/api/billing';
import { PurchaseSuccessScreen } from '../src/components/PurchaseSuccessScreen';
import { SyncRetryModal } from '../src/components/SyncRetryModal';
import { analytics } from '../src/services/analytics';
import { useSubscriptionsStore } from '../src/stores/subscriptionsStore';

// Key used to persist a "purchase happened but server sync didn't succeed yet"
// marker across app restarts. DataLoader (Phase 7) will reconcile on cold start.
const PENDING_RECEIPT_KEY = 'pending_receipt';

const { width: SCREEN_W } = Dimensions.get('window');

const PLANS = [
  {
    id: 'free',
    icon: 'leaf-outline' as const,
    color: '#6B7280',
    features: [
      { key: 'subs_3', icon: 'list-outline' },
      { key: 'ai_5', icon: 'sparkles-outline' },
      { key: 'basic_analytics', icon: 'bar-chart-outline' },
    ],
    missing: ['unlimited_subs', 'ai_200', 'advanced_analytics', 'pdf_reports', 'team_access'],
  },
  {
    id: 'pro',
    icon: 'diamond-outline' as const,
    color: '#8B5CF6',
    features: [
      { key: 'unlimited_subs', icon: 'infinite-outline' },
      { key: 'ai_200', icon: 'sparkles-outline' },
      { key: 'advanced_analytics', icon: 'analytics-outline' },
      { key: 'pdf_reports', icon: 'document-text-outline' },
    ],
    missing: ['team_access'],
  },
  {
    id: 'org',
    icon: 'people-outline' as const,
    color: '#06B6D4',
    features: [
      { key: 'everything_pro', icon: 'checkmark-done-outline' },
      { key: 'team_access', icon: 'people-outline' },
      { key: 'member_analytics', icon: 'stats-chart-outline' },
      { key: 'members_10', icon: 'person-add-outline' },
    ],
    missing: [],
  },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  // Prefill from query: "pro-yearly" | "pro-monthly" | "org-yearly" | "org-monthly"
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [prefPlan, prefPeriod] = (typeof prefill === 'string' ? prefill : '').split('-');
  const initialPlan = prefPlan === 'org' || prefPlan === 'pro' ? prefPlan : 'pro';
  const initialPeriod: 'monthly' | 'yearly' = prefPeriod === 'monthly' ? 'monthly' : 'yearly';
  const [selected, setSelected] = useState(initialPlan);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(initialPeriod);
  const [purchasing, setPurchasing] = useState(false);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);
  const [showClose, setShowClose] = useState(false);
  // If RC offerings don't resolve within 10s → show "prices unavailable" + retry
  const [pricesUnavailable, setPricesUnavailable] = useState(false);
  // Sync retry modal — shown when post-purchase sync to /billing/sync-revenuecat
  // fails 3x in a row. The Apple receipt is valid, server just hasn't caught up.
  const [showSyncRetry, setShowSyncRetry] = useState(false);
  const [syncRetrying, setSyncRetrying] = useState(false);
  // Last RC product identifier that entered the purchase flow — used to drive
  // manual retry from the SyncRetryModal.
  const [lastProductId, setLastProductId] = useState<string | null>(null);
  const openedAt = useRef(Date.now());
  const access = useEffectiveAccess();
  const billingLoading = access?.isLoading ?? !access;
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
  const userMonthly = subscriptions
    .filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL')
    .reduce((sum, s) => {
      const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1/3 : s.billingPeriod === 'YEARLY' ? 1/12 : 1;
      return sum + (Number(s.amount) || 0) * mult;
    }, 0);
  const teamYearlySavings = userMonthly > 0 ? Math.round(userMonthly * 12 * 0.75) : 0;
  const queryClient = useQueryClient();
  const { offerings, purchasePackage, restorePurchases, hasTrialOffer, loading: rcLoading, loadOfferings } = useRevenueCat();

  // Force-refresh billing when paywall opens to get latest plan status
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['billing'] });
    analytics.paywallViewed('direct');
    // Delay close button — reduces impulsive dismissals
    const timer = setTimeout(() => setShowClose(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Retry loading offerings if they're null after initial load
  useEffect(() => {
    if (!rcLoading && !offerings) {
      console.log('[Paywall] Offerings null after load, retrying...');
      const timer = setTimeout(() => loadOfferings(), 1500);
      return () => clearTimeout(timer);
    }
  }, [rcLoading, offerings]);

  // After 10s without offerings → surface "prices unavailable" state with retry button.
  // Reset whenever offerings resolve.
  useEffect(() => {
    if (offerings) {
      setPricesUnavailable(false);
      return;
    }
    const timer = setTimeout(() => setPricesUnavailable(true), 10_000);
    return () => clearTimeout(timer);
  }, [offerings]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardAnims = useRef(PLANS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    // Stagger card animations
    PLANS.forEach((_, i) => {
      Animated.timing(cardAnims[i], {
        toValue: 1,
        duration: 350,
        delay: 200 + i * 100,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const isPro = access?.isPro ?? false;
  const isTrialing = access?.source === 'trial';
  // Access via team means user inherits Pro/Team features from a workspace
  // owner's subscription — they have NO Apple receipt of their own.
  const accessViaTeam = access?.source === 'team';
  const hasOwnPro = access?.hasOwnPaidPlan === true;
  // Trial eligibility: RC exposes the Apple trial offer, backend says whether
  // the user is still eligible from our side (not used before).
  const canTrial = hasTrialOffer && (access?.actions.canStartTrial ?? false);

  // Product IDs come from backend (`access.products`) — no hardcoded fallback.
  // UI plan id `'org'` maps to backend key `team`.
  const productIdFor = (planId: string, period: 'monthly' | 'yearly'): string | undefined => {
    if (!access?.products) return undefined;
    const bucket =
      planId === 'pro'
        ? access.products.pro
        : planId === 'org'
          ? access.products.team
          : undefined;
    return bucket?.[period];
  };

  const findPackage = (planId: string, period: 'monthly' | 'yearly'): any | undefined => {
    const productId = productIdFor(planId, period);
    if (!productId) return undefined;
    return offerings?.current?.availablePackages?.find(
      (p: any) => p.product?.identifier === productId,
    );
  };

  const getPrice = (planId: string): { price: string; period: string } => {
    if (planId === 'free') return { price: t('paywall.free_price', 'Free'), period: '' };

    const pkg = findPackage(planId, billingPeriod);
    if (pkg) {
      const periodLabel = billingPeriod === 'yearly' ? t('paywall.year', 'yr') : t('paywall.month', 'mo');
      return { price: pkg.product.priceString, period: `/${periodLabel}` };
    }

    // No hardcoded fallback — show a neutral placeholder while offerings load.
    // If the 10s timer fires, the full "prices unavailable" block is rendered elsewhere.
    return { price: '…', period: '' };
  };

  /**
   * Attempts to sync a verified Apple receipt with our backend.
   * Retries up to 3 times with exponential-ish backoff (1.5s / 3s / 4.5s).
   * Returns true on the first successful sync, false if all attempts fail.
   *
   * Emits `sync_retry_attempt` on every try, `sync_retry_succeeded` on the
   * first success, and `sync_retry_exhausted` only when all 3 attempts fail.
   */
  const attemptSync = async (productId: string): Promise<boolean> => {
    let lastError: string | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      analytics.syncRetryAttempt(attempt + 1, productId);
      try {
        await billingApi.syncRevenueCat(productId);
        console.log('[Paywall] RC sync done (attempt', attempt + 1, ')');
        analytics.syncRetrySucceeded(attempt + 1, productId);
        return true;
      } catch (e: any) {
        lastError = e?.message;
        console.warn('[Paywall] RC sync failed attempt', attempt + 1, ':', e?.response?.status, e?.message);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    analytics.syncRetryExhausted(productId, lastError);
    return false;
  };

  const handleAction = async () => {
    if (selected === 'free') { router.back(); return; }

    // Team members ALREADY have Pro features via the team owner's subscription.
    // Warn them before initiating a redundant purchase — Apple often refuses
    // ("Purchases unavailable") because their Apple ID sees the team entitlement
    // already active through Family Sharing or cached entitlement state.
    if (accessViaTeam && !hasOwnPro && selected === 'pro') {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          t('paywall.team_access_title', 'You already have Pro'),
          t(
            'paywall.team_access_msg',
            'Your team subscription already unlocks every Pro feature. Buying your own Pro is only useful if you plan to leave the team. Apple may refuse the purchase while a team subscription is active on this Apple ID.',
          ),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('paywall.buy_anyway', 'Buy anyway'), onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }

    // Find RC package by product identifier
    const pkg = findPackage(selected, billingPeriod);
    console.log('[Paywall] selected:', selected, 'period:', billingPeriod, 'pkg found:', !!pkg, 'available:', offerings?.current?.availablePackages?.length ?? 0);

    if (!pkg) {
      // No RevenueCat package available — cannot proceed
      console.warn('[Paywall] No RC package found for', selected, billingPeriod);
      Alert.alert(
        t('common.error'),
        t('paywall.products_unavailable', 'Products are not available right now. Please try again later.'),
      );
      return;
    }

    // Persist a "pending receipt" marker BEFORE calling Apple — if the user
    // force-kills the app mid-purchase, DataLoader (Phase 7) will reconcile
    // on next cold start. Best-effort: storage failures must not block purchase.
    const productId = pkg.product.identifier;
    setLastProductId(productId);
    try {
      await SecureStore.setItemAsync(PENDING_RECEIPT_KEY, productId);
    } catch (e) {
      if (__DEV__) console.warn('[Paywall] pending_receipt write failed:', e);
    }

    // Native IAP purchase via RevenueCat
    analytics.track('purchase_initiated', { plan: selected, period: billingPeriod, price: pkg.product.price });
    setPurchasing(true);
    try {
      const purchaseSuccess = await purchasePackage(pkg);
      console.log('[Paywall] purchasePackage result:', purchaseSuccess);
      if (!purchaseSuccess) {
        analytics.track('purchase_cancelled', { plan: selected, period: billingPeriod });
        setPurchasing(false);
        // User cancelled or Apple refused — no receipt was created. Clear marker.
        try { await SecureStore.deleteItemAsync(PENDING_RECEIPT_KEY); } catch {}
        // If user has team access and Apple refused/cancelled, explain why and
        // what to try. Classic cause: same Apple ID is also signed into the
        // team owner's Family Sharing or has a stale entitlement cache.
        if (accessViaTeam && !hasOwnPro) {
          Alert.alert(
            t('paywall.purchase_blocked_title', "Purchase didn't complete"),
            t(
              'paywall.purchase_blocked_team',
              "Apple may have refused because your Apple ID is tied to the team subscription. Try: 1) sign out/in of App Store, 2) use a personal Apple ID, or 3) leave the team first (Settings → Workspace).",
            ),
          );
        }
        return;
      }
      // Show success immediately
      const planLabel = selected === 'org' ? 'Team' : 'Pro';
      analytics.purchaseCompleted(selected, billingPeriod, pkg.product.price);
      setSuccessPlan(planLabel);

      // Sync RC then refetch billing so button state updates before user dismisses success screen.
      // If sync fails the purchase is still valid on Apple's side — RevenueCat webhook
      // will eventually reconcile. Surface a retry modal if all 3 attempts fail.
      const syncOk = await attemptSync(productId);
      if (syncOk) {
        try { await SecureStore.deleteItemAsync(PENDING_RECEIPT_KEY); } catch {}
        await queryClient.refetchQueries({ queryKey: ['billing'] });
      } else {
        // Keep pending_receipt in storage so DataLoader can retry on next cold start.
        setShowSyncRetry(true);
      }
    } catch (e: any) {
      console.error('[Paywall] Purchase error:', e?.message);
      analytics.purchaseFailed(selected, e?.message ?? 'unknown');
      // Purchase threw before we got a receipt — safe to clear the marker.
      try { await SecureStore.deleteItemAsync(PENDING_RECEIPT_KEY); } catch {}
      Alert.alert(t('common.error'), e?.message || t('paywall.purchase_failed', 'Purchase failed. Please try again.'));
    } finally {
      setPurchasing(false);
    }
  };

  /** User tapped "Проверить ещё раз" on the SyncRetryModal. */
  const handleSyncRetry = async () => {
    if (!lastProductId || syncRetrying) return;
    setSyncRetrying(true);
    try {
      const ok = await attemptSync(lastProductId);
      if (ok) {
        try { await SecureStore.deleteItemAsync(PENDING_RECEIPT_KEY); } catch {}
        await queryClient.refetchQueries({ queryKey: ['billing'] });
        setShowSyncRetry(false);
      }
      // If still failing — keep modal open so the user can try again; the
      // pending_receipt marker persists so DataLoader catches it on restart.
    } finally {
      setSyncRetrying(false);
    }
  };

  const isLoading = billingLoading || purchasing;

  const getButtonLabel = () => {
    if (selected === 'free') return t('paywall.continue_free');
    if (canTrial && selected === 'pro') return `${t('paywall.start_free_trial', '7 days free — Start Trial')} →`;
    const planMatches =
      (selected === 'pro' && access?.plan === 'pro') ||
      (selected === 'org' && access?.plan === 'organization');
    // If on same plan and switching to yearly — show "Switch to Yearly"
    if (planMatches && !isTrialing && billingPeriod === 'yearly') {
      return t('paywall.switch_to_yearly', 'Switch to Yearly →');
    }
    if (planMatches && !isTrialing && billingPeriod === 'monthly') {
      return t('subscription_plan.active');
    }
    if (selected === 'org') return t('subscription_plan.upgrade_team');
    return t('subscription_plan.upgrade_pro');
  };

  // isCurrentPlan: only mark as "current" on monthly badge — yearly is always upgradable
  const isCurrentPlan = (planId: string) => {
    if (planId === 'free' && !isPro) return true;
    if (planId === 'pro' && access?.plan === 'pro' && billingPeriod === 'monthly') return true;
    if (planId === 'org' && access?.plan === 'organization' && billingPeriod === 'monthly') return true;
    return false;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>

        {/* Close button — delayed 3s to reduce impulsive dismissals */}
        {showClose && (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              const secs = Math.round((Date.now() - openedAt.current) / 1000);
              analytics.paywallDismissed(secs, selected, billingPeriod);
              router.back();
            }}
          >
            <View style={[styles.closeBtnCircle, { backgroundColor: colors.surface2, opacity: 0.6 }]}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}
        {!showClose && <View style={styles.closeBtn} />}

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.headerIcon, { backgroundColor: '#EF444415' }]}>
            <Text style={{ fontSize: 28 }}>💸</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('paywall.fear_title', 'Stop Losing Money on Forgotten Subscriptions')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {canTrial
              ? t('paywall.subtitle_trial', 'The average person wastes $624/year. Start your 7-day free trial.')
              : t('paywall.subtitle_no_trial', 'Track everything for less than $1/week.')}
          </Text>
        </Animated.View>

        {/* Social proof */}
        <Animated.View style={[styles.socialProofRow, { opacity: fadeAnim }]}>
          <View style={[styles.socialProofCard, { backgroundColor: isDark ? '#1C1C2E' : '#F8F9FF', borderColor: isDark ? '#2A2A3E' : '#E5E7EB' }]}>
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(i => <Ionicons key={i} name="star" size={12} color="#F59E0B" />)}
            </View>
            <Text style={[styles.socialProofText, { color: colors.text }]}>
              {t('paywall.testimonial', '"Found 4 forgotten subscriptions. Saved $180 in month 1."')}
            </Text>
            <Text style={[styles.socialProofAuthor, { color: colors.textMuted }]}>
              {t('paywall.testimonial_author', '— Alex M., verified user')}
            </Text>
          </View>
        </Animated.View>

        {/* Trial status badge */}
        {isTrialing && (
          <View style={[styles.statusBadge, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
            <Ionicons name="time" size={16} color="#F59E0B" />
            <Text style={[styles.statusText, { color: '#F59E0B' }]}>
              {(() => {
                const trialDays = access?.trialEndsAt
                  ? Math.max(0, Math.ceil((access.trialEndsAt.getTime() - Date.now()) / 86_400_000))
                  : 0;
                return t('subscription_plan.trial_active', { days: trialDays });
              })()}
            </Text>
          </View>
        )}
        {isPro && !isTrialing && (
          <View style={[styles.statusBadge, { backgroundColor: '#22C55E15', borderColor: '#22C55E40' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={[styles.statusText, { color: '#22C55E' }]}>Pro {t('subscription_plan.active')}</Text>
          </View>
        )}

        {/* Billing period toggle */}
        <View style={[styles.periodToggle, { backgroundColor: isDark ? '#16162A' : '#EDEDF8', borderWidth: 1, borderColor: isDark ? '#2A2A4A' : '#D8D8F0' }]}>
          <TouchableOpacity
            style={[
              styles.periodBtn,
              billingPeriod === 'monthly'
                ? { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }
                : { opacity: 0.5 },
            ]}
            onPress={() => {
              setBillingPeriod('monthly');
              analytics.track('paywall_period_toggled', { to: 'monthly' });
            }}
          >
            <Text style={[styles.periodText, { color: billingPeriod === 'monthly' ? '#FFF' : colors.textSecondary, fontWeight: billingPeriod === 'monthly' ? '700' : '500' }]}>
              {t('subscription_plan.billing_monthly')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodBtn,
              billingPeriod === 'yearly'
                ? { backgroundColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }
                : { opacity: 0.7, borderWidth: 1.5, borderColor: '#10B981', borderRadius: 10 },
            ]}
            onPress={() => {
              setBillingPeriod('yearly');
              analytics.track('paywall_period_toggled', { to: 'yearly' });
            }}
          >
            <Text style={[styles.periodText, { color: billingPeriod === 'yearly' ? '#FFF' : '#10B981', fontWeight: '800' }]}>
              {t('subscription_plan.billing_yearly')}
            </Text>
            <View style={[styles.saveBadge, { backgroundColor: billingPeriod === 'yearly' ? 'rgba(255,255,255,0.25)' : '#10B981' }]}>
              <Text style={styles.saveBadgeText}>BEST VALUE</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Prices unavailable — RC offerings never resolved after 10s. Swap plan cards for a retry card. */}
        {pricesUnavailable && !offerings && (
          <View style={[styles.planCard, { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF', borderColor: isDark ? '#2A2A3E' : '#E5E7EB', borderWidth: 1, alignItems: 'center', gap: 12 }]}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.planName, { color: colors.text, textAlign: 'center' }]}>
              {t('paywall.prices_unavailable_title', 'Цены временно недоступны')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 }}>
              {t('paywall.prices_unavailable_msg', 'Не удалось загрузить актуальные цены из App Store. Попробуйте ещё раз.')}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setPricesUnavailable(false);
                loadOfferings();
              }}
              style={{ marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary }}
              accessibilityRole="button"
              accessibilityLabel={t('common.retry', 'Retry')}
            >
              <Text style={{ color: '#FFF', fontWeight: '700' }}>
                {t('common.retry', 'Попробовать снова')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan cards */}
        {!(pricesUnavailable && !offerings) && PLANS.map((plan, index) => {
          const isSelected = selected === plan.id;
          const isCurrent = isCurrentPlan(plan.id);
          const { price, period } = getPrice(plan.id);

          return (
            <Animated.View
              key={plan.id}
              style={{ opacity: cardAnims[index], transform: [{ translateY: cardAnims[index].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
            >
              <TouchableOpacity
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isSelected
                      ? (isDark ? plan.color + '18' : plan.color + '10')
                      : (isDark ? '#1C1C2E' : '#FFFFFF'),
                    borderColor: isSelected ? plan.color : (isDark ? '#2A2A3E' : '#E5E7EB'),
                    borderWidth: isSelected ? 2.5 : 1,
                  },
                  isSelected && { shadowColor: plan.color, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
                  !isSelected && { opacity: 0.75 },
                ]}
                onPress={() => {
                  setSelected(plan.id);
                  analytics.track('paywall_plan_selected', { plan: plan.id, period: billingPeriod });
                }}
                activeOpacity={0.85}
              >
                {/* Plan header row */}
                <View style={styles.planHeader}>
                  <View style={[styles.planIconCircle, { backgroundColor: plan.color + '18' }]}>
                    <Ionicons name={plan.icon} size={22} color={plan.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={[styles.planName, { color: colors.text }]}>
                        {plan.id === 'free' ? 'Free' : plan.id === 'pro' ? 'Pro' : 'Team'}
                      </Text>
                      {/* Badge inline — no overlap */}
                      {plan.id === 'pro' && accessViaTeam && !hasOwnPro && (
                        <View style={[styles.inlineBadge, { backgroundColor: '#10B981' }]}>
                          <Text style={styles.inlineBadgeText}>{t('paywall.active_via_team', 'ACTIVE VIA TEAM')}</Text>
                        </View>
                      )}
                      {plan.id === 'pro' && !isCurrent && !(accessViaTeam && !hasOwnPro) && (
                        <View style={[styles.inlineBadge, { backgroundColor: plan.color }]}>
                          <Text style={styles.inlineBadgeText}>{t('paywall.most_popular')}</Text>
                        </View>
                      )}
                      {plan.id === 'org' && teamYearlySavings > 0 && !isCurrent && (
                        <View style={[styles.inlineBadge, { backgroundColor: '#22C55E' }]}>
                          <Text style={styles.inlineBadgeText}>
                            {t('team_upsell.save_vs_separate', { amount: `$${teamYearlySavings}` })}
                          </Text>
                        </View>
                      )}
                      {isCurrent && (
                        <View style={[styles.inlineBadge, { backgroundColor: '#22C55E' }]}>
                          <Text style={styles.inlineBadgeText}>{t('subscription_plan.current_plan').toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    {plan.id === 'pro' && canTrial && (
                      <Text style={[styles.trialHint, { color: plan.color }]}>
                        {t('paywall.free_7_days', '7 days free')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.priceBlock}>
                    <Text style={[styles.planPrice, { color: colors.text }]}>{price}</Text>
                    {period ? <Text style={[styles.planPeriod, { color: colors.textMuted }]}>{period}</Text> : null}
                  </View>
                  {isSelected && (
                    <View style={[styles.radioOuter, { borderColor: plan.color }]}>
                      <View style={[styles.radioInner, { backgroundColor: plan.color }]} />
                    </View>
                  )}
                  {!isSelected && (
                    <View style={[styles.radioOuter, { borderColor: colors.border }]} />
                  )}
                </View>

                {/* Features */}
                {isSelected && (
                  <View style={styles.featureList}>
                    {plan.features.map((f) => (
                      <View key={f.key} style={styles.featureRow}>
                        <Ionicons name={f.icon as any} size={16} color={plan.color} />
                        <Text style={[styles.featureText, { color: colors.text }]}>
                          {t(`paywall.feat_${f.key}`, f.key)}
                        </Text>
                      </View>
                    ))}
                    {plan.missing.map((m) => (
                      <View key={m} style={styles.featureRow}>
                        <Ionicons name="close" size={16} color={colors.textMuted} />
                        <Text style={[styles.featureText, { color: colors.textMuted }]}>
                          {t(`paywall.feat_${m}`, m)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* CTA */}
        {(() => {
          const ctaColor = selected === 'free'
            ? colors.textSecondary
            : (PLANS.find(p => p.id === selected)?.color ?? colors.primary);

          // Plan already active on the selected billing period — disable button to prevent double-purchase
          const planMatches =
            (selected === 'pro' && access?.plan === 'pro' && !isTrialing) ||
            (selected === 'org' && access?.plan === 'organization' && !isTrialing);
          const alreadyOnThisPlan = planMatches && billingPeriod === 'monthly';
          // Also block the CTA when offerings failed to load — the purchase
          // flow would fail immediately without a resolvable RC package.
          const offeringsMissing = pricesUnavailable && !offerings;
          const ctaDisabled = isLoading || alreadyOnThisPlan || offeringsMissing;

          return (
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            { backgroundColor: ctaColor },
            ctaDisabled && { opacity: 0.5 },
          ]}
          onPress={handleAction}
          disabled={ctaDisabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.subscribe', { defaultValue: 'Subscribe' })}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.ctaBtnText}>{getButtonLabel()}</Text>
              {planMatches && billingPeriod === 'monthly' ? (
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              ) : null}
            </View>
          )}
        </TouchableOpacity>
          );
        })()}

        {/* Secondary action — small and unemphasised */}
        <TouchableOpacity
          style={styles.laterBtn}
          onPress={() => {
            const secs = Math.round((Date.now() - openedAt.current) / 1000);
            analytics.paywallDismissed(secs, selected, billingPeriod);
            router.back();
          }}
        >
          <Text style={[styles.laterText, { color: colors.textMuted, fontSize: 13 }]}>
            {t('paywall.maybe_later')}
          </Text>
        </TouchableOpacity>

        {/* Subscription info + Disclaimer (Apple requirement 3.1.2) */}
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {canTrial ? t('paywall.free_trial_disclaimer') : t('paywall.paid_disclaimer')}
          {'\n'}
          {t('paywall.auto_renew_notice', 'Subscription auto-renews. Cancel anytime in Settings > Subscriptions.')}
        </Text>

        {/* Terms & Privacy links (Apple requirement 3.1.2c) */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL('https://subradar.ai/legal/terms')}>
            <Text style={[styles.legalLink, { color: colors.primary }]}>
              {t('paywall.terms', 'Terms of Use')}
            </Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://subradar.ai/legal/privacy')}>
            <Text style={[styles.legalLink, { color: colors.primary }]}>
              {t('paywall.privacy', 'Privacy Policy')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Restore Purchases */}
        <TouchableOpacity
          style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('paywall.restore_purchases', 'Restore Purchases')}
          onPress={async () => {
            // If RevenueCat native module isn't linked (Expo Go, simulator), IAP can't
            // reach App Store / Google Play — communicate that clearly instead of
            // showing a confusing "no subscriptions found" message.
            if (!isRevenueCatAvailable()) {
              Alert.alert(
                t('paywall.restore_unavailable_title', 'Restore unavailable'),
                t(
                  'paywall.restore_unavailable_msg',
                  'Please try again when connected to App Store or Google Play.',
                ),
              );
              return;
            }
            const { success, customerInfo: info } = await restorePurchases();
            if (success) {
              // Sync restored plan to backend
              try {
                const activeEntitlement = info?.entitlements?.active;
                const productId = activeEntitlement?.['team']?.productIdentifier
                  || activeEntitlement?.['pro']?.productIdentifier;
                if (productId) await billingApi.syncRevenueCat(productId);
              } catch (e) {
                if (__DEV__) console.warn('RC restore sync failed:', e);
              }
              await queryClient.invalidateQueries({ queryKey: ['billing'] });
              Alert.alert(t('paywall.restored', 'Restored!'), t('paywall.restored_msg', 'Your subscription has been restored.'),
                [{ text: 'OK', onPress: () => { try { router.dismissAll(); } catch {} router.replace('/(tabs)' as any); } }]
              );
            } else {
              Alert.alert(
                t('paywall.no_purchases_title', 'No active subscriptions'),
                t(
                  'paywall.no_purchases_help',
                  'No active subscriptions were found on this Apple ID / Google account. Contact support if you believe this is an error.',
                ),
              );
            }
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>
            {t('paywall.restore_purchases', 'Restore Purchases')}
          </Text>
        </TouchableOpacity>

      </ScrollView>
      <PurchaseSuccessScreen
        visible={!!successPlan}
        planName={successPlan ?? ''}
        onDone={async () => {
          setSuccessPlan(null);
          // Force refresh all billing & subscription data before navigating
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ['billing'] }),
            queryClient.refetchQueries({ queryKey: ['subscriptions'] }),
          ]);
          // Dismiss any modals in the stack, then navigate to tabs root
          try { router.dismissAll(); } catch {}
          router.replace('/(tabs)' as any);
        }}
      />
      <SyncRetryModal
        visible={showSyncRetry}
        loading={syncRetrying}
        onRetry={handleSyncRetry}
        onDismiss={() => setShowSyncRetry(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: { alignSelf: 'flex-end', padding: 16 },
  closeBtnCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  header: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20, gap: 8 },
  headerIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, fontFamily: 'Inter-ExtraBold' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginBottom: 16, padding: 10, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 13, fontWeight: '700' },

  socialProofRow: { paddingHorizontal: 20, marginBottom: 12 },
  socialProofCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 4 },
  starsRow: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  socialProofText: { fontSize: 13, fontWeight: '500', fontStyle: 'italic', lineHeight: 18 },
  socialProofAuthor: { fontSize: 11, marginTop: 2 },

  periodToggle: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, borderRadius: 14, padding: 4, gap: 4 },
  periodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  periodText: { fontSize: 14, fontWeight: '700' },
  saveBadge: { backgroundColor: '#22C55E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  saveBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },

  planCard: { marginHorizontal: 20, marginBottom: 12, borderRadius: 20, padding: 16 },
  inlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  inlineBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },

  planHeader: { flexDirection: 'row', alignItems: 'center' },
  planIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 18, fontWeight: '800' },
  trialHint: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  priceBlock: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, marginRight: 12 },
  planPrice: { fontSize: 22, fontWeight: '900' },
  planPeriod: { fontSize: 12, paddingBottom: 3 },

  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },

  featureList: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.15)', gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, fontWeight: '500' },

  ctaBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  ctaBtnText: { fontSize: 17, fontWeight: '800', color: '#FFF', letterSpacing: 0.2, fontFamily: 'Inter-Bold' },

  laterBtn: { alignItems: 'center', paddingVertical: 14 },
  laterText: { fontSize: 13, fontWeight: '600', opacity: 0.5 },
  disclaimer: { textAlign: 'center', fontSize: 11, paddingHorizontal: 32, lineHeight: 16 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  legalLink: { fontSize: 12, textDecorationLine: 'underline' },
});
