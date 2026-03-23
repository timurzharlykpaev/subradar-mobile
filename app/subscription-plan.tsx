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
import { useBillingStatus, useStartTrial } from '../src/hooks/useBilling';
import { billingApi } from '../src/api/billing';
import { useTheme } from '../src/theme';

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
  const { data: billing, isLoading } = useBillingStatus();
  const startTrialMutation = useStartTrial();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      Alert.alert(t('subscription_plan.cancelled_title'), t('subscription_plan.cancelled_msg'));
    },
    onError: (e: any) => Alert.alert(t('common.error'), e?.response?.data?.message || ''),
  });

  const handleCancel = () => {
    Alert.alert(
      t('subscription_plan.cancel_confirm_title'),
      t('subscription_plan.cancel_confirm_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('subscription_plan.cancel_sub'), style: 'destructive', onPress: () => cancelMutation.mutate() },
      ]
    );
  };

  const handleStartTrial = async () => {
    try {
      await startTrialMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      Alert.alert(t('subscription_plan.trial_activated'), t('subscription_plan.trial_activated_msg'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || '');
    }
  };

  const plan = billing?.plan ?? 'free';
  const isPro = plan === 'pro' || plan === 'organization';
  const isTrialing = billing?.status === 'trialing';
  const canTrial = billing && !billing.trialUsed && !isPro && !isTrialing;
  const display = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.free;
  const features: string[] = t(`subscription_plan.feat_${plan === 'organization' ? 'org' : plan}`, { returnObjects: true }) as string[] ?? [];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const subsUsed = billing?.subscriptionCount ?? 0;
  const subsLimit = billing?.subscriptionLimit; // null = unlimited
  const aiUsed = billing?.aiRequestsUsed ?? 0;
  const aiLimit = billing?.aiRequestsLimit; // null = unlimited
  const subsPercent = subsLimit ? Math.min((subsUsed / subsLimit) * 100, 100) : 0;
  const aiPercent = aiLimit ? Math.min((aiUsed / aiLimit) * 100, 100) : 0;

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

          {/* Plan hero card */}
          <View style={[styles.heroCard, { backgroundColor: display.color }]}>
            {/* Decorative circles */}
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
                <Text style={styles.heroPrice}>{PRICES[plan]?.[billingPeriod] ?? '$0'}</Text>
                {billingPeriod === 'monthly' && plan !== 'free' && (
                  <Text style={styles.heroPeriod}>/{t('paywall.month', 'mo')}</Text>
                )}
                {billingPeriod === 'yearly' && plan !== 'free' && (
                  <Text style={styles.heroPeriod}>/{t('paywall.year', 'yr')}</Text>
                )}
              </View>
            </View>

            {/* Status badges */}
            <View style={styles.heroBadges}>
              {isTrialing && (
                <View style={styles.heroBadge}>
                  <Ionicons name="time-outline" size={12} color="#FFF" />
                  <Text style={styles.heroBadgeText}>
                    {t('subscription_plan.trial_active', { days: billing?.trialDaysLeft ?? 0 })}
                  </Text>
                </View>
              )}
              {isPro && !isTrialing && (
                <View style={[styles.heroBadge, { backgroundColor: 'rgba(34,197,94,0.25)' }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#4ADE80" />
                  <Text style={styles.heroBadgeText}>{t('subscription_plan.active')}</Text>
                </View>
              )}
            </View>

            {/* Usage bars */}
            <View style={styles.usageSection}>
              <View style={styles.usageItem}>
                <View style={styles.usageHeader}>
                  <Text style={styles.usageLabel}>{t('subscription_plan.subs_used')}</Text>
                  <Text style={styles.usageValue}>
                    {subsUsed}/{subsLimit == null ? '∞' : subsLimit}
                  </Text>
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

          {/* Billing period toggle */}
          {plan !== 'free' && (
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
          )}

          {/* Features card */}
          <View style={[styles.featuresCard, { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF', borderColor: colors.border }]}>
            <Text style={[styles.featuresTitle, { color: colors.text }]}>
              {t('subscription_plan.included')}
            </Text>
            {Array.isArray(features) && features.map((f: string, i: number) => (
              <View key={i} style={styles.featureRow}>
                <View style={[styles.featureCheck, { backgroundColor: '#22C55E18' }]}>
                  <Ionicons name="checkmark" size={14} color="#22C55E" />
                </View>
                <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>

            {canTrial && (
              <TouchableOpacity
                style={[styles.actionPrimary, { backgroundColor: '#8B5CF6' }]}
                onPress={handleStartTrial}
                disabled={startTrialMutation.isPending}
              >
                {startTrialMutation.isPending ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="star" size={18} color="#FFF" />
                    <Text style={styles.actionPrimaryText}>{t('subscription_plan.start_trial')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {plan !== 'organization' && (
              <TouchableOpacity
                style={[styles.actionPrimary, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/paywall' as any)}
              >
                <Ionicons name="arrow-up-circle" size={18} color="#FFF" />
                <Text style={styles.actionPrimaryText}>
                  {plan === 'free' ? t('subscription_plan.upgrade_pro') : t('subscription_plan.upgrade_team')}
                </Text>
              </TouchableOpacity>
            )}

            {plan === 'organization' && (
              <View style={[styles.actionDisabled, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={[styles.actionDisabledText, { color: colors.primary }]}>{t('subscription_plan.max_plan')}</Text>
              </View>
            )}

            {isPro && !isTrialing && (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  heroCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 22,
    gap: 16,
    overflow: 'hidden',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
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

  featuresCard: { marginHorizontal: 20, marginTop: 16, borderRadius: 20, padding: 18, borderWidth: 1, gap: 12 },
  featuresTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureCheck: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, fontWeight: '500' },

  actions: { paddingHorizontal: 20, marginTop: 20, gap: 10 },
  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16,
    shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  actionPrimaryText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  actionDisabled: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16 },
  actionDisabledText: { fontSize: 16, fontWeight: '800' },
  actionOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5 },
  actionOutlineText: { fontSize: 15, fontWeight: '700' },

  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 24, paddingHorizontal: 32, lineHeight: 18 },
});
