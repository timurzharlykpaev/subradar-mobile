import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { useTheme } from '../theme';

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
  const { colors } = useTheme();

  if (!card) return null;

  const brandColor = BRAND_COLORS[card.brand] || BRAND_COLORS.OTHER;

  return (
    <View style={[styles.badge, { borderColor: brandColor + '40', backgroundColor: colors.surface2 }]}>
      <View style={[styles.dot, { backgroundColor: brandColor }]} />
      {card.nickname ? (
        <Text style={[styles.text, { color: colors.textSecondary }]} numberOfLines={1}>
          {card.nickname}
        </Text>
      ) : (
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          ····{card.last4}
        </Text>
      )}
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
    backgroundColor: undefined,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    color: undefined,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  brand: {
    fontSize: 10,
    fontWeight: '700',
  },
});
