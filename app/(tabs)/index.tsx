import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { COLORS, CATEGORIES } from '../../src/constants';
import { UpcomingPaymentCard } from '../../src/components/UpcomingPaymentCard';

// Mock data for demo
const MOCK_SUBS = [
  {
    id: '1', name: 'Netflix', category: 'streaming', amount: 15.99,
    currency: 'USD', period: 'monthly' as const, billingDay: 15,
    nextDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    status: 'active' as const, cardId: undefined, createdAt: new Date().toISOString(),
    plan: 'Premium',
  },
  {
    id: '2', name: 'Spotify', category: 'music', amount: 9.99,
    currency: 'USD', period: 'monthly' as const, billingDay: 1,
    nextDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    status: 'active' as const, cardId: undefined, createdAt: new Date().toISOString(),
    plan: 'Individual',
  },
  {
    id: '3', name: 'GitHub Copilot', category: 'productivity', amount: 10.00,
    currency: 'USD', period: 'monthly' as const, billingDay: 22,
    nextDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: 'trial' as const, cardId: undefined, createdAt: new Date().toISOString(),
  },
  {
    id: '4', name: 'iCloud+', category: 'cloud', amount: 2.99,
    currency: 'USD', period: 'monthly' as const, billingDay: 10,
    nextDate: new Date(Date.now() + 1 * 86400000).toISOString(),
    status: 'active' as const, cardId: undefined, createdAt: new Date().toISOString(),
  },
];

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { subscriptions, setSubscriptions } = useSubscriptionsStore();
  const { currency } = useSettingsStore();

  React.useEffect(() => {
    if (subscriptions.length === 0) {
      setSubscriptions(MOCK_SUBS);
    }
  }, []);

  const activeSubs = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial');
  const trialCount = subscriptions.filter((s) => s.status === 'trial').length;
  const cancelledCount = subscriptions.filter((s) => s.status === 'cancelled').length;

  const totalMonthly = activeSubs.reduce((sum, s) => {
    const mult = s.period === 'weekly' ? 4 : s.period === 'quarterly' ? 1 / 3 : s.period === 'yearly' ? 1 / 12 : 1;
    return sum + s.amount * mult;
  }, 0);

  const upcoming = subscriptions
    .filter((s) => {
      const days = (new Date(s.nextDate).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime());

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
            <Text style={styles.subtitle}>Here's your subscription overview</Text>
          </View>
          <TouchableOpacity style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0] || 'U'}</Text>
          </TouchableOpacity>
        </View>

        {/* Big Number */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total this month</Text>
          <Text style={styles.totalAmount}>
            {currency} {totalMonthly.toFixed(2)}
          </Text>
          <Text style={styles.totalSub}>per month · {activeSubs.length} active subscriptions</Text>

          {/* Mini donut placeholder */}
          <View style={styles.categoryRow}>
            {CATEGORIES.slice(0, 4).map((cat) => {
              const catSubs = subscriptions.filter((s) => s.category === cat.id);
              if (catSubs.length === 0) return null;
              return (
                <View key={cat.id} style={styles.catChip}>
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={styles.catLabel}>{cat.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <StatCard label="Active" value={subscriptions.filter((s) => s.status === 'active').length} color={COLORS.success} />
          <StatCard label="Trial" value={trialCount} color={COLORS.warning} />
          <StatCard label="Cancelled" value={cancelledCount} color={COLORS.error} />
        </View>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming (7 days)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {upcoming.map((sub) => (
                <UpcomingPaymentCard key={sub.id} subscription={sub} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* All active */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Subscriptions</Text>
          </View>
          {activeSubs.slice(0, 5).map((sub) => (
            <View key={sub.id} style={styles.miniCard}>
              <View style={[styles.miniIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Text style={styles.miniIconText}>{sub.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniName}>{sub.name}</Text>
                <Text style={styles.miniPlan}>{sub.plan || sub.category}</Text>
              </View>
              <Text style={styles.miniAmount}>
                {sub.currency} {sub.amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  totalCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 24,
    gap: 6,
  },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  totalAmount: { fontSize: 40, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  totalSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  categoryRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  catEmoji: { fontSize: 12 },
  catLabel: { fontSize: 11, color: '#FFF', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 0 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderTopWidth: 3,
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  section: { padding: 20, paddingBottom: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  miniIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniIconText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  miniName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  miniPlan: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'capitalize' },
  miniAmount: { fontSize: 14, fontWeight: '800', color: COLORS.text },
});
