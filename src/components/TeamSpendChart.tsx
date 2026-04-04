import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface MemberSpend {
  name: string;
  amount: number;
}

interface Props {
  members: MemberSpend[];
  currency?: string;
}

export function TeamSpendChart({ members, currency = 'USD' }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sym = currency === 'USD' ? '$' : currency;
  const maxAmount = Math.max(...members.map(m => m.amount), 1);

  if (members.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('workspace.spend_by_member', 'Spending by Member')}
      </Text>
      {members
        .sort((a, b) => b.amount - a.amount)
        .map((member, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
              {member.name}
            </Text>
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.bar,
                  { width: `${(member.amount / maxAmount) * 100}%`, backgroundColor: colors.primary + (i === 0 ? 'FF' : '80') },
                ]}
              />
            </View>
            <Text style={[styles.amount, { color: colors.text }]}>
              {sym}{member.amount.toFixed(0)}
            </Text>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  name: { width: 70, fontSize: 13 },
  barContainer: { flex: 1, height: 24, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.1)' },
  bar: { height: '100%', borderRadius: 6, minWidth: 4 },
  amount: { width: 55, fontSize: 14, fontWeight: '700', textAlign: 'right' },
});
