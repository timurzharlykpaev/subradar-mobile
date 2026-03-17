import React from 'react';
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

const PLAN_FEATURES = {
  free:         ['3 подписки', '5 AI запросов/мес', 'Базовая аналитика'],
  pro:          ['Безлимитные подписки', '200 AI запросов/мес', 'Расширенная аналитика', 'PDF отчёты'],
  organization: ['Всё из Pro', 'Командный доступ', 'Аналитика по участникам', 'До 10 участников'],
};

const PLAN_PRICE: Record<string, string> = {
  free: 'Бесплатно',
  pro: '$2.99/мес',
  organization: '$9.99/мес',
};

const PLAN_NAME: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  organization: 'Team',
};

export default function SubscriptionPlanScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: billing, isLoading } = useBillingStatus();
  const startTrialMutation = useStartTrial();

  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      Alert.alert('Подписка отменена', 'Доступ сохранится до конца периода.');
    },
    onError: (e: any) => Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось отменить'),
  });

  const handleCancel = () => {
    Alert.alert(
      'Отменить подписку?',
      'Доступ к Pro сохранится до конца оплаченного периода.',
      [
        { text: 'Нет', style: 'cancel' },
        { text: 'Отменить', style: 'destructive', onPress: () => cancelMutation.mutate() },
      ]
    );
  };

  const handleStartTrial = async () => {
    try {
      await startTrialMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      Alert.alert('🎉 Триал активирован!', '7 дней Pro-доступа бесплатно.');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось активировать');
    }
  };

  const bg = colors.background;
  const card = isDark ? '#1C1C2E' : '#FFFFFF';

  const plan = billing?.plan ?? 'free';
  const isPro = plan === 'pro' || plan === 'organization';
  const isTrialing = billing?.status === 'trialing';
  const canTrial = billing && !billing.trialUsed && !isPro && !isTrialing;
  const features = PLAN_FEATURES[plan as keyof typeof PLAN_FEATURES] ?? PLAN_FEATURES.free;

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
          <Text style={[styles.title, { color: colors.text }]}>Моя подписка</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Current plan card */}
        <View style={[styles.planCard, { backgroundColor: colors.primary }]}>
          <View style={styles.planCardRow}>
            <View>
              <Text style={styles.planCardLabel}>Текущий план</Text>
              <Text style={styles.planCardName}>{PLAN_NAME[plan] ?? plan}</Text>
              {isTrialing && (
                <View style={styles.trialBadge}>
                  <Ionicons name="time-outline" size={12} color="#FFF" />
                  <Text style={styles.trialBadgeText}>Пробный · {billing?.trialDaysLeft ?? 0} дн. осталось</Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.planCardPrice}>{PLAN_PRICE[plan] ?? ''}</Text>
              {isPro && !isTrialing && (
                <View style={[styles.activeBadge]}>
                  <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                  <Text style={styles.activeBadgeText}>Активна</Text>
                </View>
              )}
            </View>
          </View>

          {/* Usage */}
          <View style={styles.usageRow}>
            <View style={styles.usageItem}>
              <Text style={styles.usageValue}>{billing?.subscriptionCount ?? 0}/{billing?.subscriptionLimit === null ? '∞' : billing?.subscriptionLimit ?? 3}</Text>
              <Text style={styles.usageLabel}>Подписок</Text>
            </View>
            <View style={styles.usageDivider} />
            <View style={styles.usageItem}>
              <Text style={styles.usageValue}>{billing?.aiRequestsUsed ?? 0}/{billing?.aiRequestsLimit ?? 5}</Text>
              <Text style={styles.usageLabel}>AI запросов</Text>
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={[styles.section, { backgroundColor: card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Включено в план</Text>
          {features.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>

          {/* Trial */}
          {canTrial && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handleStartTrial}
              disabled={startTrialMutation.isPending}
            >
              {startTrialMutation.isPending
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Ionicons name="star-outline" size={18} color="#FFF" />
                    <Text style={styles.actionBtnText}>Начать 7-дневный триал</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          {/* Upgrade */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: plan === 'organization' ? colors.surface : colors.primary }]}
            onPress={() => router.push('/paywall' as any)}
            disabled={plan === 'organization'}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color="#FFF" />
            <Text style={styles.actionBtnText}>
              {plan === 'free' ? 'Перейти на Pro' : plan === 'pro' ? 'Перейти на Team' : 'Максимальный план'}
            </Text>
          </TouchableOpacity>

          {/* Cancel */}
          {isPro && !isTrialing && (
            <TouchableOpacity
              style={[styles.actionBtnOutline, { borderColor: '#EF4444' }]}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending
                ? <ActivityIndicator color="#EF4444" />
                : <>
                    <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                    <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Отменить подписку</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          {/* Cancel trial */}
          {isTrialing && (
            <TouchableOpacity
              style={[styles.actionBtnOutline, { borderColor: colors.border }]}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending
                ? <ActivityIndicator color={colors.textMuted} />
                : <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Отменить триал</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Info */}
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Управление подпиской через App Store.{'\n'}Отмена действует с конца текущего периода.
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
  planCard: { margin: 20, borderRadius: 20, padding: 20, gap: 16 },
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
  section: { margin: 20, marginTop: 0, borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, fontWeight: '500' },
  actions: { paddingHorizontal: 20, gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16 },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5 },
  actionBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 20, paddingHorizontal: 32, lineHeight: 18 },
});
