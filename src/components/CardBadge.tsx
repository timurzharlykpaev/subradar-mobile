import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { COLORS } from '../constants';

interface Props {
  cardId?: string;
}

const BRAND_COLORS: Record<string, string> = {
  VISA: '#1A1F71',
  MC: '#EB001B',
  AMEX: '#007BC1',
  MIR: '#0FAB5E',
  OTHER: '#6B7280',
};

const BRAND_LABELS: Record<string, string> = {
  VISA: 'Visa',
  MC: 'MC',
  AMEX: 'Amex',
  MIR: 'Mir',
  OTHER: 'Other',
};

export const CardBadge: React.FC<Props> = ({ cardId }) => {
  const card = usePaymentCardsStore((s) => s.getCard(cardId || ''));

  if (!card) return null;

  const brandColor = BRAND_COLORS[card.brand] || BRAND_COLORS.OTHER;

  return (
    <View style={[styles.badge, { borderColor: brandColor + '40' }]}>
      <View style={[styles.dot, { backgroundColor: brandColor }]} />
      <Text style={styles.text}>
        ····{card.last4}
      </Text>
      <Text style={[styles.brand, { color: brandColor }]}>
        {BRAND_LABELS[card.brand] || card.brand}
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
