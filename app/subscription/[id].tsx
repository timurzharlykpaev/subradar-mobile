import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { subscriptionsApi } from '../../src/api/subscriptions';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { usePaymentCardsStore } from '../../src/stores/paymentCardsStore';
import { COLORS, STATUS_COLORS, CATEGORIES } from '../../src/constants';
import { CategoryBadge } from '../../src/components/CategoryBadge';

export default function SubscriptionDetailScreen() {
  const { t } = useTranslation();  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const subscription = useSubscriptionsStore((s) => s.subscriptions.find((sub) => sub.id === id));
  const { updateSubscription, removeSubscription } = useSubscriptionsStore();
  const getCard = usePaymentCardsStore((s) => s.getCard);

  const [receipts, setReceipts] = useState<string[]>([]);

  if (!subscription) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFound}>{t('subscription.not_found')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>{t('subscription.go_back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const card = subscription.paymentCardId ? getCard(subscription.paymentCardId) : null;
  const statusColor = STATUS_COLORS[subscription.status] || COLORS.textSecondary;
  const category = CATEGORIES.find((c) => c.id === subscription.category);

  const handleOpenWebsite = () => {
    const url = (subscription as any).serviceUrl ?? subscription.websiteUrl;
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
            if (subscription.cancelUrl) {
              Linking.openURL(subscription.cancelUrl);
            }
            try { await subscriptionsApi.cancel(id!); } catch {}
            updateSubscription(id!, { status: 'CANCELLED' });
            router.back();
          },
        },
      ]
    );
  };

  const handleUploadReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      setReceipts((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleDelete = () => {
    Alert.alert(t('common.delete'), t('subscription.remove_confirm', { name: subscription.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try { await subscriptionsApi.delete(id!); } catch {}
          removeSubscription(id!);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>

        {/* Service Info */}
        <View style={styles.serviceCard}>
          {subscription.iconUrl ? (
            <Image source={{ uri: subscription.iconUrl }} style={styles.logo} />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: COLORS.primaryLight }]}>
              <Text style={styles.logoText}>{subscription.name[0]}</Text>
            </View>
          )}

          <Text style={styles.serviceName}>{subscription.name}</Text>

          {subscription.plan && (
            <Text style={styles.plan}>{subscription.plan}</Text>
          )}

          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </Text>
          </View>

          <Text style={styles.amount}>
            {subscription.currency} {Number(subscription.amount).toFixed(2)}
            <Text style={styles.period}> / {subscription.billingPeriod}</Text>
          </Text>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('subscription.details')}</Text>

          <DetailRow label={t("add.category")}>
            <CategoryBadge categoryId={subscription.category} />
          </DetailRow>

          {subscription.status === 'TRIAL' && (subscription as any).trialEndDate ? (
            <DetailRow label={t('subscription.trial_until')}>
              {(() => {
                const d = new Date((subscription as any).trialEndDate);
                const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
                const col = days <= 0 ? COLORS.error : days <= 3 ? '#F59E0B' : COLORS.text;
                return (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.detailValue, { color: col }]}>
                      {d.toLocaleDateString('en', { day: 'numeric', month: 'long' })}
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
              <Text style={styles.detailValue}>
                {new Date(subscription.nextPaymentDate).toLocaleDateString('en', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </Text>
            </DetailRow>
          ) : null}

          <DetailRow label={t("subscription.billing_day")}>
            <Text style={styles.detailValue}>{t('subscription.day', { day: subscription.billingDay })}</Text>
          </DetailRow>

          {card && (
            <DetailRow label={t("add.card")}>
              <Text style={styles.detailValue}>
                ••••{card.last4} ({card.brand}) – {card.nickname}
              </Text>
            </DetailRow>
          )}

          {subscription.notes && (
            <DetailRow label={t("add.notes")}>
              <Text style={styles.detailValue}>{subscription.notes}</Text>
            </DetailRow>
          )}
        </View>

        {/* Receipts */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('subscription.receipts')}</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadReceipt}>
              <Text style={styles.uploadBtnText}>{t('subscription.upload')}</Text>
            </TouchableOpacity>
          </View>
          {receipts.length === 0 ? (
            <Text style={styles.noReceipts}>{t('subscription.no_receipts')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {receipts.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.receiptThumb} />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {(subscription as any).serviceUrl && (
            <TouchableOpacity style={styles.websiteBtn} onPress={handleOpenWebsite}>
              <Text style={styles.websiteBtnText}>{t('subscription.open_website')}</Text>
            </TouchableOpacity>
          )}
          {(subscription as any).cancelUrl && subscription.status !== 'CANCELLED' && (
            <TouchableOpacity
              style={styles.cancelLinkBtn}
              onPress={() => Linking.openURL((subscription as any).cancelUrl)}
            >
              <Text style={styles.cancelLinkBtnText}>{t('subscription.cancel_page')}</Text>
            </TouchableOpacity>
          )}
          {subscription.status !== 'CANCELLED' && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSubscription}>
              <Text style={styles.cancelBtnText}>{t('subscription.cancel_subscription')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
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
    borderBottomColor: COLORS.border,
  },
  label: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  value: { flex: 1, alignItems: 'flex-end' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  backBtnText: { fontSize: 24, color: COLORS.primary },
  deleteBtn: { padding: 8 },
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
  logoText: { fontSize: 36, fontWeight: '900', color: COLORS.primary },
  serviceName: { fontSize: 26, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  plan: { fontSize: 14, color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  amount: { fontSize: 32, fontWeight: '900', color: COLORS.primary, marginTop: 4 },
  period: { fontSize: 16, fontWeight: '500', color: COLORS.textSecondary },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    gap: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  detailValue: { fontSize: 14, color: COLORS.text, fontWeight: '500', textAlign: 'right', flex: 1 },
  uploadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  noReceipts: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 16 },
  receiptThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 8 },
  actions: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  websiteBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  websiteBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cancelBtn: {
    backgroundColor: '#FFF0F0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '40',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.error },
  cancelLinkBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.error + '40',
  },
  cancelLinkBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.error },
  notFound: { fontSize: 18, color: COLORS.text, textAlign: 'center', marginTop: 100 },
  backLink: { fontSize: 15, color: COLORS.primary, textAlign: 'center', marginTop: 16 },
});
