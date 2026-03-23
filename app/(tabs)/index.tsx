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
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { subscriptionsApi } from '../../src/api/subscriptions';
import { analyticsApi } from '../../src/api/analytics';
import { useBillingStatus } from '../../src/hooks/useBilling';
import { CATEGORIES } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { CategoryIcon } from '../../src/components/icons';
import Svg, { Path as SvgPath, Rect, Text as SvgText } from 'react-native-svg';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { subscriptions, setSubscriptions } = useSubscriptionsStore();
  const { currency } = useSettingsStore();
  const { colors, isDark } = useTheme();
  const { data: billing } = useBillingStatus();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [monthlyTrend, setMonthlyTrend] = React.useState<{ month: string; amount: number }[]>([]);
  const [categoryData, setCategoryData] = React.useState<{ category: string; amount: number }[]>([]);

  const fetchSubscriptions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await subscriptionsApi.getAll();
      setSubscriptions(res.data || []);
    } catch {} finally {
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
        const items = raw.map((d: any) => ({
          month: d.month ?? d.label ?? '',
          amount: Number(d.amount ?? d.total ?? 0),
        })).filter((d: any) => d.month);
        setMonthlyTrend(items.slice(-6));
      }
      if (categoryRes?.data) {
        const raw = Array.isArray(categoryRes.data) ? categoryRes.data : categoryRes.data.categories || [];
        const items = raw.map((d: any) => ({
          category: d.category,
          amount: Number(d.amount ?? d.total ?? 0),
        })).filter((d: any) => d.amount > 0);
        setCategoryData(items.slice(0, 5));
      }
    } catch {}
  };

  useEffect(() => { fetchSubscriptions(); fetchAnalytics(); }, []);

  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL');
  const trialSubs = subscriptions.filter((s) => s.status === 'TRIAL');
  const cancelledCount = subscriptions.filter((s) => s.status === 'CANCELLED').length;

  const totalMonthly = activeSubs.reduce((sum, s) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1 / 3 : s.billingPeriod === 'YEARLY' ? 1 / 12 : 1;
    return sum + (Number(s.amount) || 0) * mult;
  }, 0);

  // Previous month estimate from trend data
  const prevMonthAmount = monthlyTrend.length >= 2 ? monthlyTrend[monthlyTrend.length - 2]?.amount || 0 : 0;
  const delta = prevMonthAmount > 0 ? ((totalMonthly - prevMonthAmount) / prevMonthAmount * 100) : 0;

  const upcomingNext7 = subscriptions
    .filter((s) => {
      if (!s.nextPaymentDate) return false;
      const days = (new Date(s.nextPaymentDate).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => new Date(a.nextPaymentDate!).getTime() - new Date(b.nextPaymentDate!).getTime());

  const upcomingNext30 = subscriptions.filter((s) => {
    if (!s.nextPaymentDate) return false;
    const date = new Date(s.nextPaymentDate);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    return date >= now && date <= in30;
  });
  const forecast30 = upcomingNext30.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const duplicateCategories = Object.entries(
    subscriptions.reduce((acc, s) => {
      if (s.status !== 'ACTIVE' && s.status !== 'TRIAL') return acc;
      acc[s.category] = (acc[s.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).filter(([, count]) => count > 1);

  const isPro = billing?.plan === 'pro' || billing?.plan === 'organization';

  if (loading) {
    return (
      <SafeAreaView testID="dashboard-screen-loading" style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="dashboard-screen" edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        testID="dashboard-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubscriptions(true); fetchAnalytics(); }} />
        }
      >
        {isPro && (
          <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <View style={[styles.planBadge, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="diamond" size={12} color={colors.primary} />
              <Text style={[styles.planBadgeText, { color: colors.primary }]}>PRO</Text>
            </View>
          </View>
        )}

        {/* ── Hero Card: Total Spend ────────────────────────────── */}
        <View testID="dashboard-hero-card" style={[styles.heroCard, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
          <Text style={styles.heroLabel}>{t('dashboard.total_month')}</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroAmount}>{currency} {totalMonthly.toFixed(2)}</Text>
            {delta !== 0 && (
              <View style={[styles.deltaBadge, { backgroundColor: delta > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)' }]}>
                <Ionicons name={delta > 0 ? 'arrow-up' : 'arrow-down'} size={10} color={delta > 0 ? '#FCA5A5' : '#86EFAC'} />
                <Text style={[styles.deltaText, { color: delta > 0 ? '#FCA5A5' : '#86EFAC' }]}>
                  {Math.abs(delta).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Ionicons name="repeat-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroMetaText}>{activeSubs.length} {t('dashboard.active_subs', 'active subs')}</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroMetaText}>{currency} {(totalMonthly * 12).toFixed(0)}/{t('paywall.year', 'yr')}</Text>
            </View>
          </View>
        </View>

        {/* ── Quick Stats ────────────────────────────────────── */}
        <View testID="dashboard-stats-row" style={styles.statsRow}>
          <StatCard icon="checkmark-circle" label={t('subscriptions.active')} value={activeSubs.length} color={colors.success} />
          <StatCard icon="time" label={t('subscriptions.trial')} value={trialSubs.length} color={colors.warning} />
          <StatCard icon="close-circle" label={t('subscriptions.cancelled')} value={cancelledCount} color={colors.error} />
        </View>

        {/* ── Upcoming 7 Days ────────────────────────────────── */}
        {upcomingNext7.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.upcoming_7')}</Text>
              <Text style={[styles.sectionCount, { color: colors.primary }]}>{upcomingNext7.length}</Text>
            </View>
            <ScrollView testID="dashboard-upcoming-list" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {upcomingNext7.map((sub) => {
                const days = Math.ceil((new Date(sub.nextPaymentDate!).getTime() - Date.now()) / 86400000);
                const cat = CATEGORIES.find((c) => c.id === sub.category);
                const urgent = days <= 1;
                return (
                  <TouchableOpacity
                    testID={`dashboard-upcoming-${sub.id}`}
                    key={sub.id}
                    style={[styles.upcomingCard, { backgroundColor: colors.card, borderColor: urgent ? colors.warning + '60' : colors.border }]}
                    onPress={() => router.push(`/subscription/${sub.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.upcomingTop}>
                      <CategoryIcon category={sub.category} size={24} />
                      {urgent && <View style={[styles.urgentDot, { backgroundColor: colors.warning }]} />}
                    </View>
                    <Text style={[styles.upcomingName, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                    <Text style={[styles.upcomingAmount, { color: colors.primary }]}>{sub.currency} {Number(sub.amount).toFixed(0)}</Text>
                    <Text style={[styles.upcomingDays, { color: urgent ? colors.warning : colors.textSecondary }]}>
                      {days === 0 ? t('upcoming.today') : days === 1 ? t('upcoming.tomorrow') : t('upcoming.in_days', { count: days })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Forecast ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.forecast_title')}</Text>
          <View testID="dashboard-forecast-row" style={styles.forecastRow}>
            <ForecastBox icon="calendar" label={t('dashboard.next_30_days')} amount={`${currency} ${forecast30.toFixed(0)}`} sub={`${upcomingNext30.length} ${t('dashboard.subscriptions_label')}`} color={colors.primary} />
            <ForecastBox icon="trending-up" label="6 {t('paywall.month', 'mo')}" amount={`${currency} ${(totalMonthly * 6).toFixed(0)}`} sub={t('dashboard.forecast_title')} color={colors.success} />
            <ForecastBox icon="analytics" label="12 {t('paywall.month', 'mo')}" amount={`${currency} ${(totalMonthly * 12).toFixed(0)}`} sub={t('dashboard.annually')} color={colors.warning} />
          </View>
        </View>

        {/* ── Trial Tracker ──────────────────────────────────── */}
        {trialSubs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('trials.title')}</Text>
              <View style={[styles.sectionCountBadge, { backgroundColor: colors.warning + '20' }]}>
                <Text style={[styles.sectionCountBadgeText, { color: colors.warning }]}>{trialSubs.length}</Text>
              </View>
            </View>
            {trialSubs.map((sub) => {
              const endDate = sub.nextPaymentDate;
              const daysLeft = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)) : null;
              const dotColor = daysLeft === null ? colors.textSecondary : daysLeft < 3 ? colors.error : daysLeft <= 7 ? colors.warning : colors.success;
              return (
                <TouchableOpacity
                  testID={`dashboard-trial-${sub.id}`}
                  key={sub.id}
                  style={[styles.trialCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/subscription/${sub.id}` as any)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.trialDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trialName, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                    <Text style={[styles.trialMeta, { color: colors.textSecondary }]}>
                      {daysLeft !== null
                        ? daysLeft === 0 ? t('trials.ends_today') : daysLeft === 1 ? t('trials.ends_tomorrow') : t('trials.days_left', { count: daysLeft })
                        : t('subscriptions.trial')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.trialPrice, { color: colors.text }]}>{sub.currency} {Number(sub.amount).toFixed(2)}</Text>
                    <Text style={[styles.trialPriceSub, { color: colors.textMuted }]}>{t('trials.then')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Active Subscriptions ──────────────────────────── */}
        {activeSubs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.active_subs_title')}</Text>
              <TouchableOpacity testID="btn-see-all-subs" onPress={() => router.push('/(tabs)/subscriptions')}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>{t('common.all')}</Text>
              </TouchableOpacity>
            </View>
            {activeSubs.slice(0, 4).map((sub) => {
              const cat = CATEGORIES.find((c) => c.id === sub.category);
              return (
                <TouchableOpacity
                  testID={`dashboard-sub-${sub.id}`}
                  key={sub.id}
                  style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/subscription/${sub.id}` as any)}
                  activeOpacity={0.8}
                >
                  {sub.iconUrl ? (
                    <Image source={{ uri: sub.iconUrl }} style={styles.subIcon} cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.subIconPlaceholder, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.subIconText, { color: colors.primary }]}>{sub.name[0]}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.subName, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                    <Text style={[styles.subPlan, { color: colors.textSecondary }]} numberOfLines={1}>
                      {sub.currentPlan || cat?.label || sub.category}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                    <Text style={[styles.subAmount, { color: colors.text }]} numberOfLines={1}>{sub.currency} {Number(sub.amount).toFixed(2)}</Text>
                    <Text style={[styles.subPeriod, { color: colors.textMuted }]}>/{sub.billingPeriod?.toLowerCase()?.replace('monthly', t('paywall.month', 'mo'))?.replace('yearly', t('paywall.year', 'yr'))}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Potential Savings ──────────────────────────────── */}
        {duplicateCategories.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              testID="btn-potential-savings"
              style={[styles.savingsCard, { backgroundColor: isDark ? '#1C2A20' : '#ECFDF5', borderColor: isDark ? '#22543D' : '#A7F3D0' }]}
              onPress={() => router.push('/(tabs)/analytics')}
              activeOpacity={0.8}
            >
              <View style={[styles.savingsIcon, { backgroundColor: isDark ? '#22543D' : '#D1FAE5' }]}>
                <Ionicons name="bulb" size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.savingsTitle, { color: colors.text }]}>{t('dashboard.potential_savings')}</Text>
                <Text style={[styles.savingsSub, { color: colors.textSecondary }]}>
                  {duplicateCategories.length} {t('dashboard.possible_duplicates')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Monthly Trend ─────────────────────────────────── */}
        {monthlyTrend.length > 0 && monthlyTrend.some(d => d.amount > 0) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.monthly_trend')}</Text>
            <View testID="dashboard-monthly-chart" style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MonthlyBarChart data={monthlyTrend} />
            </View>
          </View>
        )}

        {/* ── Category Breakdown ─────────────────────────────── */}
        {categoryData.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.by_category')}</Text>
            <View testID="dashboard-category-chart" style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <CategoryDonut categories={categoryData} />
            </View>
          </View>
        )}

        {/* ── Empty State ────────────────────────────────────── */}
        {subscriptions.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="add-circle" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>{t('subscriptions.empty')}</Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>{t('subscriptions.empty_hint')}</Text>
          </View>
        )}

        {/* ── Quick Actions ──────────────────────────────────── */}
        <View style={[styles.section, { paddingBottom: 20 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.quick_actions')}</Text>
          <View testID="dashboard-quick-actions" style={styles.actionsRow}>
            <QuickAction icon="add-circle-outline" label={t('dashboard.add_subscription')} onPress={() => router.push('/(tabs)/subscriptions')} color={colors.primary} />
            <QuickAction icon="document-text-outline" label={t('dashboard.generate_report')} onPress={() => router.push('/reports')} color={colors.success} />
            {!isPro && (
              <QuickAction icon="diamond-outline" label={t('dashboard.upgrade_pro')} onPress={() => router.push('/paywall')} color={colors.warning} />
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ForecastBox({ icon, label, amount, sub, color }: { icon: string; label: string; amount: string; sub: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.forecastCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.forecastIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[styles.forecastAmount, { color: colors.text }]}>{amount}</Text>
      <Text style={[styles.forecastSub, { color: colors.textMuted }]} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; color: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.8}>
      <View style={[styles.actionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function MonthlyBarChart({ data }: { data: { month: string; amount: number }[] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const chartW = screenWidth - 80;
  const chartH = 130;
  const hasData = data.some((d) => Number(d.amount) > 0);
  const maxVal = Math.max(...data.map((d) => Number(d.amount) || 0), 1);
  const barW = Math.max(8, chartW / Math.max(data.length, 1) - 8);

  if (!hasData) {
    return (
      <View style={{ height: chartH + 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, color: colors.textMuted }}>{t('common.no_data_period')}</Text>
      </View>
    );
  }

  return (
    <View>
      <Svg width={chartW} height={chartH + 18}>
        {(() => {
          const values = data.map((d) => Number(d.amount) || 0);
          const allSame = values.every((v) => v === values[0]);
          const topPadding = 24;
          return data.map((d, i) => {
            const val = Number(d.amount) || 0;
            const barH = Math.max(4, (val / maxVal) * (chartH - topPadding));
            const x = i * (chartW / data.length) + (chartW / data.length - barW) / 2;
            const y = chartH - barH + 18;
            const isMax = val === maxVal;
            return (
              <React.Fragment key={i}>
                <Rect x={x} y={y} width={barW} height={barH} rx={5} fill={isMax ? colors.primary : `${colors.primary}55`} />
                {val > 0 && (
                  <SvgText x={x + barW / 2} y={y - 6} fontSize={9} fontWeight="700" fill={isMax ? colors.primary : colors.textMuted} textAnchor="middle">
                    {val >= 1000 ? `$ ${(val / 1000).toFixed(1)}k` : `$ ${val.toFixed(0)}`}
                  </SvgText>
                )}
              </React.Fragment>
            );
          });
        })()}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 6 }}>
        {data.map((d, i) => {
          const monthStr = typeof d.month === 'string' ? d.month : String(d.month || '');
          const parts = monthStr.split('-');
          const monthNum = parts.length >= 2 ? parseInt(parts[1], 10) : parseInt(monthStr, 10);
          const label = t(`months.${monthNum}`, { defaultValue: monthStr });
          return <Text key={i} style={{ fontSize: 10, color: colors.textSecondary }}>{label}</Text>;
        })}
      </View>
    </View>
  );
}

function CategoryDonut({ categories }: { categories: { category: string; amount: number }[] }) {
  const { colors } = useTheme();
  const total = categories.reduce((sum, c) => sum + (isFinite(Number(c.amount)) ? Number(c.amount) : 0), 0);
  if (!total || !isFinite(total)) return null;

  const size = 140;
  const radius = 56;
  const innerRadius = 38;
  const cx = size / 2;
  const cy = size / 2;

  let startAngle = -Math.PI / 2;
  const slices = categories
    .filter((c) => isFinite(Number(c.amount)) && Number(c.amount) > 0)
    .map((cat) => {
      const fraction = Number(cat.amount) / total;
      const sweep = Math.min(fraction, 0.999) * 2 * Math.PI;
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
      const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
      startAngle += sweep;
      return { d, color, categoryId: catInfo?.id || 'OTHER', label: catInfo?.label || cat.category, pct: Math.round(fraction * 100) };
    }).filter(Boolean) as { d: string; color: string; categoryId: string; label: string; pct: number }[];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, idx) => <SvgPath key={idx} d={slice.d} fill={slice.color} />)}
      </Svg>
      <View style={{ flex: 1, gap: 8 }}>
        {slices.map((slice, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: slice.color }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
              <CategoryIcon category={slice.categoryId} size={14} />
              <Text style={{ fontSize: 13, color: colors.text, flex: 1 }} numberOfLines={1}>{slice.label}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>{slice.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  planBadgeText: { fontSize: 11, fontWeight: '800' },

  // Hero card
  heroCard: { marginHorizontal: 20, marginTop: 8, borderRadius: 24, padding: 22, gap: 4, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10, overflow: 'hidden' },
  heroDecor1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -30 },
  heroDecor2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -40, left: -20 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  heroAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroAmount: { fontSize: 36, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  deltaText: { fontSize: 12, fontWeight: '800' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 10 },
  heroMetaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroMetaDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  statCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1 },
  statIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600' },

  // Section
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionCount: { fontSize: 14, fontWeight: '700' },
  sectionCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sectionCountBadgeText: { fontSize: 12, fontWeight: '800' },
  seeAll: { fontSize: 14, fontWeight: '700' },

  // Upcoming cards
  upcomingCard: { width: 130, borderRadius: 16, padding: 14, marginRight: 10, borderWidth: 1, gap: 4 },
  upcomingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  urgentDot: { width: 8, height: 8, borderRadius: 4 },
  upcomingName: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  upcomingAmount: { fontSize: 15, fontWeight: '800' },
  upcomingDays: { fontSize: 11, fontWeight: '600' },

  // Forecast
  forecastRow: { flexDirection: 'row', gap: 8 },
  forecastCard: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1, alignItems: 'center', gap: 6 },
  forecastIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  forecastAmount: { fontSize: 16, fontWeight: '900' },
  forecastSub: { fontSize: 10, fontWeight: '600' },

  // Trials
  trialCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1 },
  trialDot: { width: 10, height: 10, borderRadius: 5 },
  trialName: { fontSize: 15, fontWeight: '700' },
  trialMeta: { fontSize: 12, marginTop: 2 },
  trialPrice: { fontSize: 14, fontWeight: '700' },
  trialPriceSub: { fontSize: 10 },

  // Active subs
  subCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1 },
  subIcon: { width: 40, height: 40, borderRadius: 12 },
  subIconPlaceholder: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  subIconText: { fontSize: 16, fontWeight: '800' },
  subName: { fontSize: 14, fontWeight: '700' },
  subPlan: { fontSize: 12, marginTop: 1 },
  subAmount: { fontSize: 14, fontWeight: '800' },
  subPeriod: { fontSize: 10 },

  // Savings
  savingsCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, borderWidth: 1 },
  savingsIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  savingsTitle: { fontSize: 14, fontWeight: '700' },
  savingsSub: { fontSize: 12, marginTop: 2 },

  // Charts
  chartCard: { borderRadius: 20, padding: 16, borderWidth: 1 },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText: { fontSize: 18, fontWeight: '700' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
