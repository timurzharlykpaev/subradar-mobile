import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Subscription } from '../stores/subscriptionsStore';
import { COLORS, STATUS_COLORS } from '../constants';
import { CategoryBadge } from './CategoryBadge';
import { CardBadge } from './CardBadge';

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
  const statusColor = STATUS_COLORS[subscription.status] || COLORS.textSecondary;

  const isTrial = subscription.status === 'TRIAL';
  const trialDays = isTrial ? daysUntil((subscription as any).trialEndDate) : null;
  const trialUrgent = trialDays !== null && trialDays <= 3 && trialDays >= 0;
  const trialExpired = trialDays !== null && trialDays < 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/subscription/${subscription.id}` as any)}
    >
      <View style={styles.left}>
        {subscription.iconUrl ? (
          <Image source={{ uri: subscription.iconUrl }} style={styles.logo} />
        ) : (
          <View style={[styles.logoPlaceholder, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={styles.logoText}>{subscription.name[0]}</Text>
          </View>
        )}
      </View>

      <View style={styles.middle}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{subscription.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {subscription.status}
            </Text>
          </View>
        </View>

        {subscription.plan && (
          <Text style={styles.plan}>{subscription.plan}</Text>
        )}

        <View style={styles.row}>
          <CategoryBadge categoryId={subscription.category} size="sm" />
          {subscription.paymentCardId && <CardBadge cardId={subscription.paymentCardId} />}
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>
          {subscription.currency} {subscription.amount.toFixed(2)}
        </Text>
        <Text style={styles.period}>/ {subscription.billingPeriod}</Text>
        {isTrial && trialDays !== null ? (
          <View style={[styles.trialBadge, {
            backgroundColor: trialExpired ? '#EF444420' : trialUrgent ? '#F59E0B20' : '#3B82F620',
          }]}>
            <Text style={[styles.trialBadgeText, {
              color: trialExpired ? '#EF4444' : trialUrgent ? '#F59E0B' : '#3B82F6',
            }]}>
              {trialExpired ? 'Trial ended' : trialDays === 0 ? 'Ends today' : `🎁 ${trialDays}d`}
            </Text>
          </View>
        ) : subscription.nextPaymentDate ? (
          <Text style={styles.nextDate}>
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
    backgroundColor: COLORS.surface,
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
  logoText: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  middle: { flex: 1, gap: 4 },
  right: { alignItems: 'flex-end', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  plan: { fontSize: 12, color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  amount: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  period: { fontSize: 11, color: COLORS.textSecondary },
  nextDate: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  trialBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  trialBadgeText: { fontSize: 10, fontWeight: '700' },
});
