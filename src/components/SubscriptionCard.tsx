import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Subscription } from '../stores/subscriptionsStore';
import { STATUS_COLORS } from '../constants';
import { CategoryBadge } from './CategoryBadge';
import { CardBadge } from './CardBadge';
import { useTheme } from '../theme';

interface Props {
  subscription: Subscription;
  onSwipeDelete?: () => void;
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export const SubscriptionCard: React.FC<Props> = ({ subscription }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const statusColor = STATUS_COLORS[subscription.status] || colors.textSecondary;

  const isTrial = subscription.status === 'TRIAL';
  const trialDays = isTrial ? daysUntil((subscription as any).trialEndDate) : null;
  const trialUrgent = trialDays !== null && trialDays <= 3 && trialDays >= 0;
  const trialExpired = trialDays !== null && trialDays < 0;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      activeOpacity={0.85}
      onPress={() => router.push(`/subscription/${subscription.id}` as any)}
    >
      <View style={styles.left}>
        {subscription.iconUrl ? (
          <Image source={{ uri: subscription.iconUrl }} style={styles.logo} />
        ) : (
          <View style={[styles.logoPlaceholder, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.logoText, { color: colors.primary }]}>{subscription.name[0]}</Text>
          </View>
        )}
      </View>

      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{subscription.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {subscription.status}
            </Text>
          </View>
        </View>

        {subscription.plan && (
          <Text style={[styles.plan, { color: colors.textSecondary }]} numberOfLines={1}>{subscription.plan}</Text>
        )}

        <View style={styles.tagsRow}>
          <CategoryBadge categoryId={subscription.category} size="sm" />
          {subscription.paymentCardId && <CardBadge cardId={subscription.paymentCardId} />}
        </View>
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.text }]} numberOfLines={1}>
          {subscription.currency} {Number(subscription.amount).toFixed(2)}
        </Text>
        <Text style={[styles.period, { color: colors.textSecondary }]}>/ {subscription.billingPeriod}</Text>
        {isTrial && trialDays !== null ? (
          <View style={[styles.trialBadge, {
            backgroundColor: trialExpired ? '#EF444420' : trialUrgent ? '#F59E0B20' : '#3B82F620',
          }]}>
            <Text style={[styles.trialBadgeText, {
              color: trialExpired ? '#EF4444' : trialUrgent ? '#F59E0B' : '#3B82F6',
            }]}>
              {trialExpired ? t('trials.expired') : trialDays === 0 ? t('trials.ends_today') : `🎁 ${trialDays}d`}
            </Text>
          </View>
        ) : subscription.nextPaymentDate ? (
          <Text style={[styles.nextDate, { color: colors.primary }]}>
            {new Date(subscription.nextPaymentDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  left: {},
  logo: { width: 44, height: 44, borderRadius: 12 },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 20, fontWeight: '700' },
  middle: { flex: 1, gap: 4, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 2, flexShrink: 0, maxWidth: 110 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', flex: 1, flexShrink: 1 },
  plan: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  amount: { fontSize: 15, fontWeight: '800' },
  period: { fontSize: 11 },
  nextDate: { fontSize: 11, fontWeight: '600' },
  trialBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  trialBadgeText: { fontSize: 10, fontWeight: '700' },
});
