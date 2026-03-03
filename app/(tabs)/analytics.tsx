import { useTranslation } from 'react-i18next';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { COLORS, CATEGORIES } from '../../src/constants';

// Simple bar chart without external deps for max compatibility
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={chartStyles.container}>
      {data.map((d) => (
        <View key={d.label} style={chartStyles.barGroup}>
          <View style={chartStyles.barWrapper}>
            <View
              style={[
                chartStyles.bar,
                { height: Math.max((d.value / max) * 120, 4) },
              ]}
            />
          </View>
          <Text style={chartStyles.label}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    gap: 6,
    paddingTop: 20,
  },
  barGroup: { flex: 1, alignItems: 'center', gap: 4 },
  barWrapper: { flex: 1, justifyContent: 'flex-end' },
  bar: { backgroundColor: COLORS.primary, borderRadius: 4, width: '100%' },
  label: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },
});

export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const { subscriptions } = useSubscriptionsStore();

  const activeSubs = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial');

  const totalMonthly = activeSubs.reduce((sum, s) => {
    const mult = s.period === 'weekly' ? 4 : s.period === 'quarterly' ? 1 / 3 : s.period === 'yearly' ? 1 / 12 : 1;
    return sum + s.amount * mult;
  }, 0);

  const totalYearly = totalMonthly * 12;
  const mostExpensive = activeSubs.reduce<typeof activeSubs[0] | null>(
    (max, s) => (!max || s.amount > max.amount ? s : max),
    null
  );

  // Monthly mock data
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = months.map((m) => ({
    label: m,
    value: totalMonthly * (0.8 + Math.random() * 0.4),
  }));

  // By category
  const byCategory = CATEGORIES.map((cat) => {
    const catSubs = activeSubs.filter((s) => s.category === cat.id);
    const total = catSubs.reduce((sum, s) => sum + s.amount, 0);
    return { ...cat, total, count: catSubs.length };
  }).filter((c) => c.count > 0);

  const categoryMax = Math.max(...byCategory.map((c) => c.total), 1);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Your spending breakdown</Text>
        </View>

        {/* Summary Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatCard label={t('analytics.avg_month')} value={`$${totalMonthly.toFixed(0)}`} />
          <StatCard label={t('analytics.total_year')} value={`$${totalYearly.toFixed(0)}`} />
          {mostExpensive && (
            <StatCard label={t('analytics.most_expensive')} value={mostExpensive.name} sub={`$${mostExpensive.amount}/mo`} />
          )}
        </ScrollView>

        {/* Monthly Bar Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Spend</Text>
          <BarChart data={monthlyData} />
        </View>

        {/* By Category */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Category</Text>
          {byCategory.map((cat) => (
            <View key={cat.id} style={styles.catRow}>
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.catLabelRow}>
                  <Text style={styles.catLabel}>{cat.label}</Text>
                  <Text style={styles.catAmount}>${cat.total.toFixed(2)}</Text>
                </View>
                <View style={styles.barBg}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(cat.total / categoryMax) * 100}%`, backgroundColor: cat.color },
                    ]}
                  />
                </View>
                <Text style={styles.catCount}>{cat.count} subscription{cat.count > 1 ? 's' : ''}</Text>
              </View>
            </View>
          ))}
          {byCategory.length === 0 && (
            <Text style={styles.empty}>No data yet</Text>
          )}
        </View>

        {/* By Service */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>All Subscriptions</Text>
          {activeSubs.map((sub) => (
            <View key={sub.id} style={styles.subRow}>
              <View style={[styles.subIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Text style={styles.subIconText}>{sub.name[0]}</Text>
              </View>
              <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
              <Text style={styles.subAmount}>
                {sub.currency} {sub.amount.toFixed(2)}/{sub.period.slice(0, 2)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={statStyles.value} numberOfLines={1}>{value}</Text>
      {sub && <Text style={statStyles.sub}>{sub}</Text>}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    minWidth: 130,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  label: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  value: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  sub: { fontSize: 11, color: COLORS.textMuted },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary },
  statsRow: { paddingHorizontal: 20, paddingVertical: 12 },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  catRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  catEmoji: { fontSize: 22, width: 28 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  catLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  catAmount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  barBg: { height: 6, backgroundColor: COLORS.background, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  catCount: { fontSize: 11, color: COLORS.textSecondary },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  subIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subIconText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  subName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  subAmount: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  empty: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
