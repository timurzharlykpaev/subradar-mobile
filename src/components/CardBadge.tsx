import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { COLORS } from '../constants';

interface Props {
  cardId?: string;
}

const BRAND_COLORS: Record<string, string> = {
  Visa: '#1A1F71',
  Mastercard: '#EB001B',
  Amex: '#007BC1',
  Mir: '#0FAB5E',
  Other: '#6B7280',
};

export const CardBadge: React.FC<Props> = ({ cardId }) => {
  const card = usePaymentCardsStore((s) => s.getCard(cardId || ''));

  if (!card) return null;

  return (
    <View style={[styles.badge, { borderColor: BRAND_COLORS[card.brand] + '40' }]}>
      <View style={[styles.dot, { backgroundColor: BRAND_COLORS[card.brand] }]} />
      <Text style={styles.text}>
        ••••{card.last4}
      </Text>
      <Text style={[styles.brand, { color: BRAND_COLORS[card.brand] }]}>
        {card.brand}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: COLORS.background,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  brand: {
    fontSize: 10,
    fontWeight: '700',
  },
});
