import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/theme';
import { useBillingStatus, useStartTrial } from '../src/hooks/useBilling';
import { useQueryClient } from '@tanstack/react-query';

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
  const [selected, setSelected] = useState('pro');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const { data: billing, isLoading: billingLoading } = useBillingStatus();
  const startTrialMutation = useStartTrial();
  const queryClient = useQueryClient();

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

  const isPro = billing?.plan === 'pro' || billing?.plan === 'organization';
  const isTrialing = billing?.status === 'trialing';
  const canTrial = billing && !billing.trialUsed && !isPro && !isTrialing;

  const getPrice = (planId: string) => {
    if (planId === 'free') return { price: '$0', period: '' };
    if (planId === 'pro') {
      return billingPeriod === 'yearly'
        ? { price: '$24.99', period: `/${t('paywall.year', 'yr')}` }
        : { price: '$2.99', period: `/${t('paywall.month', 'mo')}` };
    }
    return billingPeriod === 'yearly'
      ? { price: '$79.99', period: `/${t('paywall.year', 'yr')}` }
      : { price: '$9.99', period: `/${t('paywall.month', 'mo')}` };
  };

  const handleAction = async () => {
    if (selected === 'free') { router.back(); return; }

    if (selected === 'pro' && canTrial) {
      try {
        await startTrialMutation.mutateAsync();
        await queryClient.invalidateQueries({ queryKey: ['billing'] });
        Alert.alert(
          t('subscription_plan.trial_activated'),
          t('subscription_plan.trial_activated_msg'),
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } catch (e: any) {
        Alert.alert(t('common.error'), e?.response?.data?.message || '');
      }
      return;
    }

    const currentMatch =
      (selected === 'pro' && billing?.plan === 'pro') ||
      (selected === 'org' && billing?.plan === 'organization');
    if (currentMatch && !isTrialing) return;

    router.replace('/subscription-plan' as any);
  };

  const isLoading = startTrialMutation.isPending || billingLoading;

  const getButtonLabel = () => {
    if (selected === 'free') return t('paywall.continue_free');
    if (canTrial && selected === 'pro') return `${t('subscription_plan.start_trial')} →`;
    const currentMatch =
      (selected === 'pro' && billing?.plan === 'pro') ||
      (selected === 'org' && billing?.plan === 'organization');
    if (currentMatch && !isTrialing) return `${t('subscription_plan.active')} ✓`;
    if (selected === 'org') return t('subscription_plan.upgrade_team');
    return t('subscription_plan.upgrade_pro');
  };

  const isCurrentPlan = (planId: string) => {
    if (planId === 'free' && !isPro) return true;
    if (planId === 'pro' && billing?.plan === 'pro') return true;
    if (planId === 'org' && billing?.plan === 'organization') return true;
    return false;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>

        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <View style={[styles.closeBtnCircle, { backgroundColor: colors.surface2 }]}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="diamond" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{t('paywall.choose_plan')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {canTrial ? t('paywall.subtitle_trial') : t('paywall.subtitle_no_trial')}
          </Text>
        </Animated.View>

        {/* Trial status badge */}
        {isTrialing && (
          <View style={[styles.statusBadge, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
            <Ionicons name="time" size={16} color="#F59E0B" />
            <Text style={[styles.statusText, { color: '#F59E0B' }]}>
              {t('subscription_plan.trial_active', { days: billing?.trialDaysLeft ?? 0 })}
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
        <View style={[styles.periodToggle, { backgroundColor: isDark ? '#1C1C2E' : '#F0EFF8' }]}>
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
              <Text style={styles.saveBadgeText}>-30%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Plan cards */}
        {PLANS.map((plan, index) => {
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
                    backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF',
                    borderColor: isSelected ? plan.color : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                  isSelected && { shadowColor: plan.color, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6 },
                ]}
                onPress={() => setSelected(plan.id)}
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
                      {plan.id === 'pro' && !isCurrent && (
                        <View style={[styles.inlineBadge, { backgroundColor: plan.color }]}>
                          <Text style={styles.inlineBadgeText}>{t('paywall.most_popular')}</Text>
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
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            { backgroundColor: selected === 'free' ? colors.textSecondary : (PLANS.find(p => p.id === selected)?.color ?? colors.primary) },
          ]}
          onPress={handleAction}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.ctaBtnText}>{getButtonLabel()}</Text>
          )}
        </TouchableOpacity>

        {/* Secondary action */}
        <TouchableOpacity style={styles.laterBtn} onPress={() => router.back()}>
          <Text style={[styles.laterText, { color: colors.textMuted }]}>{t('paywall.maybe_later')}</Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {canTrial ? t('paywall.free_trial_disclaimer') : t('paywall.paid_disclaimer')}
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: { alignSelf: 'flex-end', padding: 16 },
  closeBtnCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  header: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20, gap: 8 },
  headerIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginBottom: 16, padding: 10, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 13, fontWeight: '700' },

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
    paddingVertical: 18,
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  ctaBtnText: { fontSize: 17, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },

  laterBtn: { alignItems: 'center', paddingVertical: 14 },
  laterText: { fontSize: 15, fontWeight: '600' },
  disclaimer: { textAlign: 'center', fontSize: 11, paddingHorizontal: 32, lineHeight: 16 },
});
