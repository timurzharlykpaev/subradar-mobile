import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Subscription } from '../stores/subscriptionsStore';
import { COLORS, CATEGORIES } from '../constants';

interface Props {
  subscription: Subscription;
}

export const UpcomingPaymentCard: React.FC<Props> = ({ subscription }) => {
  const { t } = useTranslation();
  const cat = CATEGORIES.find((c) => c.id === subscription.category);
  const daysUntil = subscription.nextPaymentDate
    ? Math.ceil((new Date(subscription.nextPaymentDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <TouchableOpacity style={[styles.card, { borderTopColor: cat?.color || COLORS.primary }]}>
      <Text style={styles.emoji}>{cat?.emoji || '📦'}</Text>
      <Text style={styles.name} numberOfLines={1}>{subscription.name}</Text>
      <Text style={styles.amount}>
        {subscription.currency} {Number(subscription.amount).toFixed(0)}
      </Text>
      <Text style={styles.days}>
        {daysUntil === 0 ? t('upcoming.today') : daysUntil === 1 ? t('upcoming.tomorrow') : t('upcoming.in_days', { count: daysUntil })}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    width: 120,
    marginRight: 10,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 4,
  },
  emoji: { fontSize: 24 },
  name: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  amount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  days: { fontSize: 11, color: COLORS.textSecondary },
});
