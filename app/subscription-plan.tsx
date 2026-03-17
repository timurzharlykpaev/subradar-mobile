import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useBillingStatus, useStartTrial } from '../src/hooks/useBilling';
import { billingApi } from '../src/api/billing';
import { useTheme } from '../src/theme';

const PLAN_NAME: Record<string, string> = { free: 'Free', pro: 'Pro', organization: 'Team' };
const PLAN_PRICE: Record<string, Record<string, string>> = {
  free:         { monthly: '$0',     yearly: '$0' },
  pro:          { monthly: '$2.99/мес', yearly: '$24.99/год' },
  organization: { monthly: '$9.99/мес', yearly: '$79.99/год' },
};

export default function SubscriptionPlanScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: billing, isLoading } = useBillingStatus();
  const startTrialMutation = useStartTrial();
  const [billing_period, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

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

  const bg = colors.background;
  const card = isDark ? '#1C1C2E' : '#FFFFFF';

  const plan = billing?.plan ?? 'free';
  const isPro = plan === 'pro' || plan === 'organization';
  const isTrialing = billing?.status === 'trialing';
  const canTrial = billing && !billing.trialUsed && !isPro && !isTrialing;
  const features: string[] = t(`subscription_plan.feat_${plan === 'organization' ? 'org' : plan}`, { returnObjects: true }) as string[] ?? [];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('subscription_plan.my_subscription')}</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Billing period toggle */}
        <View style={[styles.periodToggle, { backgroundColor: card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.periodBtn, billing_period === 'monthly' && { backgroundColor: colors.primary }]}
            onPress={() => setBillingPeriod('monthly')}
          >
            <Text style={[styles.periodBtnText, { color: billing_period === 'monthly' ? '#FFF' : colors.textSecondary }]}>
              {t('subscription_plan.billing_monthly')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, billing_period === 'yearly' && { backgroundColor: colors.primary }]}
            onPress={() => setBillingPeriod('yearly')}
          >
            <Text style={[styles.periodBtnText, { color: billing_period === 'yearly' ? '#FFF' : colors.textSecondary }]}>
              {t('subscription_plan.billing_yearly')}
            </Text>
            {billing_period === 'yearly' && (
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>{t('subscription_plan.save_badge')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Current plan card */}
        <View style={[styles.planCard, { backgroundColor: colors.primary }]}>
          <View style={styles.planCardRow}>
            <View>
              <Text style={styles.planCardLabel}>{t('subscription_plan.current_plan')}</Text>
              <Text style={styles.planCardName}>{PLAN_NAME[plan] ?? plan}</Text>
              {isTrialing && (
                <View style={styles.trialBadge}>
                  <Ionicons name="time-outline" size={12} color="#FFF" />
                  <Text style={styles.trialBadgeText}>
                    {t('subscription_plan.trial_active', { days: billing?.trialDaysLeft ?? 0 })}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.planCardPrice}>{PLAN_PRICE[plan]?.[billing_period] ?? ''}</Text>
              {isPro && !isTrialing && (
                <View style={styles.activeBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                  <Text style={styles.activeBadgeText}>{t('subscription_plan.active')}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Usage */}
          <View style={styles.usageRow}>
            <View style={styles.usageItem}>
              <Text style={styles.usageValue}>
                {billing?.subscriptionCount ?? 0}/{billing?.subscriptionLimit == null ? '∞' : billing.subscriptionLimit}
              </Text>
              <Text style={styles.usageLabel}>{t('subscription_plan.subs_used')}</Text>
            </View>
            <View style={styles.usageDivider} />
            <View style={styles.usageItem}>
              <Text style={styles.usageValue}>
                {billing?.aiRequestsUsed ?? 0}/{billing?.aiRequestsLimit ?? 5}
              </Text>
              <Text style={styles.usageLabel}>{t('subscription_plan.ai_used')}</Text>
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={[styles.section, { backgroundColor: card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('subscription_plan.included')}</Text>
          {Array.isArray(features) && features.map((f: string) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>

          {canTrial && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handleStartTrial}
              disabled={startTrialMutation.isPending}
            >
              {startTrialMutation.isPending ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Ionicons name="star-outline" size={18} color="#FFF" />
                  <Text style={styles.actionBtnText}>{t('subscription_plan.start_trial')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {plan !== 'organization' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/paywall' as any)}
            >
              <Ionicons name="arrow-up-circle-outline" size={18} color="#FFF" />
              <Text style={styles.actionBtnText}>
                {plan === 'free' ? t('subscription_plan.upgrade_pro') : t('subscription_plan.upgrade_team')}
              </Text>
            </TouchableOpacity>
          )}

          {plan === 'organization' && (
            <View style={[styles.actionBtn, { backgroundColor: colors.surface, opacity: 0.6 }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>{t('subscription_plan.max_plan')}</Text>
            </View>
          )}

          {isPro && !isTrialing && (
            <TouchableOpacity
              style={[styles.actionBtnOutline, { borderColor: '#EF4444' }]}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <ActivityIndicator color="#EF4444" /> : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>{t('subscription_plan.cancel_sub')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isTrialing && (
            <TouchableOpacity
              style={[styles.actionBtnOutline, { borderColor: colors.border }]}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <ActivityIndicator color={colors.textMuted} /> : (
                <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>{t('subscription_plan.cancel_trial')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {t('subscription_plan.disclaimer')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  periodToggle: { flexDirection: 'row', margin: 20, marginBottom: 12, borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  periodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  periodBtnText: { fontSize: 14, fontWeight: '700' },
  saveBadge: { backgroundColor: '#22C55E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  saveBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  planCard: { marginHorizontal: 20, marginBottom: 12, borderRadius: 20, padding: 20, gap: 16 },
  planCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 4 },
  planCardName: { fontSize: 28, fontWeight: '900', color: '#FFF' },
  planCardPrice: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  trialBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  trialBadgeText: { fontSize: 11, color: '#FFF', fontWeight: '700' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  activeBadgeText: { fontSize: 11, color: '#22C55E', fontWeight: '700' },
  usageRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12 },
  usageItem: { flex: 1, alignItems: 'center', gap: 2 },
  usageDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  usageValue: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  usageLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  section: { marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, fontWeight: '500' },
  actions: { paddingHorizontal: 20, gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16 },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5 },
  actionBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 20, paddingHorizontal: 32, lineHeight: 18 },
});
