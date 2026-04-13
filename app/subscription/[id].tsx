import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import i18n from 'i18next';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { subscriptionsApi } from '../../src/api/subscriptions';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { usePaymentCardsStore } from '../../src/stores/paymentCardsStore';
import { COLORS, STATUS_COLORS, CATEGORIES } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { CategoryBadge } from '../../src/components/CategoryBadge';
import { EditSubscriptionSheet } from '../../src/components/EditSubscriptionSheet';
import { PencilIcon, TrashIcon } from '../../src/components/icons';
import { useBillingStatus } from '../../src/hooks/useBilling';
import { analytics } from '../../src/services/analytics';

export default function SubscriptionDetailScreen() {
  const { t } = useTranslation();  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const subscription = useSubscriptionsStore((s) => s.subscriptions.find((sub) => sub.id === id));
  const { updateSubscription, removeSubscription } = useSubscriptionsStore();
  const getCard = usePaymentCardsStore((s) => s.getCard);

  const { colors, isDark } = useTheme();
  const { data: billing } = useBillingStatus();
  const isPro = billing?.plan === 'pro';
  const isTeam = billing?.plan === 'organization';
  const [editVisible, setEditVisible] = useState(false);
  const [iconError, setIconError] = useState(false);


  if (!subscription) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.text }]}>{t('subscription.not_found')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>{t('subscription.go_back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const card = subscription.paymentCardId ? getCard(subscription.paymentCardId) : null;
  const statusColor = STATUS_COLORS[subscription.status] || colors.textSecondary;
  const category = CATEGORIES.find((c) => c.id === subscription.category);

  const handleOpenWebsite = () => {
    const url = subscription.serviceUrl;
    if (url) Linking.openURL(url);
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      t('subscriptions.cancel_title'),
      subscription.cancelUrl
        ? t('subscription.cancel_confirm_url')
        : t('subscription.cancel_confirm'),
      [
        { text: t('subscription.keep'), style: 'cancel' },
        {
          text: t('subscriptions.cancel_title'),
          style: 'destructive',
          onPress: async () => {
            try {
              await subscriptionsApi.cancel(id!);
              if (subscription.cancelUrl) {
                Linking.openURL(subscription.cancelUrl);
              }
              updateSubscription(id!, { status: 'CANCELLED' });
              // Sync full list from server BEFORE navigating back
              try {
                const r = await subscriptionsApi.getAll();
                useSubscriptionsStore.getState().setSubscriptions(r.data || []);
              } catch {}
              Alert.alert(
                t('subscriptions.cancel_title'),
                t('subscription.cancel_success', 'Подписка отменена'),
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || t('common.error');
              Alert.alert(t('common.error'), msg);
            }
          },
        },
      ]
    );
  };


  const handleDelete = () => {
    Alert.alert(t('common.delete'), t('subscription.remove_confirm', { name: subscription.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await subscriptionsApi.delete(id!);
            removeSubscription(id!);
            // Refresh subscriptions list from server BEFORE navigating back
            try {
              const r = await subscriptionsApi.getAll();
              useSubscriptionsStore.getState().setSubscriptions(r.data || []);
            } catch {}
            router.back();
          } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || t('common.error');
            Alert.alert(t('common.error'), msg);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={[styles.backBtnText, { color: colors.primary }]}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditVisible(true)}>
              <PencilIcon size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <TrashIcon size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Service Info */}
        <View style={styles.serviceCard}>
          {subscription.iconUrl && !iconError ? (
            <Image source={{ uri: subscription.iconUrl }} style={styles.logo} onError={() => setIconError(true)} />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.logoText, { color: colors.primary }]}>{subscription.name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}

          <Text style={[styles.serviceName, { color: colors.text }]}>{subscription.name}</Text>

          {subscription.currentPlan && (
            <Text style={[styles.plan, { color: colors.textSecondary }]}>{subscription.currentPlan}</Text>
          )}

          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </Text>
          </View>

          <Text style={[styles.amount, { color: colors.primary }]}>
            {subscription.currency} {Number(subscription.amount).toFixed(2)}
            <Text style={[styles.period, { color: colors.textSecondary }]}> / {t(`billing.${subscription.billingPeriod?.toLowerCase()}`, subscription.billingPeriod)}</Text>
          </Text>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('subscription.details')}</Text>

          <DetailRow label={t("add.category")}>
            <CategoryBadge categoryId={subscription.category} />
          </DetailRow>

          {subscription.status === 'TRIAL' && (subscription as any).trialEndDate ? (
            <DetailRow label={t('subscription.trial_until')}>
              {(() => {
                const d = new Date((subscription as any).trialEndDate);
                const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
                const col = days <= 0 ? colors.error : days <= 3 ? '#F59E0B' : colors.text;
                return (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.detailValue, { color: col }]}>
                      {d.toLocaleDateString(i18n.language || 'en', { day: 'numeric', month: 'long' })}
                    </Text>
                    <Text style={{ fontSize: 11, color: col, fontWeight: '700', marginTop: 2 }}>
                      {days <= 0 ? t('subscription.trial_expired') : days === 0 ? t('subscription.trial_today') : t('subscription.trial_days_left', { count: days })}
                    </Text>
                  </View>
                );
              })()}
            </DetailRow>
          ) : subscription.nextPaymentDate ? (
            <DetailRow label={t("subscriptions.next_payment")}>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {new Date(subscription.nextPaymentDate).toLocaleDateString(i18n.language || 'en', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </Text>
            </DetailRow>
          ) : null}

          <DetailRow label={t("subscription.billing_day")}>
            <Text style={[styles.detailValue, { color: colors.text }]}>{t('subscription.day', { day: subscription.billingDay })}</Text>
          </DetailRow>

          {/* Reminder status */}
          {(() => {
            const days: number[] = (subscription as any).reminderDaysBefore ?? [];
            const enabled = (subscription as any).reminderEnabled !== false && days.length > 0;
            return (
              <DetailRow label={t('add.reminder', 'Reminder')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={enabled ? 'notifications' : 'notifications-off-outline'}
                    size={16}
                    color={enabled ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.detailValue, { color: enabled ? colors.text : colors.textMuted }]}>
                    {enabled
                      ? days.map((d: number) =>
                          d === 1 ? t('add.reminder_1d', '1 day') : d === 3 ? t('add.reminder_3d', '3 days') : d === 7 ? t('add.reminder_7d', '7 days') : `${d}d`
                        ).join(', ') + ' ' + t('subscription.before_payment', 'before payment')
                      : t('add.reminder_off', 'Off')}
                  </Text>
                </View>
              </DetailRow>
            );
          })()}

          {card && (
            <DetailRow label={t("add.card")}>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                ••••{card.last4} ({card.brand}) – {card.nickname}
              </Text>
            </DetailRow>
          )}

          {subscription.notes && (
            <DetailRow label={t("add.notes")}>
              <Text style={[styles.detailValue, { color: colors.text }]}>{subscription.notes}</Text>
            </DetailRow>
          )}
        </View>

        {/* Team upsell hint */}
        {isPro && !isTeam && (
          <TouchableOpacity
            style={[styles.teamHint, { backgroundColor: '#06B6D410', borderColor: '#06B6D430' }]}
            onPress={() => {
              analytics.track('team_upsell_detail_hint_tapped');
              router.push('/paywall' as any);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="people-outline" size={18} color="#06B6D4" />
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text }}>
              {t('team_upsell.detail_hint', { name: subscription.name })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#06B6D4" />
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {(subscription as any).serviceUrl && (
            <TouchableOpacity style={[styles.websiteBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]} onPress={handleOpenWebsite}>
              <Text style={[styles.websiteBtnText, { color: colors.text }]}>{t('subscription.open_website')}</Text>
            </TouchableOpacity>
          )}
          {(subscription as any).cancelUrl && subscription.status !== 'CANCELLED' && (
            <TouchableOpacity
              style={[styles.cancelLinkBtn, { backgroundColor: colors.surface, borderColor: colors.error + '40' }]}
              onPress={() => Linking.openURL((subscription as any).cancelUrl)}
            >
              <Text style={[styles.cancelLinkBtnText, { color: colors.error }]}>{t('subscription.cancel_page')}</Text>
            </TouchableOpacity>
          )}
          {subscription.status !== 'CANCELLED' && (
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: isDark ? '#2A1520' : '#FFF0F0', borderColor: colors.error + '40' }]}
              onPress={handleCancelSubscription}
            >
              <Text style={[styles.cancelBtnText, { color: colors.error }]}>{t('subscription.cancel_subscription')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <EditSubscriptionSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        subscription={subscription}
      />
    </SafeAreaView>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <Text style={[rowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={rowStyles.value}>{children}</View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  label: { fontSize: 14, fontWeight: '500' },
  value: { flex: 1, alignItems: 'flex-end' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { padding: 10, minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backBtnText: { fontSize: 24 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtn: { padding: 10, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  editBtnText: { fontSize: 20 },
  deleteBtn: { padding: 10, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 20 },
  serviceCard: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  logo: { width: 80, height: 80, borderRadius: 20 },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 36, fontWeight: '900' },
  serviceName: { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  plan: { fontSize: 14 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  amount: { fontSize: 32, fontWeight: '900', marginTop: 4 },
  period: { fontSize: 16, fontWeight: '500' },
  card: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    gap: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  detailValue: { fontSize: 14, fontWeight: '500', textAlign: 'right', flex: 1 },
  uploadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  uploadBtnText: { fontSize: 13, fontWeight: '700' },
  noReceipts: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  receiptThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 8 },
  actions: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  websiteBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  websiteBtnText: { fontSize: 15, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700' },
  cancelLinkBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  cancelLinkBtnText: { fontSize: 15, fontWeight: '700' },
  teamHint: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  notFound: { fontSize: 18, textAlign: 'center', marginTop: 100 },
  backLink: { fontSize: 15, textAlign: 'center', marginTop: 16 },
});
