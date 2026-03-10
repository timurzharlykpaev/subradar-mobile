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
import { Ionicons } from '@expo/vector-icons';
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
        const raw = Array.isArray(monthlyRes.data) ? monthlyRes.data : monthlyRes.data.months || [];
        // Backend returns { label: '2025-04', total: 45 } — normalize to { month, amount }
        const items = raw.map((d: any) => ({
          month: d.month ?? d.label ?? '',
          amount: Number(d.amount ?? d.total ?? 0),
        })).filter((d: any) => d.month);
        setMonthlyTrend(items.slice(-6));
      }
      if (categoryRes?.data) {
        const raw = Array.isArray(categoryRes.data) ? categoryRes.data : categoryRes.data.categories || [];
        // API returns { category: "STREAMING", total: 15.99 } — normalize to { category, amount }
        const items = raw.map((d: any) => ({
          category: d.category,
          amount: Number(d.amount ?? d.total ?? 0),
        })).filter((d: any) => d.amount > 0);
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
    return sum + (Number(s.amount) || 0) * mult;
  }, 0);

  // Forecast: next 30 days
  const upcomingNext30 = subscriptions.filter((s) => {
    if (!s.nextPaymentDate) return false;
    const date = new Date(s.nextPaymentDate);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return date >= now && date <= in30;
  });
  const forecast30 = Number(upcomingNext30.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)) || 0;

  // Potential savings: duplicate categories
  const categoryCounts = subscriptions.reduce((acc, s) => {
    if (s.status !== 'ACTIVE' && s.status !== 'TRIAL') return acc;
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const duplicateCategories = Object.entries(categoryCounts).filter(([, count]) => count > 1);

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

        {/* Forecast Block */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.forecast_title')}</Text>
          <View style={styles.forecastRow}>
            <View style={[styles.forecastCard, { flex: 1 }]}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              <Text style={styles.forecastLabel}>{t('dashboard.next_30_days')}</Text>
              <Text style={styles.forecastAmount}>{currency} {(forecast30 || 0).toFixed(2)}</Text>
              <Text style={styles.forecastSub}>{upcomingNext30.length} {t('dashboard.subscriptions_label')}</Text>
            </View>
            <View style={[styles.forecastCard, { flex: 1 }]}>
              <Ionicons name="trending-up-outline" size={20} color={COLORS.success} />
              <Text style={styles.forecastLabel}>{t('dashboard.per_year')}</Text>
              <Text style={styles.forecastAmount}>{currency} {(totalMonthly * 12).toFixed(2)}</Text>
              <Text style={styles.forecastSub}>{t('dashboard.annually')}</Text>
            </View>
          </View>
        </View>

        {/* Potential Savings */}
        {duplicateCategories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.savingsCard}>
              <Ionicons name="bulb-outline" size={22} color={COLORS.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.savingsTitle}>{t('dashboard.potential_savings')}</Text>
                <Text style={styles.savingsSub}>{duplicateCategories.length} {t('dashboard.possible_duplicates')}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')} style={styles.reviewBtn}>
                <Text style={styles.reviewBtnText}>{t('dashboard.review')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Monthly Trend Chart */}
        {monthlyTrend.length > 0 && monthlyTrend.some(d => d.amount > 0) && (
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
              const endDate = sub.nextPaymentDate;
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

        {/* Quick Actions */}
        <View style={[styles.section, { paddingBottom: 20 }]}>
          <Text style={styles.sectionTitle}>{t('dashboard.quick_actions')}</Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <QuickAction
              icon="add-circle-outline"
              label={t('dashboard.add_subscription')}
              onPress={() => router.push('/(tabs)/add')}
              color={COLORS.primary}
            />
            <QuickAction
              icon="document-text-outline"
              label={t('dashboard.generate_report')}
              onPress={() => router.push('/reports')}
              color="#34D399"
            />
            <QuickAction
              icon="star-outline"
              label={t('dashboard.upgrade_pro')}
              onPress={() => router.push('/paywall')}
              color={COLORS.warning}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, minWidth: '45%', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border }}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
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
  const chartW = screenWidth - 80;
  const chartH = 120;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hasData = data.some((d) => Number(d.amount) > 0);
  const maxVal = Math.max(...data.map((d) => Number(d.amount) || 0), 1);
  const barW = Math.max(8, chartW / Math.max(data.length, 1) - 8);

  if (!hasData) {
    return (
      <View style={{ height: chartH + 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, color: COLORS.textMuted }}>Нет данных за этот период</Text>
      </View>
    );
  }

  return (
    <View>
      <Svg width={chartW} height={chartH}>
        {data.map((d, i) => {
          const val = Number(d.amount) || 0;
          const barH = Math.max(4, (val / maxVal) * (chartH - 16));
          const x = i * (chartW / data.length) + (chartW / data.length - barW) / 2;
          const y = chartH - barH;
          const isMax = val === maxVal;
          return (
            <Rect
              key={i} x={x} y={y} width={barW} height={barH} rx={5}
              fill={isMax ? COLORS.primary : 'rgba(139,92,246,0.35)'}
            />
          );
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 6 }}>
        {data.map((d, i) => {
          const monthStr = typeof d.month === 'string' ? d.month : String(d.month || '');
          const parts = monthStr.split('-');
          const monthIdx = parts.length >= 2 ? parseInt(parts[1], 10) - 1 : parseInt(monthStr, 10) - 1;
          const label = monthNames[monthIdx] || monthStr;
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
  totalCard: { marginHorizontal: 20, backgroundColor: COLORS.primary, borderRadius: 24, padding: 24, gap: 6, shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  totalAmount: { fontSize: 40, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  totalSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  categoryRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  catEmoji: { fontSize: 12 },
  catLabel: { fontSize: 11, color: '#FFF', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 0 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderTopWidth: 3, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  section: { padding: 20, paddingBottom: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  miniCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  miniIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniIconText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  miniName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  miniPlan: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'capitalize' },
  miniAmount: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyHint: { fontSize: 14, color: COLORS.textSecondary },
  chartCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  donutCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  trialCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  trialDot: { width: 10, height: 10, borderRadius: 5 },
  trialName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  trialMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  trialPrice: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  forecastRow: { flexDirection: 'row', gap: 10 },
  forecastCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  forecastLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginTop: 4 },
  forecastAmount: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  forecastSub: { fontSize: 11, color: COLORS.textMuted },
  savingsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  savingsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  savingsSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  reviewBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  reviewBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
