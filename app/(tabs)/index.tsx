import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { subscriptionsApi } from '../../src/api/subscriptions';
import { COLORS, CATEGORIES } from '../../src/constants';
import { UpcomingPaymentCard } from '../../src/components/UpcomingPaymentCard';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { subscriptions, setSubscriptions } = useSubscriptionsStore();
  const { currency } = useSettingsStore();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchSubscriptions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await subscriptionsApi.getAll();
      setSubscriptions(res.data || []);
    } catch {
      // keep existing data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchSubscriptions(); }, []);

  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL');
  const trialCount = subscriptions.filter((s) => s.status === 'TRIAL').length;
  const cancelledCount = subscriptions.filter((s) => s.status === 'CANCELLED').length;

  const totalMonthly = activeSubs.reduce((sum, s) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1 / 3 : s.billingPeriod === 'YEARLY' ? 1 / 12 : 1;
    return sum + s.amount * mult;
  }, 0);

  const upcoming = subscriptions
    .filter((s) => {
      const days = (new Date(s.nextPaymentDate).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime());

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.good_morning');
    if (h < 17) return t('dashboard.good_afternoon');
    return t('dashboard.good_evening');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubscriptions(true); }} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0] || ''} 👋</Text>
            <Text style={styles.subtitle}>{t('dashboard.subtitle')}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
        </View>

        {/* Big Number */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('dashboard.total_month')}</Text>
          <Text style={styles.totalAmount}>{currency} {totalMonthly.toFixed(2)}</Text>
          <Text style={styles.totalSub}>
            {t('dashboard.per_month')} · {activeSubs.length} {t('dashboard.active_subscriptions')}
          </Text>
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
          <StatCard label={t('subscriptions.active')} value={subscriptions.filter((s) => s.status === 'ACTIVE').length} color={COLORS.success} />
          <StatCard label={t('subscriptions.trial')} value={trialCount} color={COLORS.warning} />
          <StatCard label={t('subscriptions.cancelled')} value={cancelledCount} color={COLORS.error} />
        </View>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('dashboard.upcoming_7')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {upcoming.map((sub) => (
                <UpcomingPaymentCard key={sub.id} subscription={sub} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Active subs */}
        {activeSubs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('dashboard.active_subs_title')}</Text>
            {activeSubs.slice(0, 5).map((sub) => (
              <View key={sub.id} style={styles.miniCard}>
                <View style={[styles.miniIcon, { backgroundColor: COLORS.primaryLight }]}>
                  <Text style={styles.miniIconText}>{sub.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniName}>{sub.name}</Text>
                  <Text style={styles.miniPlan}>{sub.plan || sub.category}</Text>
                </View>
                <Text style={styles.miniAmount}>{sub.currency} {sub.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {subscriptions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>{t('subscriptions.empty')}</Text>
            <Text style={styles.emptyHint}>{t('subscriptions.empty_hint')}</Text>
          </View>
        )}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  greeting: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  totalCard: { marginHorizontal: 20, backgroundColor: COLORS.primary, borderRadius: 24, padding: 24, gap: 6 },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  totalAmount: { fontSize: 40, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  totalSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  categoryRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  catEmoji: { fontSize: 12 },
  catLabel: { fontSize: 11, color: '#FFF', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 0 },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderTopWidth: 3, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  section: { padding: 20, paddingBottom: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  miniCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surface, borderRadius: 14, padding: 12, marginBottom: 8 },
  miniIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  miniIconText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  miniName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  miniPlan: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'capitalize' },
  miniAmount: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyHint: { fontSize: 14, color: COLORS.textSecondary },
});
