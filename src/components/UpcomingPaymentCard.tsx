import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Subscription } from '../types';
import { CATEGORIES } from '../constants';
import { useTheme } from '../theme';
import { CategoryIcon } from './icons';
import { resolveNextPaymentDate, daysUntil as daysUntilFn } from '../utils/nextPaymentDate';

interface Props {
  subscription: Subscription;
}

export const UpcomingPaymentCard: React.FC<Props> = ({ subscription }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cat = CATEGORIES.find((c) => c.id === subscription.category);
  const daysUntil = daysUntilFn(resolveNextPaymentDate(subscription)) ?? 0;

  return (
    <TouchableOpacity testID={`upcoming-card-${subscription.id}`} style={[styles.card, { backgroundColor: colors.surface, borderTopColor: cat?.color || colors.primary }]}>
      <CategoryIcon category={subscription.category} size={24} />
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{subscription.name}</Text>
      <Text style={[styles.amount, { color: colors.primary }]} numberOfLines={1}>
        {subscription.currency} {Number(subscription.amount).toFixed(0)}
      </Text>
      <Text style={[styles.days, { color: colors.textSecondary }]}>
        {daysUntil === 0 ? t('upcoming.today') : daysUntil === 1 ? t('upcoming.tomorrow') : t('upcoming.in_days', { count: daysUntil })}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    width: 130,
    minWidth: 110,
    marginRight: 10,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 4,
  },
  name: { fontSize: 12, fontWeight: '700' },
  amount: { fontSize: 14, fontWeight: '800' },
  days: { fontSize: 11 },
});
