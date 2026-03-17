import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '',
    popular: false,
    trialDays: 0,
    features: ['3 подписки', '5 AI запросов/мес', 'Базовая аналитика'],
    missing: ['Безлимитные подписки', '200 AI запросов/мес', 'Расширенная аналитика', 'Командный доступ'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$2.99',
    period: '/мес',
    popular: true,
    trialDays: 7,
    features: ['Безлимитные подписки', '200 AI запросов/мес', 'Расширенная аналитика'],
    missing: ['Командный доступ'],
  },
  {
    id: 'org',
    name: 'Team',
    price: '$9.99',
    period: '/мес',
    popular: false,
    trialDays: 0,
    features: ['Безлимитные подписки', '200 AI запросов/мес', 'Расширенная аналитика', 'Командный доступ'],
    missing: [],
  },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState('pro');
  const { data: billing, isLoading: billingLoading } = useBillingStatus();
  const startTrialMutation = useStartTrial();
  const queryClient = useQueryClient();

  const isPro = billing?.plan === 'pro' || billing?.plan === 'organization';
  const isTrialing = billing?.status === 'trialing';
  const canTrial = billing && !billing.trialUsed && !isPro && !isTrialing;

  const handleAction = async () => {
    if (selected === 'free') {
      router.back();
      return;
    }

    if (selected === 'pro' && canTrial) {
      try {
        await startTrialMutation.mutateAsync();
        await queryClient.invalidateQueries({ queryKey: ['billing'] });
        Alert.alert(
          '🎉 Триал активирован!',
          '7 дней Pro-доступа. Пользуйся всеми функциями бесплатно.',
          [{ text: 'Отлично!', onPress: () => router.back() }]
        );
      } catch (e: any) {
        Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось активировать триал');
      }
      return;
    }

    // Already trialing or pro — show info
    if (isPro || isTrialing) {
      Alert.alert(
        'У тебя уже есть Pro',
        isTrialing
          ? `Триал активен. Осталось ${billing?.trialDaysLeft ?? 0} дней.`
          : 'Твой план уже активен.',
        [{ text: 'Ок', onPress: () => router.back() }]
      );
      return;
    }

    // Trial used — show checkout link placeholder
    Alert.alert(
      'Оформить подписку',
      'Для оплаты через App Store — скоро будет доступно. Сейчас можно активировать триал если не использован.',
    );
  };

  const isLoading = startTrialMutation.isPending || billingLoading;
  const selectedPlan = PLANS.find(p => p.id === selected)!;

  const getButtonLabel = () => {
    if (selected === 'free') return 'Продолжить бесплатно';
    if (isPro || isTrialing) return 'У тебя уже Pro ✓';
    if (canTrial && selected === 'pro') return `Начать ${selectedPlan.trialDays}-дневный триал`;
    return `Выбрать ${selectedPlan.name}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Выбери план</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {canTrial ? '7 дней Pro бесплатно • Отмена в любой момент' : 'Разблокируй все возможности SubRadar'}
          </Text>
        </View>

        {/* Current status badge */}
        {(isPro || isTrialing) && (
          <View style={[styles.statusBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.primary }]}>
              {isTrialing ? `Триал активен • осталось ${billing?.trialDaysLeft ?? 0} дн.` : 'Pro активен'}
            </Text>
          </View>
        )}

        {/* Plan cards */}
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                { backgroundColor: isDark ? '#1C1C2E' : '#F5F5F7', borderColor: colors.border },
                isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
              ]}
              onPress={() => setSelected(plan.id)}
              activeOpacity={0.8}
            >
              {plan.popular && (
                <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.popularText}>ПОПУЛЯРНЫЙ</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                  {plan.trialDays > 0 && canTrial && (
                    <Text style={[styles.trialLabel, { color: colors.primary }]}>
                      {plan.trialDays} дней бесплатно
                    </Text>
                  )}
                </View>
                <View style={styles.priceWrap}>
                  <Text style={[styles.planPrice, { color: colors.text }]}>{plan.price}</Text>
                  {plan.period ? (
                    <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>{plan.period}</Text>
                  ) : null}
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={{ marginLeft: 8 }} />
                )}
              </View>

              {/* Features */}
              <View style={styles.featureList}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                    <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
                  </View>
                ))}
                {plan.missing.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    <Text style={[styles.featureText, { color: colors.textMuted }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* CTA */}
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            { backgroundColor: colors.primary },
            (isLoading || (isPro && selected !== 'free')) && { opacity: 0.7 },
          ]}
          onPress={handleAction}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.ctaBtnText}>{getButtonLabel()}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.laterBtn} onPress={() => router.back()}>
          <Text style={[styles.laterText, { color: colors.textMuted }]}>Может позже</Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {canTrial
            ? 'Триал на 7 дней. Без карты. Отмена в любой момент.'
            : 'Оплата через App Store. Отмена в любой момент.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: { alignSelf: 'flex-end', padding: 16 },
  header: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20, gap: 6 },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginBottom: 12, padding: 10, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 13, fontWeight: '600' },
  planCard: { marginHorizontal: 20, marginBottom: 12, borderRadius: 20, padding: 18, borderWidth: 1.5, position: 'relative' },
  popularBadge: { position: 'absolute', top: -12, alignSelf: 'center', left: '50%', transform: [{ translateX: -55 }], paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  popularText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 4 },
  planName: { fontSize: 17, fontWeight: '800' },
  trialLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  priceWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  planPrice: { fontSize: 22, fontWeight: '900' },
  planPeriod: { fontSize: 13, paddingBottom: 2 },
  featureList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14, fontWeight: '500' },
  ctaBtn: { marginHorizontal: 20, marginTop: 24, borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  ctaBtnText: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  laterBtn: { alignItems: 'center', paddingVertical: 14 },
  laterText: { fontSize: 15, fontWeight: '600' },
  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 8, paddingHorizontal: 32 },
});
