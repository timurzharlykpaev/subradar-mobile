import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import type { DuplicateGroup } from '../types';

interface Props {
  groups: DuplicateGroup[];
  currency: string;
}

export default function AIDuplicateGroup({ groups, currency }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (groups.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('analysis.duplicates_title', 'Duplicate Subscriptions')}
      </Text>

      {groups.map((group, groupIndex) => (
        <View
          key={groupIndex}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {/* Card header */}
          <View style={styles.cardHeader}>
            <Ionicons name="copy-outline" size={18} color={colors.warning} />
            <Text style={[styles.reason, { color: colors.text }]} numberOfLines={2}>
              {group.reason}
            </Text>
          </View>

          {/* Subscription list */}
          <View style={styles.subList}>
            {group.subscriptions.map((sub) => (
              <View key={sub.id} style={styles.subRow}>
                <Text style={[styles.subName, { color: colors.textSecondary }]}>
                  {sub.name}
                </Text>
                <Text style={[styles.subAmount, { color: colors.textSecondary }]}>
                  {`${sub.amount.toFixed(2)} ${currency}`}
                </Text>
              </View>
            ))}
          </View>

          {/* Suggestion */}
          <Text style={[styles.suggestion, { color: colors.success }]}>
            {group.suggestion}
          </Text>

          {/* Savings */}
          {group.estimatedSavingsMonthly > 0 && (
            <Text style={[styles.savings, { color: colors.success }]}>
              {t('analysis.savings_mo', 'Save up to {{amount}} {{currency}}/mo', {
                amount: group.estimatedSavingsMonthly.toFixed(2),
                currency,
              })}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  reason: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  subList: {
    gap: 6,
    marginBottom: 12,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subName: {
    fontSize: 13,
  },
  subAmount: {
    fontSize: 13,
    fontWeight: '500',
  },
  suggestion: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 6,
  },
  savings: {
    fontSize: 13,
    fontWeight: '700',
  },
});
