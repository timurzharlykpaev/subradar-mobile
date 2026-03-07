import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Subscription } from '../types';
import { COLORS, STATUS_COLORS } from '../constants';
import { CategoryBadge } from './CategoryBadge';
import { CardBadge } from './CardBadge';

interface Props {
  subscription: Subscription;
  onSwipeDelete?: () => void;
}

export const SubscriptionCard: React.FC<Props> = ({ subscription }) => {
  const router = useRouter();
  const statusColor = STATUS_COLORS[subscription.status] || COLORS.textSecondary;

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

        {subscription.currentPlan && (
          <Text style={styles.plan}>{subscription.currentPlan}</Text>
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
        {subscription.nextBillingDate && (
          <Text style={styles.nextDate}>
            {new Date(subscription.nextBillingDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </Text>
        )}
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
});
