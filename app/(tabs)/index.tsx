import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { subscriptionsApi } from '../../src/api/subscriptions';
import { analyticsApi } from '../../src/api/analytics';
import { COLORS, CATEGORIES } from '../../src/constants';
import { UpcomingPaymentCard } from '../../src/components/UpcomingPaymentCard';
import Svg, { Path as SvgPath, Rect } from 'react-native-svg';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { subscriptions, setSubscriptions } = useSubscriptionsStore();
  const { currency } = useSettingsStore();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [monthlyTrend, setMonthlyTrend] = React.useState<{ month: string; amount: number }[]>([]);
  const [categoryData, setCategoryData] = React.useState<{ category: string; amount: number }[]>([]);

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

  const fetchAnalytics = async () => {
    try {
      const [monthlyRes, categoryRes] = await Promise.all([
        analyticsApi.getMonthly().catch(() => null),
        analyticsApi.getByCategory().catch(() => null),
      ]);
      if (monthlyRes?.data) {
        const items = Array.isArray(monthlyRes.data) ? monthlyRes.data : monthlyRes.data.months || [];
        setMonthlyTrend(items.slice(-6));
      }
      if (categoryRes?.data) {
        const items = Array.isArray(categoryRes.data) ? categoryRes.data : categoryRes.data.categories || [];
        setCategoryData(items.slice(0, 5));
      }
    } catch {
      // analytics is non-critical
    }
  };

  useEffect(() => { fetchSubscriptions(); fetchAnalytics(); }, []);

  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL');
  const trialCount = subscriptions.filter((s) => s.status === 'TRIAL').length;
  const cancelledCount = subscriptions.filter((s) => s.status === 'CANCELLED').length;

  const totalMonthly = activeSubs.reduce((sum, s) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1 / 3 : s.billingPeriod === 'YEARLY' ? 1 / 12 : 1;
    return sum + s.amount * mult;
  }, 0);

  const trialSubs = subscriptions.filter((s) => s.status === 'TRIAL');

  const upcoming = subscriptions
    .filter((s) => {
      if (!s.nextPaymentDate) return false;
      const days = (new Date(s.nextPaymentDate).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => new Date(a.nextPaymentDate!).getTime() - new Date(b.nextPaymentDate!).getTime());

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
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubscriptions(true); fetchAnalytics(); }} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0] || ''} 👋</Text>
            <Text style={styles.subtitle}>{t('dashboard.subtitle')}</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/settings')}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </TouchableOpacity>
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
                <Text style={styles.miniAmount}>{sub.currency} {Number(sub.amount).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Monthly Trend Chart */}
        {monthlyTrend.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('dashboard.monthly_trend')}</Text>
            <View style={styles.chartCard}>
              <MonthlyBarChart data={monthlyTrend} />
            </View>
          </View>
        )}

        {/* Category Breakdown Donut */}
        {categoryData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('dashboard.by_category')}</Text>
            <View style={styles.donutCard}>
              <CategoryDonut categories={categoryData} />
            </View>
          </View>
        )}

        {/* Trial Tracker */}
        {trialSubs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('trials.title')}</Text>
            {trialSubs.map((sub) => {
              const endDate = sub.nextBillingDate || sub.nextPaymentDate;
              const daysLeft = endDate
                ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000))
                : null;
              const dotColor =
                daysLeft === null ? COLORS.textSecondary :
                daysLeft < 3 ? COLORS.error :
                daysLeft <= 7 ? COLORS.warning :
                COLORS.success;
              const monthlyAmount = (() => {
                const mult = sub.billingPeriod === 'WEEKLY' ? 4 : sub.billingPeriod === 'QUARTERLY' ? 1 / 3 : sub.billingPeriod === 'YEARLY' ? 1 / 12 : 1;
                return Number(sub.amount * mult).toFixed(2);
              })();
              return (
                <View key={sub.id} style={styles.trialCard}>
                  <View style={[styles.trialDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trialName}>{sub.name}</Text>
                    <Text style={styles.trialMeta}>
                      {daysLeft !== null
                        ? daysLeft === 0
                          ? t('trials.ends_today')
                          : daysLeft === 1
                            ? t('trials.ends_tomorrow')
                            : t('trials.days_left', { count: daysLeft })
                        : t('subscriptions.trial')}
                    </Text>
                  </View>
                  <Text style={styles.trialPrice}>
                    {t('trials.then')} {sub.currency} {monthlyAmount}{t('subscriptions.per_month')}
                  </Text>
                </View>
              );
            })}
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

function MonthlyBarChart({ data }: { data: { month: string; amount: number }[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const maxVal = Math.max(...data.map((d) => Number(d.amount) || 0), 1);
  const chartW = screenWidth - 80;
  const chartH = 140;
  const barW = Math.max(10, chartW / data.length - 6);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <View>
      <Svg width={chartW} height={chartH}>
        {data.map((d, i) => {
          const val = Number(d.amount) || 0;
          const barH = Math.max(4, (val / maxVal) * (chartH - 20));
          const x = i * (chartW / data.length) + (chartW / data.length - barW) / 2;
          const y = chartH - 20 - barH;
          return <Rect key={i} x={x} y={y} width={barW} height={barH} rx={4} fill={COLORS.primary} opacity={0.85} />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 2 }}>
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i) => {
          const monthStr = typeof d.month === 'string' ? d.month : String(d.month || '');
          const parts = monthStr.split('-');
          const label = monthNames[parseInt(parts[1] || '1', 10) - 1] || monthStr;
          return <Text key={i} style={{ fontSize: 10, color: COLORS.textSecondary }}>{label}</Text>;
        })}
      </View>
    </View>
  );
}

function CategoryDonut({ categories }: { categories: { category: string; amount: number }[] }) {
  const total = categories.reduce((sum, c) => sum + (isFinite(Number(c.amount)) ? Number(c.amount) : 0), 0);
  if (!total || !isFinite(total)) return null;

  const size = 160;
  const radius = 60;
  const innerRadius = 40;
  const cx = size / 2;
  const cy = size / 2;

  let startAngle = -Math.PI / 2;
  const slices = categories
    .filter((c) => isFinite(Number(c.amount)) && Number(c.amount) > 0)
    .map((cat) => {
    const fraction = Number(cat.amount) / total;
    const sweep = fraction * 2 * Math.PI;
    if (!isFinite(sweep) || sweep <= 0) return null;
    const catInfo = CATEGORIES.find((c) => c.id === cat.category);
    const color = catInfo?.color || '#757575';

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(startAngle + sweep);
    const y2 = cy + radius * Math.sin(startAngle + sweep);
    const ix1 = cx + innerRadius * Math.cos(startAngle + sweep);
    const iy1 = cy + innerRadius * Math.sin(startAngle + sweep);
    const ix2 = cx + innerRadius * Math.cos(startAngle);
    const iy2 = cy + innerRadius * Math.sin(startAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    startAngle += sweep;
    return { d, color, category: cat.category, emoji: catInfo?.emoji || '', label: catInfo?.label || cat.category, pct: Math.round(fraction * 100) };
  }).filter(Boolean) as { d: string; color: string; category: string; emoji: string; label: string; pct: number }[];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, idx) => (
          <SvgPath key={idx} d={slice.d} fill={slice.color} />
        ))}
      </Svg>
      <View style={{ flex: 1, gap: 6 }}>
        {slices.map((slice, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: slice.color }} />
            <Text style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>{slice.emoji} {slice.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textSecondary }}>{slice.pct}%</Text>
          </View>
        ))}
      </View>
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
  chartCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, height: 180 },
  donutCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16 },
  trialCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, marginBottom: 8 },
  trialDot: { width: 10, height: 10, borderRadius: 5 },
  trialName: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  trialMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  trialPrice: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
});
