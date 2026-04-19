import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffectiveAccess } from '../src/hooks/useEffectiveAccess';
import { billingApi } from '../src/api/billing';
import { useTheme } from '../src/theme';
import CancellationInterceptModal from '../src/components/CancellationInterceptModal';
import { BannerRenderer } from '../src/components/BannerRenderer';
import { useSubscriptionsStore } from '../src/stores/subscriptionsStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { analytics } from '../src/services/analytics';

const PLAN_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  free:         { name: 'Free',  icon: 'leaf-outline',    color: '#6B7280' },
  pro:          { name: 'Pro',   icon: 'diamond-outline', color: '#8B5CF6' },
  organization: { name: 'Team',  icon: 'people-outline',  color: '#06B6D4' },
};

const PRICES: Record<string, Record<string, string>> = {
  free:         { monthly: '$0',     yearly: '$0' },
  pro:          { monthly: '$2.99',  yearly: '$24.99' },
  organization: { monthly: '$9.99',  yearly: '$79.99' },
};

export default function SubscriptionPlanScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const access = useEffectiveAccess();
  const isLoading = !access;
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
  const currencySymbol = useSettingsStore((s) => s.currency === 'RUB' ? '₽' : s.currency === 'EUR' ? '€' : s.currency === 'GBP' ? '£' : '$');

  // Personalised yearly savings = monthly_price*12 - yearly_price (Pro only)
  const yearlySavings = React.useMemo(() => {
    if (access?.plan !== 'pro') return 0;
    // Default prices fallback; real prices may be injected via RC offerings later
    const monthlyTotal = 2.99 * 12;
    const yearly = 24.99;
    return Math.max(0, Math.round(monthlyTotal - yearly));
  }, [access?.plan]);

  // Sync billing period from API response
  useEffect(() => {
    if (access?.billingPeriod === 'yearly' || access?.billingPeriod === 'monthly') {
      setBillingPeriod(access.billingPeriod);
    }
  }, [access?.billingPeriod]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      Alert.alert(
        t('subscription_plan.cancelled_title'),
        t('subscription_plan.cancelled_msg'),
        [{ text: 'OK', onPress: () => router.replace('/(tabs)' as any) }]
      );
    },
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message || ''),
  });

  const handleCancel = () => {
    // Gate cancel behind intercept modal — retention offer + reason capture.
    // If user is trialing, skip to native confirm (don't interrupt trial cancel).
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = (reason?: string) => {
    setCancelModalVisible(false);
    if (reason) {
      analytics.track('subscription_cancelled', { plan: access?.plan ?? 'free', reason });
    }
    cancelMutation.mutate();
  };

  const handleStartTrial = () => {
    router.push('/paywall' as any);
  };

  // `cancel_at_period_end` keeps Pro features until the period ends.
  // We surface that as still-Pro in the UI while showing the cancel warning.
  const rawPlan = access?.plan ?? 'free';
  const isCancelled = access?.state === 'cancel_at_period_end';
  const plan = rawPlan;
  const isPro = access?.isPro ?? false;
  const isTeam = plan === 'organization';
  const isTrialing = access?.source === 'trial';
  const canTrial = access?.actions.canStartTrial ?? false;
  const display = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.free;
  const features: string[] = t(`subscription_plan.feat_${plan === 'organization' ? 'org' : plan}`, { returnObjects: true }) as string[] ?? [];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const subsUsed = access?.limits.subscriptions.used ?? 0;
  const subsLimit = access?.limits.subscriptions.limit ?? null;
  const aiUsed = access?.limits.aiRequests.used ?? 0;
  const aiLimit = access?.limits.aiRequests.limit ?? null;
  const subsPercent = subsLimit ? Math.min((subsUsed / subsLimit) * 100, 100) : 0;
  const aiPercent = aiLimit ? Math.min((aiUsed / aiLimit) * 100, 100) : 0;

  // Plan card renderer
  const renderPlanCard = (planKey: string, isCurrent: boolean) => {
    const d = PLAN_DISPLAY[planKey] ?? PLAN_DISPLAY.free;
    const price = PRICES[planKey]?.[billingPeriod] ?? '$0';
    const featKey = planKey === 'organization' ? 'org' : planKey;
    const feats: string[] = t(`subscription_plan.feat_${featKey}`, { returnObjects: true }) as string[] ?? [];

    return (
      <View style={[styles.planCard, {
        backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF',
        borderColor: isCurrent ? d.color : colors.border,
        borderWidth: isCurrent ? 2 : 1,
      }]}>
        <View style={styles.planCardHeader}>
          <View style={[styles.planIconWrap, { backgroundColor: d.color + '20' }]}>
            <Ionicons name={d.icon as any} size={20} color={d.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.planCardName, { color: colors.text }]}>{d.name}</Text>
              {isCurrent && (
                <View style={[styles.currentBadge, { backgroundColor: d.color }]}>
                  <Text style={styles.currentBadgeText}>
                    {t('subscription_plan.current_plan')}
                    {planKey !== 'free' ? ` · ${access?.billingPeriod === 'yearly' ? t('paywall.year', 'yr') : t('paywall.month', 'mo')}` : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.planCardPrice, { color: d.color }]}>{price}</Text>
            {planKey !== 'free' && (
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                /{billingPeriod === 'monthly' ? t('paywall.month', 'mo') : t('paywall.year', 'yr')}
              </Text>
            )}
          </View>
        </View>

        {/* Features */}
        {Array.isArray(feats) && feats.map((f: string, i: number) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
          </View>
        ))}

        {/* Action */}
        {planKey !== 'free' && (
          (() => {
            // On yearly tab: always show "Switch to Yearly" even if already on this plan monthly
            const isYearlyUpgrade = isCurrent && billingPeriod === 'yearly';
            if (!isCurrent || isYearlyUpgrade) {
              return (
                <TouchableOpacity
                  style={[styles.planCardBtn, { backgroundColor: d.color }]}
                  onPress={() => router.push('/paywall' as any)}
                >
                  <Text style={styles.planCardBtnText}>
                    {isYearlyUpgrade
                      ? t('paywall.switch_to_yearly', 'Switch to Yearly →')
                      : t('subscription_plan.upgrade_to', { plan: d.name })}
                  </Text>
                </TouchableOpacity>
              );
            }
            return null;
          })()
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('subscription_plan.my_subscription')}</Text>
          <View style={{ width: 38 }} />
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>

          <BannerRenderer />

          {/* Plan hero card */}
          <View style={[styles.heroCard, { backgroundColor: display.color }]}>
            <View style={[styles.heroDecor, styles.heroDecor1]} />
            <View style={[styles.heroDecor, styles.heroDecor2]} />

            <View style={styles.heroTop}>
              <View>
                <View style={styles.heroLabelRow}>
                  <Ionicons name={display.icon as any} size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroLabel}>{t('subscription_plan.current_plan')}</Text>
                </View>
                <Text style={styles.heroName}>{display.name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.heroPrice}>{PRICES[plan]?.[access?.billingPeriod || 'monthly'] ?? '$0'}</Text>
                {plan !== 'free' && (
                  <Text style={styles.heroPeriod}>
                    /{access?.billingPeriod === 'yearly' ? t('paywall.year', 'yr') : t('paywall.month', 'mo')}
                  </Text>
                )}
              </View>
            </View>

            {/* Status badges */}
            <View style={styles.heroBadges}>
              {isTrialing && (
                <View style={styles.heroBadge}>
                  <Ionicons name="time-outline" size={12} color="#FFF" />
                  <Text style={styles.heroBadgeText}>
                    {(() => {
                      const trialDays = access?.trialEndsAt
                        ? Math.max(0, Math.ceil((access.trialEndsAt.getTime() - Date.now()) / 86_400_000))
                        : 0;
                      return t('subscription_plan.trial_active', { days: trialDays });
                    })()}
                  </Text>
                </View>
              )}
              {isCancelled && access?.currentPeriodEnd && (
                <View style={[styles.heroBadge, { backgroundColor: 'rgba(239,68,68,0.25)' }]}>
                  <Ionicons name="close-circle-outline" size={12} color="#FCA5A5" />
                  <Text style={styles.heroBadgeText}>
                    {t('subscription_plan.cancelled_until', {
                      date: access.currentPeriodEnd.toLocaleDateString(),
                      defaultValue: `Отменено · до ${access.currentPeriodEnd.toLocaleDateString()}`,
                    })}
                  </Text>
                </View>
              )}
              {isCancelled && !access?.currentPeriodEnd && (
                <View style={[styles.heroBadge, { backgroundColor: 'rgba(239,68,68,0.25)' }]}>
                  <Ionicons name="close-circle-outline" size={12} color="#FCA5A5" />
                  <Text style={styles.heroBadgeText}>{t('subscription_plan.cancelled_badge', 'Отменено')}</Text>
                </View>
              )}
              {isPro && !isTrialing && !isCancelled && (
                <View style={[styles.heroBadge, { backgroundColor: 'rgba(34,197,94,0.25)' }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#4ADE80" />
                  <Text style={styles.heroBadgeText}>{t('subscription_plan.active')}</Text>
                </View>
              )}
              {canTrial && (
                <View style={[styles.heroBadge, { backgroundColor: 'rgba(139,92,246,0.35)' }]}>
                  <Ionicons name="star-outline" size={12} color="#DDD6FE" />
                  <Text style={styles.heroBadgeText}>{t('paywall.free_7_days', '7 days free')}</Text>
                </View>
              )}
            </View>

            {/* Usage bars */}
            <View style={styles.usageSection}>
              <View style={styles.usageItem}>
                <View style={styles.usageHeader}>
                  <Text style={styles.usageLabel}>{t('subscription_plan.subs_used')}</Text>
                  <Text style={styles.usageValue}>{subsUsed}/{subsLimit == null ? '∞' : subsLimit}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${subsLimit ? subsPercent : 0}%`, backgroundColor: subsPercent >= 90 ? '#F87171' : 'rgba(255,255,255,0.8)' }]} />
                </View>
              </View>
              <View style={styles.usageItem}>
                <View style={styles.usageHeader}>
                  <Text style={styles.usageLabel}>{t('subscription_plan.ai_used')}</Text>
                  <Text style={styles.usageValue}>{aiUsed}/{aiLimit ?? '∞'}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${aiPercent}%`, backgroundColor: aiPercent >= 90 ? '#F87171' : 'rgba(255,255,255,0.8)' }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Billing period toggle — always visible */}
          <View style={[styles.periodToggle, { backgroundColor: isDark ? '#1C1C2E' : '#F0EFF8', borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.periodBtn, billingPeriod === 'monthly' && { backgroundColor: colors.primary }]}
              onPress={() => setBillingPeriod('monthly')}
            >
              <Text style={[styles.periodText, { color: billingPeriod === 'monthly' ? '#FFF' : colors.textSecondary }]}>
                {t('subscription_plan.billing_monthly')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodBtn, billingPeriod === 'yearly' && { backgroundColor: colors.primary }]}
              onPress={() => setBillingPeriod('yearly')}
            >
              <Text style={[styles.periodText, { color: billingPeriod === 'yearly' ? '#FFF' : colors.textSecondary }]}>
                {t('subscription_plan.billing_yearly')}
              </Text>
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>{t('subscription_plan.save_badge')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* All plan cards */}
          <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
            {renderPlanCard('free', plan === 'free')}
            {renderPlanCard('pro', plan === 'pro')}
            {renderPlanCard('organization', plan === 'organization')}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            {canTrial && (
              <TouchableOpacity
                style={[styles.actionPrimary, { backgroundColor: '#8B5CF6' }]}
                onPress={handleStartTrial}
              >
                <Ionicons name="star" size={18} color="#FFF" />
                <Text style={styles.actionPrimaryText}>{t('subscription_plan.upgrade_pro')}</Text>
              </TouchableOpacity>
            )}

            {isPro && !isTrialing && !isCancelled && (
              <TouchableOpacity
                style={[styles.actionOutline, { borderColor: '#EF444440' }]}
                onPress={handleCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? <ActivityIndicator color="#EF4444" /> : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                    <Text style={[styles.actionOutlineText, { color: '#EF4444' }]}>{t('subscription_plan.cancel_sub')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {isCancelled && access?.currentPeriodEnd && (
              <View style={[styles.cancelledNotice, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.cancelledNoticeText, { color: colors.textMuted }]}>
                  {t('subscription_plan.access_until', {
                    date: access.currentPeriodEnd.toLocaleDateString(),
                    defaultValue: `Доступ сохраняется до ${access.currentPeriodEnd.toLocaleDateString()}`,
                  })}
                </Text>
              </View>
            )}

            {isTrialing && (
              <TouchableOpacity
                style={[styles.actionOutline, { borderColor: colors.border }]}
                onPress={handleCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? <ActivityIndicator color={colors.textMuted} /> : (
                  <Text style={[styles.actionOutlineText, { color: colors.textMuted }]}>{t('subscription_plan.cancel_trial')}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            {t('subscription_plan.disclaimer')}
          </Text>

        </Animated.View>
      </ScrollView>

      <CancellationInterceptModal
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        onConfirmCancel={handleConfirmCancel as any}
        context={isTrialing ? 'trial' : (access?.billingPeriod === 'yearly' ? 'yearly' : 'monthly')}
        yearlySavings={yearlySavings}
        currencySymbol={currencySymbol}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  heroCard: {
    marginHorizontal: 20, borderRadius: 24, padding: 22, gap: 16, overflow: 'hidden',
    shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  heroDecor: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroDecor1: { width: 160, height: 160, top: -60, right: -40 },
  heroDecor2: { width: 100, height: 100, bottom: -30, left: -20 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroName: { fontSize: 32, fontWeight: '900', color: '#FFF' },
  heroPrice: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  heroPeriod: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  heroBadges: { flexDirection: 'row', gap: 8 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  heroBadgeText: { fontSize: 11, color: '#FFF', fontWeight: '700' },

  usageSection: { gap: 10 },
  usageItem: { gap: 4 },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  usageLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  usageValue: { fontSize: 12, color: '#FFF', fontWeight: '800' },
  progressTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  periodToggle: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  periodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  periodText: { fontSize: 14, fontWeight: '700' },
  saveBadge: { backgroundColor: '#22C55E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  saveBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },

  // Plan cards
  planCard: { borderRadius: 20, padding: 18, gap: 10 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  currentBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF', textTransform: 'uppercase' },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planCardName: { fontSize: 20, fontWeight: '900' },
  planCardPrice: { fontSize: 22, fontWeight: '900' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14, fontWeight: '500', flex: 1 },
  planCardBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  planCardBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  actions: { paddingHorizontal: 20, marginTop: 20, gap: 10 },
  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16,
    shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  actionPrimaryText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  actionOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5 },
  cancelledNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1 },
  cancelledNoticeText: { fontSize: 13, flex: 1, lineHeight: 18 },
  actionOutlineText: { fontSize: 15, fontWeight: '700' },

  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 24, paddingHorizontal: 32, lineHeight: 18 },
});
