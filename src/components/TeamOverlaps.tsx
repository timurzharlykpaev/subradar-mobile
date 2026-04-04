import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface Overlap {
  serviceName: string;
  members: { userId: string; name: string; amount: number }[];
  currentTotalMonthly: number;
  suggestedPlan: string;
  suggestedTotalMonthly: number;
  savingsMonthly: number;
}

interface Props {
  overlaps: Overlap[];
  currency?: string;
}

export function TeamOverlaps({ overlaps, currency = 'USD' }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sym = currency === 'USD' ? '$' : currency;

  const positiveOverlaps = overlaps.filter(o => o.savingsMonthly > 0);
  if (positiveOverlaps.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="swap-horizontal" size={18} color="#eab308" />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('workspace.overlaps_title', 'Subscription Overlaps')}
        </Text>
      </View>
      {positiveOverlaps.map((overlap, i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.serviceName, { color: colors.text }]}>
            {overlap.serviceName} x {overlap.members.length} {t('workspace.members_label', 'members')}
          </Text>
          <Text style={[styles.currentCost, { color: colors.textSecondary }]}>
            {sym}{overlap.currentTotalMonthly.toFixed(0)}/{t('add_flow.mo', 'mo')} {t('workspace.total_now', 'total now')}
          </Text>
          <View style={styles.suggestion}>
            <Ionicons name="bulb-outline" size={14} color="#22c55e" />
            <Text style={styles.suggestionText}>
              {overlap.suggestedPlan}: {sym}{overlap.suggestedTotalMonthly.toFixed(0)}/{t('add_flow.mo', 'mo')} {'->'} {t('workspace.save', 'save')} {sym}{overlap.savingsMonthly.toFixed(0)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  card: { borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1 },
  serviceName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  currentCost: { fontSize: 13, marginBottom: 8 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestionText: { fontSize: 13, color: '#22c55e', fontWeight: '500' },
});
