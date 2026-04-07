import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface Props {
  subscriptionCount: number;
  aiRequestsUsed: number;
  estimatedSavings: number;
  currency: string;
}

export default function ValueShowcase({ subscriptionCount, aiRequestsUsed, estimatedSavings, currency }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const stats: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string; color: string }[] = [
    {
      icon: 'repeat-outline',
      value: String(subscriptionCount),
      label: t('retention.subs_tracked', 'Subscriptions tracked'),
      color: colors.primary,
    },
    {
      icon: 'sparkles-outline',
      value: String(aiRequestsUsed),
      label: t('retention.ai_analyses', 'AI analyses'),
      color: '#8B5CF6',
    },
    {
      icon: 'cash-outline',
      value: `${currency}${estimatedSavings > 0 ? estimatedSavings.toFixed(0) : '0'}`,
      label: t('retention.savings_found', 'Potential savings'),
      color: colors.success,
    },
  ];

  return (
    <View style={styles.container}>
      {stats.map((stat, i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: stat.color + '18' }]}>
            <Ionicons name={stat.icon} size={18} color={stat.color} />
          </View>
          <Text style={[styles.value, { color: colors.text }]}>{stat.value}</Text>
          <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
  },
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '900',
  },
  label: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
});
