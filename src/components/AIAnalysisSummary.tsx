import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface Props {
  summary: string;
  totalMonthlySavings: number;
  currency: string;
  createdAt: string;
  canRunManual: boolean;
  isRunning: boolean;
  onRefresh: () => void;
}

function daysAgo(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function AIAnalysisSummary({
  summary,
  totalMonthlySavings,
  currency,
  createdAt,
  canRunManual,
  isRunning,
  onRefresh,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const days = daysAgo(createdAt);

  const updatedLabel =
    days === 0
      ? t('analysis.updated_today', 'Updated today')
      : days === 1
      ? t('analysis.updated_yesterday', 'Updated yesterday')
      : t('analysis.updated_days_ago', 'Updated {{n}} days ago', { n: days });

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="sparkles" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('analysis.title', 'AI Analysis')}
        </Text>
      </View>

      {/* Summary text */}
      <Text style={[styles.summary, { color: colors.textSecondary }]}>{summary}</Text>

      {/* Savings row */}
      {totalMonthlySavings > 0 && (
        <View style={[styles.savingsRow, { backgroundColor: colors.success + '18' }]}>
          <Ionicons name="trending-down-outline" size={18} color={colors.success} />
          <Text style={[styles.savingsText, { color: colors.success }]}>
            {t('analysis.potential_savings', 'Potential savings: {{amount}} {{currency}}/mo', {
              amount: totalMonthlySavings.toFixed(2),
              currency,
            })}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.updatedLabel, { color: colors.textMuted }]}>{updatedLabel}</Text>
        {canRunManual && (
          <TouchableOpacity
            onPress={onRefresh}
            disabled={isRunning}
            style={styles.refreshBtn}
            activeOpacity={0.75}
          >
            {isRunning ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={16} color={colors.primary} />
            )}
            <Text style={[styles.refreshText, { color: colors.primary }]}>
              {t('analysis.refresh', 'Refresh')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  summary: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  updatedLabel: {
    fontSize: 12,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
