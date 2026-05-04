import React, { useEffect, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Image,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { SafeLinearGradient as LinearGradient } from '../../src/components/SafeLinearGradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { subscriptionsApi } from '../../src/api/subscriptions';
import { analyticsApi } from '../../src/api/analytics';
import { useBillingStatus } from '../../src/hooks/useBilling';
import { useQueryClient } from '@tanstack/react-query';
import { reconcileBillingDrift } from '../../src/utils/reconcileBillingDrift';
import { CATEGORIES } from '../../src/constants';
import { useTheme, fonts } from '../../src/theme';
import { CategoryIcon } from '../../src/components/icons';
import { WelcomeSheet } from '../../src/components/WelcomeSheet';
import { TrialOfferModal } from '../../src/components/TrialOfferModal';
import { TeamUpsellModal } from '../../src/components/TeamUpsellModal';
import { useUIStore } from '../../src/stores/uiStore';
import { SubIcon } from '../../src/components/SubIcon';
import Svg, { Path as SvgPath, Rect, Text as SvgText } from 'react-native-svg';
import { TeamSavingsBadge } from '../../src/components/TeamSavingsBadge';
import { useAnalysisLatest } from '../../src/hooks/useAnalysis';
import { BannerRenderer } from '../../src/components/BannerRenderer';
import { analytics } from '../../src/services/analytics';
import { parseBackendDate, daysUntilDate } from '../../src/utils/formatters';
import { useEffectiveAccess } from '../../src/hooks/useEffectiveAccess';
import { formatMoney } from '../../src/utils/formatMoney';

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { subscriptions, setSubscriptions } = useSubscriptionsStore();
  const currency = useSettingsStore((s) => s.displayCurrency || s.currency);
  const currencySymbol = React.useMemo(() => {
    try {
      const parts = new Intl.NumberFormat(i18n.language || 'en', { style: 'currency', currency }).formatToParts(0);
      return parts.find((p) => p.type === 'currency')?.value ?? currency;
    } catch {
      return currency;
    }
  }, [currency, i18n.language]);
  const { colors, isDark } = useTheme();
  const { data: billing } = useBillingStatus();
  const access = useEffectiveAccess();
  const { data: analysisLatest } = useAnalysisLatest();
  const aiResult = analysisLatest?.result;
  const queryClient = useQueryClient();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [monthlyTrend, setMonthlyTrend] = React.useState<{ month: string; amount: number }[]>([]);
  const [categoryData, setCategoryData] = React.useState<{ category: string; amount: number }[]>([]);
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [showTrialOffer, setShowTrialOffer] = React.useState(false);
  const [showTeamUpsell, setShowTeamUpsell] = React.useState(false);
  const prevSubsCount = useRef<number | null>(null);


  const fetchSubscriptions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await subscriptionsApi.getAll({ displayCurrency: currency });
      const items = (res.data || []) as Array<{ status: string }>;
      if (__DEV__) {
        const statusCounts: Record<string, number> = {};
        for (const s of items) {
          statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
        }
        console.log('[Home] /subscriptions →', items.length, 'items', statusCounts);
      }
      setSubscriptions(items as any);
    } catch (err: any) {
      if (__DEV__) console.warn('[Home] /subscriptions error:', err?.response?.status, err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const [monthlyRes, categoryRes] = await Promise.all([
        analyticsApi.getMonthly(undefined, { displayCurrency: currency }).catch(() => null),
        analyticsApi.getByCategory({ displayCurrency: currency }).catch(() => null),
      ]);
      if (monthlyRes?.data) {
        const raw = Array.isArray(monthlyRes.data) ? monthlyRes.data : monthlyRes.data.months || [];
        const items = raw.map((d: any) => ({
          month: d.month ?? d.label ?? '',
          amount: Number(d.amount ?? d.total ?? 0),
        })).filter((d: any) => d.month);
        setMonthlyTrend(items.slice(-6));
      }
      if (categoryRes?.data) {
        const raw = Array.isArray(categoryRes.data) ? categoryRes.data : categoryRes.data.categories || [];
        const items = raw.map((d: any) => ({
          category: d.category,
          amount: Number(d.amount ?? d.total ?? 0),
        })).filter((d: any) => d.amount > 0);
        setCategoryData(items.slice(0, 5));
      }
    } catch {}
  };

  useEffect(() => { fetchSubscriptions(); fetchAnalytics(); }, [currency]);

  // Refetch billing when app returns to foreground (e.g. after the user
  // closes Apple Settings → Subscriptions). A bare invalidate refetches
  // /billing/me but that endpoint reads our own DB — if the RC EXPIRATION
  // webhook never arrived, the user keeps seeing the stale "Pro" badge.
  // Running reconcileBillingDrift first asks the backend to verify against
  // RC live and downgrade; only then do we invalidate so the UI picks up
  // the corrected state.
  useEffect(() => {
    const handleAppState = async (next: AppStateStatus) => {
      if (next !== 'active') return;
      try {
        await reconcileBillingDrift();
      } catch {
        /* best-effort — fall through to plain invalidate */
      }
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [queryClient]);

  // Show WelcomeSheet on first visit with no subscriptions
  useEffect(() => {
    if (loading) return;
    if (subscriptions.length === 0 && !useUIStore.getState().addSheetVisible) {
      AsyncStorage.getItem('welcome_shown').then((val) => {
        if (!val) setShowWelcome(true);
      });
    }
  }, [loading, subscriptions.length]);

  // Aha trial trigger — fires when user has invested enough to see value
  // (2nd subscription added per BILLING_RULES.md trial trigger spec).
  useEffect(() => {
    if (loading) return;
    const prev = prevSubsCount.current ?? 0;
    if (prev < 2 && subscriptions.length >= 2) {
      // Bug: previously used `access?.isPro` which is FALSE for Team users
      // (their plan is 'organization'), so paying Team customers were
      // incorrectly offered a trial after adding 2 subs.
      // Fix: any non-free plan disqualifies from trial.
      const hasAnyPaidPlan =
        !!access && (access.plan === 'pro' || access.plan === 'organization');
      if (!hasAnyPaidPlan) {
        AsyncStorage.getItem('trial_offered').then((val) => {
          if (!val) {
            analytics.track('aha_trial_offer_shown', { trigger: 'second_sub' });
            setShowTrialOffer(true);
            AsyncStorage.setItem('trial_offered', '1');
          }
        });
      }
    }
    prevSubsCount.current = subscriptions.length;
  }, [loading, subscriptions.length, access?.plan]);

  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL');
  const trialSubs = subscriptions.filter((s) => s.status === 'TRIAL');
  const cancelledCount = subscriptions.filter((s) => s.status === 'CANCELLED').length;

  const displayValueOf = (s: { displayAmount?: string; amount: number }) =>
    Number(s.displayAmount ?? s.amount) || 0;

  // Use displayCurrency from subscriptions if backend returned it, otherwise original currency
  const effectiveCurrency = activeSubs.length > 0 && activeSubs[0]?.displayCurrency
    ? currency
    : (activeSubs[0]?.currency || currency);

  const totalMonthly = activeSubs.reduce((sum, s) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1 / 3 : s.billingPeriod === 'YEARLY' ? 1 / 12 : 1;
    return sum + displayValueOf(s) * mult;
  }, 0);

  const isDegraded = access?.flags.degradedMode ?? false;
  const hiddenSubsCount = access?.flags.hiddenSubscriptionsCount ?? 0;
  const visibleSubs = isDegraded ? activeSubs.slice(0, 3) : activeSubs;
  const totalMonthlyVisible = visibleSubs.reduce((sum, s) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1/3 : s.billingPeriod === 'YEARLY' ? 1/12 : 1;
    return sum + displayValueOf(s) * mult;
  }, 0);

  // Previous month estimate from trend data. `hasPrevMonth` gates the
  // delta badge — without ≥2 months of history we can't compute a
  // change, so we hide it instead of showing a misleading 0%.
  const prevMonthAmount = monthlyTrend.length >= 2 ? monthlyTrend[monthlyTrend.length - 2]?.amount || 0 : 0;
  const hasPrevMonth = prevMonthAmount > 0;
  const delta = hasPrevMonth ? ((totalMonthly - prevMonthAmount) / prevMonthAmount * 100) : 0;

  // Backend-computed `nextPaymentDate` is the source of truth — refreshed
  // daily server-side + on create/update. Client just parses and sorts.
  const subsWithNext = subscriptions.map((s) => ({ sub: s, next: parseBackendDate(s.nextPaymentDate) }));

  const upcomingNext7 = subsWithNext
    .filter(({ next }) => {
      if (!next) return false;
      const days = daysUntilDate(next);
      return days !== null && days >= 0 && days <= 7;
    })
    .sort((a, b) => a.next!.getTime() - b.next!.getTime())
    .map(({ sub }) => sub);

  const upcomingNext30 = subsWithNext
    .filter(({ next }) => {
      if (!next) return false;
      const days = daysUntilDate(next);
      return days !== null && days >= 0 && days <= 30;
    })
    .map(({ sub }) => sub);
  const forecast30 = upcomingNext30.reduce((sum, s) => sum + displayValueOf(s), 0);

  const duplicateCategories = Object.entries(
    subscriptions.reduce((acc, s) => {
      if (s.status !== 'ACTIVE' && s.status !== 'TRIAL') return acc;
      acc[s.category] = (acc[s.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).filter(([, count]) => count > 1);

  // Show TeamUpsellModal once when Pro user hits a "moment of truth"
  useEffect(() => {
    if (loading) return;
    const isProPlan = access?.plan === 'pro';
    const isOrgPlan = access?.plan === 'organization';
    if (!isProPlan || isOrgPlan) return;

    const duplicateCount = duplicateCategories.length;
    const subsCount = activeSubs.length;
    const triggers = subsCount >= 8 || duplicateCount >= 2 || totalMonthly >= 50;
    if (!triggers) return;

    AsyncStorage.getItem('team_modal_shown_v1').then((val) => {
      if (val) return;
      setShowTeamUpsell(true);
      AsyncStorage.setItem('team_modal_shown_v1', '1');
      AsyncStorage.setItem('team_modal_dismissed_at', new Date().toISOString());
      const trigger = duplicateCount >= 2 ? 'duplicates' : subsCount >= 8 ? 'subs_count' : 'spend';
      analytics.track('team_upsell_modal_shown', { trigger });
    });
  }, [loading, access?.plan, activeSubs.length, duplicateCategories.length, totalMonthly]);

  // Derived UI flags. `cancel_at_period_end` still has Pro access until the
  // period ends — treat it as `isPro = true` in the dashboard header.
  const isPro = access?.isPro ?? false;
  const isTeam = access?.plan === 'organization';
  const planLabel = isTeam ? 'TEAM' : isPro ? 'PRO' : 'FREE';

  if (loading) {
    return (
      <SafeAreaView testID="dashboard-screen-loading" style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="dashboard-screen" edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        testID="dashboard-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubscriptions(true); fetchAnalytics(); queryClient.invalidateQueries({ queryKey: ['billing'] }); }} />
        }
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            onPress={() => router.push('/subscription-plan' as any)}
            activeOpacity={0.7}
            style={[styles.planBadge, { backgroundColor: isPro ? colors.primary + '20' : colors.textMuted + '20' }]}
          >
            <Ionicons name={isPro ? 'diamond' : 'person-outline'} size={12} color={isPro ? colors.primary : colors.textMuted} />
            <Text style={[styles.planBadgeText, { color: isPro ? colors.primary : colors.textMuted }]}>
              {planLabel}
            </Text>
          </TouchableOpacity>
        </View>

        <TeamSavingsBadge />

        {/* Single banner chosen by backend-resolved priority. */}
        <BannerRenderer />

        {/* ── AI Insights Widget ────────────────────────────────── */}
        {aiResult && isPro && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/analytics' as any)}
            activeOpacity={0.7}
            style={{
              marginHorizontal: 20,
              marginTop: 8,
              padding: 16,
              borderRadius: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 10,
              backgroundColor: '#7c3aed' + '15',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="sparkles" size={20} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={2}>
                {aiResult.summary}
              </Text>
              {Number(aiResult.totalMonthlySavings) > 0 && (
                <Text style={{ fontSize: 13, color: '#22c55e', fontWeight: '600', marginTop: 2 }}>
                  {t('dashboard.save_potential', 'Potential savings')}: {formatMoney(aiResult.totalMonthlySavings, currency, i18n.language)}/{t('add_flow.mo', 'mo')}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {!isPro && activeSubs.length >= 3 && (
          <TouchableOpacity
            onPress={() => {
              analytics.paywallViewed('feature_gate');
              router.push('/paywall' as any);
            }}
            activeOpacity={0.7}
            style={{
              marginHorizontal: 20,
              marginTop: 8,
              padding: 14,
              borderRadius: 14,
              backgroundColor: '#7c3aed' + '10',
              borderWidth: 1,
              borderColor: '#7c3aed' + '30',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="sparkles" size={18} color="#7c3aed" />
            <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>
              {t('dashboard.ai_teaser', 'AI can find savings in your subscriptions')}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#7c3aed' }}>
              {t('dashboard.try_pro', 'Try Pro')}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Team Upsell Banner — shown to Pro users with 5+ active subs ── */}
        {isPro && !isTeam && activeSubs.length >= 5 && (
          <TouchableOpacity
            onPress={() => {
              analytics.track('team_upsell_dashboard_card_tapped');
              analytics.paywallViewed('upsell');
              router.push('/paywall' as any);
            }}
            activeOpacity={0.7}
            style={{
              marginHorizontal: 20,
              marginTop: 8,
              padding: 14,
              borderRadius: 14,
              backgroundColor: '#3B82F6' + '10',
              borderWidth: 1,
              borderColor: '#3B82F6' + '30',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="people" size={18} color="#3B82F6" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                {t('team_upsell.dashboard_title')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                {t('team_upsell.dashboard_dynamic', { amount: `${effectiveCurrency} ${Math.round(totalMonthly * 12 * 0.75)}` })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#3B82F6" />
          </TouchableOpacity>
        )}

        {/* ── Hero Card: Total Spend ────────────────────────────── */}
        <LinearGradient
          testID="dashboard-hero-card"
          colors={['#6C47FF', '#4A2FB0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.heroCard, { shadowColor: '#6C47FF', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 }]}
        >
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
          <Text style={styles.heroLabel}>{t('dashboard.total_month')}</Text>
          {/* Amount sits on its own row now. Previously the delta badge
              was inline and got cropped on long-locale currency strings
              (KZT/JPY: "120 000,00 ₸"). Splitting them lets each take
              full width regardless of locale. */}
          <Text style={styles.heroAmount}>
            {formatMoney(totalMonthlyVisible, effectiveCurrency, i18n.language)}
          </Text>
          {hasPrevMonth && Math.abs(delta) >= 1 && (
            // Hide the badge when |delta| < 1% — a flat "0%" doesn't tell
            // the user anything useful and just adds visual noise. Users
            // with stable subs will see no badge (which is correct: there
            // really is no MoM change to show); only meaningful changes
            // surface here.
            <View style={styles.deltaRow}>
              <View style={[styles.deltaBadge, { backgroundColor: delta > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)' }]}>
                <Ionicons name={delta > 0 ? 'arrow-up' : 'arrow-down'} size={11} color={delta > 0 ? '#FCA5A5' : '#86EFAC'} />
                <Text style={[styles.deltaText, { color: delta > 0 ? '#FCA5A5' : '#86EFAC' }]}>
                  {Math.abs(delta).toFixed(0)}%
                </Text>
              </View>
              <Text style={styles.deltaCaption} numberOfLines={1}>
                {t('dashboard.vs_last_month', 'vs last month')}
              </Text>
            </View>
          )}
          {isDegraded && (
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 4 }}>
              {t('team_logic.hero_locked_hint', { count: hiddenSubsCount })}
            </Text>
          )}
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Ionicons name="repeat-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroMetaText}>{activeSubs.length} {t('dashboard.active_subs', 'active subs')}</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroMetaText}>{formatMoney(totalMonthly * 12, effectiveCurrency, i18n.language)}/{t('paywall.year', 'yr')}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Quick Stats ────────────────────────────────────── */}
        <View testID="dashboard-stats-row" style={styles.statsRow}>
          <StatCard icon="checkmark-circle" label={t('subscriptions.active')} value={activeSubs.length} color={colors.success} />
          <StatCard icon="time" label={t('subscriptions.trial')} value={trialSubs.length} color={colors.warning} />
          <StatCard icon="close-circle" label={t('subscriptions.cancelled')} value={cancelledCount} color={colors.error} />
        </View>

        {/* ── Upcoming 7 Days ────────────────────────────────── */}
        {upcomingNext7.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.upcoming_7')}</Text>
              {/* Pill badge — matches the trial section style for visual consistency. */}
              <View style={[styles.sectionCountBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.sectionCountBadgeText, { color: colors.primary }]}>{upcomingNext7.length}</Text>
              </View>
            </View>
            <ScrollView testID="dashboard-upcoming-list" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {upcomingNext7.map((sub) => {
                const days = daysUntilDate(parseBackendDate(sub.nextPaymentDate)) ?? 0;
                const cat = CATEGORIES.find((c) => c.id === sub.category);
                const urgent = days <= 1;
                return (
                  <TouchableOpacity
                    testID={`dashboard-upcoming-${sub.id}`}
                    key={sub.id}
                    style={[styles.upcomingCard, { backgroundColor: colors.card, borderColor: urgent ? colors.warning + '60' : colors.border }]}
                    onPress={() => router.push(`/subscription/${sub.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.upcomingTop}>
                      <CategoryIcon category={sub.category} size={24} />
                      {urgent && <View style={[styles.urgentDot, { backgroundColor: colors.warning }]} />}
                    </View>
                    <Text style={[styles.upcomingName, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                    {/* Auto-shrink for long localized currency strings ("120 000,00 ₸").
                        Without `numberOfLines={1}` the symbol wrapped to a new
                        line and the layout looked broken. */}
                    <Text
                      style={[styles.upcomingAmount, { color: colors.primary }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {formatMoney(sub.displayAmount ?? sub.amount, sub.displayCurrency ?? sub.currency, i18n.language)}
                    </Text>
                    <Text style={[styles.upcomingDays, {
                      fontWeight: days <= 1 ? '700' : '400',
                      color: days === 0 ? '#ef4444' : days === 1 ? '#f59e0b' : colors.textSecondary,
                    }]}>
                      {days === 0 ? t('upcoming.today') : days === 1 ? t('upcoming.tomorrow') : t('upcoming.in_days', { count: days })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Forecast ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.forecast_title')}</Text>
          <View testID="dashboard-forecast-row" style={styles.forecastRow}>
            <ForecastBox icon="calendar" label={t('dashboard.next_30_days')} amount={formatMoney(forecast30, effectiveCurrency, i18n.language)} sub={`${upcomingNext30.length} ${t('dashboard.subscriptions_label')}`} color={colors.primary} />
            <ForecastBox icon="trending-up" label={`6 ${t('paywall.month', 'mo')}`} amount={formatMoney(totalMonthly * 6, effectiveCurrency, i18n.language)} sub={t('dashboard.forecast_title')} color={colors.success} />
            <ForecastBox icon="analytics" label={`12 ${t('paywall.month', 'mo')}`} amount={formatMoney(totalMonthly * 12, effectiveCurrency, i18n.language)} sub={t('dashboard.annually')} color={colors.warning} />
          </View>
        </View>

        {/* ── Trial Tracker ──────────────────────────────────── */}
        {trialSubs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('trials.title')}</Text>
              <View style={[styles.sectionCountBadge, { backgroundColor: colors.warning + '20' }]}>
                <Text style={[styles.sectionCountBadgeText, { color: colors.warning }]}>{trialSubs.length}</Text>
              </View>
            </View>
            {trialSubs.map((sub) => {
              const endDate = parseBackendDate(sub.nextPaymentDate);
              const daysLeft = endDate ? Math.max(0, daysUntilDate(endDate) ?? 0) : null;
              const dotColor = daysLeft === null ? colors.textSecondary : daysLeft < 3 ? colors.error : daysLeft <= 7 ? colors.warning : colors.success;
              return (
                <TouchableOpacity
                  testID={`dashboard-trial-${sub.id}`}
                  key={sub.id}
                  style={[styles.trialCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/subscription/${sub.id}` as any)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.trialDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trialName, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                    <Text style={[styles.trialMeta, { color: colors.textSecondary }]}>
                      {daysLeft !== null
                        ? daysLeft === 0 ? t('trials.ends_today') : daysLeft === 1 ? t('trials.ends_tomorrow') : t('trials.days_left', { count: daysLeft })
                        : t('subscriptions.trial')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.trialPrice, { color: colors.text }]}>{formatMoney(sub.displayAmount ?? sub.amount, sub.displayCurrency ?? sub.currency, i18n.language)}</Text>
                    <Text style={[styles.trialPriceSub, { color: colors.textMuted }]}>{t('trials.then')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Active Subscriptions ──────────────────────────── */}
        {activeSubs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.active_subs_title')}</Text>
              <TouchableOpacity testID="btn-see-all-subs" onPress={() => router.push('/(tabs)/subscriptions')}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>{t('common.all')}</Text>
              </TouchableOpacity>
            </View>
            {activeSubs.slice(0, 4).map((sub) => {
              const cat = CATEGORIES.find((c) => c.id === sub.category);
              return (
                <TouchableOpacity
                  testID={`dashboard-sub-${sub.id}`}
                  key={sub.id}
                  style={[
                    styles.subCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    // Match SubscriptionCard: a 3-pixel coloured stripe on
                    // the leading edge surfaces the user-chosen color even
                    // when the service has an iconUrl (where the
                    // placeholder tint never shows).
                    sub.color ? { borderLeftWidth: 3, borderLeftColor: sub.color } : null,
                  ]}
                  onPress={() => router.push(`/subscription/${sub.id}` as any)}
                  activeOpacity={0.8}
                >
                  <SubIcon
                    iconUrl={sub.iconUrl}
                    name={sub.name}
                    category={sub.category}
                    imageStyle={styles.subIcon}
                    placeholderStyle={[
                      styles.subIconPlaceholder,
                      { backgroundColor: sub.color ? sub.color + '22' : colors.primaryLight },
                    ]}
                    textStyle={[styles.subIconText, { color: sub.color || colors.primary }]}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.subName, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                    <Text style={[styles.subPlan, { color: colors.textSecondary }]} numberOfLines={1}>
                      {sub.category ? t(`categories.${sub.category.toLowerCase()}`, cat?.label || sub.category) : ''}
                    </Text>
                    {sub.tags && sub.tags.length > 0 && (
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                        {sub.tags.filter(Boolean).slice(0, 3).map((tag) => (
                          <Text key={tag} style={{ fontSize: 10, color: colors.textMuted }}>#{tag}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                    <Text style={[styles.subAmount, { color: colors.text }]} numberOfLines={1}>{formatMoney(sub.displayAmount ?? sub.amount, sub.displayCurrency ?? sub.currency, i18n.language)}</Text>
                    <Text style={[styles.subPeriod, { color: colors.textMuted }]}>/{t(`period_short.${(sub.billingPeriod || 'MONTHLY').toUpperCase()}`, sub.billingPeriod)}</Text>
                    {(() => {
                      const nd = parseBackendDate(sub.nextPaymentDate);
                      return nd ? (
                        <Text style={[styles.subNextDate, { color: colors.primary }]} numberOfLines={1}>
                          {nd.toLocaleDateString(i18n.language || 'en', { month: 'short', day: 'numeric' })}
                        </Text>
                      ) : null;
                    })()}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Potential Savings ──────────────────────────────── */}
        {duplicateCategories.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              testID="btn-potential-savings"
              style={[styles.savingsCard, { backgroundColor: isDark ? '#1C2A20' : '#ECFDF5', borderColor: isDark ? '#22543D' : '#A7F3D0' }]}
              onPress={() => router.push('/(tabs)/analytics')}
              activeOpacity={0.8}
            >
              <View style={[styles.savingsIcon, { backgroundColor: isDark ? '#22543D' : '#D1FAE5' }]}>
                <Ionicons name="bulb" size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.savingsTitle, { color: colors.text }]}>{t('dashboard.potential_savings')}</Text>
                <Text style={[styles.savingsSub, { color: colors.textSecondary }]}>
                  {duplicateCategories.length} {t('dashboard.possible_duplicates')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Monthly Trend ─────────────────────────────────── */}
        {monthlyTrend.length > 0 && monthlyTrend.some(d => d.amount > 0) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.monthly_trend')}</Text>
            <View testID="dashboard-monthly-chart" style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MonthlyBarChart data={monthlyTrend} currencySymbol={currencySymbol} />
            </View>
          </View>
        )}

        {/* ── Category Breakdown ─────────────────────────────── */}
        {categoryData.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.by_category')}</Text>
            {categoryData.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
                  {t('dashboard.top_categories', 'Top Categories')}
                </Text>
                {categoryData.slice(0, 3).map((cat, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t(`categories.${cat.category?.toLowerCase()}`, cat.category?.replace('_', ' '))}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                      {formatMoney(cat.amount, effectiveCurrency, i18n.language)}/{t('add_flow.mo', 'mo')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View testID="dashboard-category-chart" style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <CategoryDonut categories={categoryData} />
            </View>
          </View>
        )}

        {/* ── Empty State ────────────────────────────────────── */}
        {subscriptions.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="wallet-outline" size={36} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
              {t('dashboard.empty_title', 'Track your subscriptions')}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              {t('dashboard.empty_desc', 'Add your first subscription to see spending insights, upcoming charges, and AI recommendations.')}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 }}
              onPress={() => {
                try { useUIStore.getState().openAddSheet(); } catch { router.push('/(tabs)/subscriptions' as any); }
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                {t('dashboard.add_first', 'Add Subscription')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Quick Actions ──────────────────────────────────── */}
        <View style={[styles.section, { paddingBottom: 20 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.quick_actions')}</Text>
          <View testID="dashboard-quick-actions" style={styles.actionsRow}>
            <QuickAction icon="add-circle-outline" label={t('dashboard.add_subscription')} onPress={() => useUIStore.getState().openAddSheet()} color={colors.primary} />
            <QuickAction icon="document-text-outline" label={t('dashboard.generate_report')} onPress={() => router.push('/reports')} color={colors.success} />
            {!isPro && (
              <QuickAction icon="diamond-outline" label={t('dashboard.upgrade_pro')} onPress={() => router.push('/paywall')} color={colors.warning} />
            )}
          </View>
        </View>

      </ScrollView>

      <WelcomeSheet
        visible={showWelcome}
        onAddWithAI={() => {
          setShowWelcome(false);
          AsyncStorage.setItem('welcome_shown', '1');
          useUIStore.getState().openAddSheet();
        }}
        onSkip={() => {
          setShowWelcome(false);
          AsyncStorage.setItem('welcome_shown', '1');
        }}
      />

      <TrialOfferModal
        visible={showTrialOffer}
        isPending={false}
        onStartTrial={() => {
          setShowTrialOffer(false);
          analytics.track('trial_cta_tapped', { source: 'modal' });
          router.push('/paywall' as any);
        }}
        onSkip={() => setShowTrialOffer(false)}
      />

      <TeamUpsellModal
        visible={showTeamUpsell}
        monthlySpend={totalMonthly}
        currency={effectiveCurrency}
        onCreateTeam={() => {
          setShowTeamUpsell(false);
          analytics.track('team_upsell_modal_cta_tapped');
          router.push('/paywall' as any);
        }}
        onLater={() => {
          setShowTeamUpsell(false);
          analytics.track('team_upsell_modal_dismissed');
        }}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ForecastBox({ icon, label, amount, sub, color }: { icon: string; label: string; amount: string; sub: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.forecastCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.forecastIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[styles.forecastAmount, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{amount}</Text>
      <Text style={[styles.forecastSub, { color: colors.textMuted }]} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; color: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function MonthlyBarChart({ data, currencySymbol = '$' }: { data: { month: string; amount: number }[]; currencySymbol?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const chartW = screenWidth - 80;
  const chartH = 130;
  const hasData = data.some((d) => Number(d.amount) > 0);
  const maxVal = Math.max(...data.map((d) => Number(d.amount) || 0), 1);
  const barW = Math.max(8, chartW / Math.max(data.length, 1) - 8);

  if (!hasData) {
    return (
      <View style={{ height: chartH + 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('common.no_data_period')}</Text>
      </View>
    );
  }

  return (
    <View>
      <Svg width={chartW} height={chartH + 18}>
        {(() => {
          const values = data.map((d) => Number(d.amount) || 0);
          const allSame = values.every((v) => v === values[0]);
          const topPadding = 24;
          return data.map((d, i) => {
            const val = Number(d.amount) || 0;
            const barH = Math.max(4, (val / maxVal) * (chartH - topPadding));
            const x = i * (chartW / data.length) + (chartW / data.length - barW) / 2;
            const y = chartH - barH + 18;
            const isMax = val === maxVal;
            return (
              <React.Fragment key={i}>
                <Rect x={x} y={y} width={barW} height={barH} rx={5} fill={isMax ? colors.primary : `${colors.primary}55`} />
                {val > 0 && (
                  <SvgText x={x + barW / 2} y={y - 6} fontSize={9} fontWeight="700" fill={isMax ? colors.primary : colors.textMuted} textAnchor="middle">
                    {val >= 1000 ? `${currencySymbol} ${(val / 1000).toFixed(1)}k` : `${currencySymbol} ${val.toFixed(0)}`}
                  </SvgText>
                )}
              </React.Fragment>
            );
          });
        })()}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 6 }}>
        {data.map((d, i) => {
          const monthStr = typeof d.month === 'string' ? d.month : String(d.month || '');
          const parts = monthStr.split('-');
          const monthNum = parts.length >= 2 ? parseInt(parts[1], 10) : parseInt(monthStr, 10);
          const label = t(`months.${monthNum}`, { defaultValue: monthStr });
          return <Text key={i} style={{ fontSize: 10, color: colors.textSecondary }}>{label}</Text>;
        })}
      </View>
    </View>
  );
}

function CategoryDonut({ categories }: { categories: { category: string; amount: number }[] }) {
  const { colors } = useTheme();
  const total = categories.reduce((sum, c) => sum + (isFinite(Number(c.amount)) ? Number(c.amount) : 0), 0);
  if (!total || !isFinite(total)) return null;

  const size = 140;
  const radius = 56;
  const innerRadius = 38;
  const cx = size / 2;
  const cy = size / 2;

  let startAngle = -Math.PI / 2;
  const slices = categories
    .filter((c) => isFinite(Number(c.amount)) && Number(c.amount) > 0)
    .map((cat) => {
      const fraction = Number(cat.amount) / total;
      const sweep = Math.min(fraction, 0.999) * 2 * Math.PI;
      if (!isFinite(sweep) || sweep <= 0) return null;
      const catInfo = CATEGORIES.find((c) => c.id === cat.category);
      const color = catInfo?.color || '#757575';
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(startAngle + sweep);
      const y2 = cy + radius * Math.sin(startAngle + sweep);
      const ix1 = cx + innerRadius * Math.cos(startAngle + sweep);
      const iy1 = cy + innerRadius * Math.sin(startAngle + sweep);
      const ix2 = cx + innerRadius * Math.cos(startAngle);
      const iy2 = cy + innerRadius * Math.sin(startAngle);
      const largeArc = sweep > Math.PI ? 1 : 0;
      const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
      startAngle += sweep;
      return { d, color, categoryId: catInfo?.id || 'OTHER', label: catInfo?.label || cat.category, pct: Math.round(fraction * 100) };
    }).filter(Boolean) as { d: string; color: string; categoryId: string; label: string; pct: number }[];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, idx) => <SvgPath key={idx} d={slice.d} fill={slice.color} />)}
      </Svg>
      <View style={{ flex: 1, gap: 8 }}>
        {slices.map((slice, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: slice.color }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
              <CategoryIcon category={slice.categoryId} size={14} />
              <Text style={{ fontSize: 13, color: colors.text, flex: 1 }} numberOfLines={1}>{slice.label}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>{slice.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  planBadgeText: { fontSize: 11, fontWeight: '800' },

  // Hero card
  heroCard: { marginHorizontal: 20, marginTop: 8, borderRadius: 24, padding: 22, gap: 4, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10, overflow: 'hidden' },
  heroDecor1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -30 },
  heroDecor2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -40, left: -20 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  heroAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroAmount: { fontSize: 36, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  deltaText: { fontSize: 12, fontWeight: '800' },
  deltaCaption: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500', flexShrink: 1 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 10 },
  heroMetaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroMetaDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  statCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1 },
  statIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600' },

  // Section
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionCount: { fontSize: 14, fontWeight: '700' },
  sectionCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sectionCountBadgeText: { fontSize: 12, fontWeight: '800' },
  seeAll: { fontSize: 14, fontWeight: '700' },

  // Upcoming cards
  upcomingCard: { width: 130, borderRadius: 16, padding: 14, marginRight: 10, borderWidth: 1, gap: 4 },
  upcomingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  urgentDot: { width: 8, height: 8, borderRadius: 4 },
  upcomingName: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  upcomingAmount: { fontSize: 15, fontWeight: '800' },
  upcomingDays: { fontSize: 11, fontWeight: '600' },

  // Forecast
  forecastRow: { flexDirection: 'row', gap: 8 },
  forecastCard: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1, alignItems: 'center', gap: 6 },
  forecastIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  forecastAmount: { fontSize: 14, fontWeight: '700' },
  forecastSub: { fontSize: 10, fontWeight: '600' },

  // Trials
  trialCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1 },
  trialDot: { width: 10, height: 10, borderRadius: 5 },
  trialName: { fontSize: 15, fontWeight: '700' },
  trialMeta: { fontSize: 12, marginTop: 2 },
  trialPrice: { fontSize: 14, fontWeight: '700' },
  trialPriceSub: { fontSize: 10 },

  // Active subs
  subCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1 },
  subIcon: { width: 40, height: 40, borderRadius: 12 },
  subIconPlaceholder: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  subIconText: { fontSize: 16, fontWeight: '800' },
  subName: { fontSize: 14, fontWeight: '700' },
  subPlan: { fontSize: 12, marginTop: 1 },
  subAmount: { fontSize: 14, fontWeight: '800' },
  subPeriod: { fontSize: 10 },
  subNextDate: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Savings
  savingsCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, borderWidth: 1 },
  savingsIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  savingsTitle: { fontSize: 14, fontWeight: '700' },
  savingsSub: { fontSize: 12, marginTop: 2 },

  // Charts
  chartCard: { borderRadius: 20, padding: 16, borderWidth: 1 },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText: { fontSize: 18, fontWeight: '700' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
