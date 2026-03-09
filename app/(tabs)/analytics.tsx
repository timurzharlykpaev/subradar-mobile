import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { analyticsApi } from '../../src/api/analytics';
import { useBillingStatus } from '../../src/hooks/useBilling';
import { COLORS, CATEGORIES } from '../../src/constants';
import { CartesianChart, Bar } from 'victory-native';
import { Pie, type PieSliceData } from 'victory-native';
import { LinearGradient, vec } from '@shopify/react-native-skia';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 220;

const CARD_BG = '#1A1A2E';
const CARD_RADIUS = 16;

const PERIOD_SHORT: Record<string, string> = {
  WEEKLY: 'wk',
  MONTHLY: 'mo',
  QUARTERLY: 'qt',
  YEARLY: 'yr',
  LIFETIME: '∞',
  ONE_TIME: '1x',
};

export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const { subscriptions } = useSubscriptionsStore();
  const { data: billingStatus } = useBillingStatus();
  const isPro = billingStatus?.plan === 'pro' || billingStatus?.plan === 'organization';

  const [summary, setSummary] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<{ month: string; total: number }[]>([]);
  const [byCategoryData, setByCategoryData] = useState<any[]>([]);
  const [byCardData, setByCardData] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [savings, setSavings] = useState<any>(null);

  useEffect(() => {
    analyticsApi.getSummary().then((r) => setSummary(r.data)).catch(() => {});
    analyticsApi.getMonthly().then((r) => {
      const raw = r.data || [];
      const data = raw.map((d: any) => ({
        month: (d.label || d.month || '').slice(-5) || '',
        total: d.total ?? d.amount ?? 0,
      }));
      setMonthlyData(data.slice(-12));
    }).catch(() => {});
    analyticsApi.getByCategory().then((r) => {
      setByCategoryData(r.data || []);
    }).catch(() => {});
    analyticsApi.getByCard().then((r) => {
      setByCardData(r.data || []);
    }).catch(() => {});
    analyticsApi.getForecast().then((r) => setForecast(r.data)).catch(() => {});
    analyticsApi.getSavings().then((r) => setSavings(r.data)).catch(() => {});
  }, []);

  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL');

  const getMonthlyAmount = (s: typeof activeSubs[0]) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4
      : s.billingPeriod === 'QUARTERLY' ? 1 / 3
      : s.billingPeriod === 'YEARLY' ? 1 / 12
      : s.billingPeriod === 'LIFETIME' ? 0
      : s.billingPeriod === 'ONE_TIME' ? 0
      : 1;
    return s.amount * mult;
  };

  const totalMonthly = summary?.totalMonthly ?? activeSubs.reduce((sum, s) => sum + getMonthlyAmount(s), 0);
  const totalYearly = summary?.totalYearly ?? totalMonthly * 12;
  const mostExpensive = activeSubs.reduce<typeof activeSubs[0] | null>(
    (max, s) => (!max || s.amount > max.amount ? s : max), null,
  );

  // Category breakdown
  const byCategory = byCategoryData.length > 0
    ? byCategoryData.map((d: any) => {
        const cat = CATEGORIES.find((c) => c.id.toUpperCase() === d.category);
        return {
          id: d.category,
          label: d.category,
          emoji: cat?.emoji || '📦',
          color: cat?.color || '#757575',
          total: d.total ?? d.amount ?? 0,
          count: d.count ?? 0,
        };
      })
    : CATEGORIES.map((cat) => {
        const catSubs = activeSubs.filter((s) => s.category?.toUpperCase() === cat.id.toUpperCase());
        return { ...cat, total: catSubs.reduce((sum, s) => sum + s.amount, 0), count: catSubs.length };
      }).filter((c) => c.count > 0);

  const categoryTotal = byCategory.reduce((sum, c) => sum + c.total, 0);

  // Top 5 most expensive
  const top5 = [...activeSubs]
    .sort((a, b) => getMonthlyAmount(b) - getMonthlyAmount(a))
    .slice(0, 5);

  // Card breakdown
  const cardBreakdown = byCardData.length > 0
    ? byCardData
    : (() => {
        const map = new Map<string, { label: string; total: number }>();
        activeSubs.forEach((s) => {
          const cardLabel = s.paymentCard
            ? `${s.paymentCard.brand} ****${s.paymentCard.last4}`
            : t('common.no_card');
          const key = s.paymentCardId || 'unknown';
          const existing = map.get(key);
          if (existing) {
            existing.total += getMonthlyAmount(s);
          } else {
            map.set(key, { label: cardLabel, total: getMonthlyAmount(s) });
          }
        });
        return Array.from(map.values());
      })();

  const cardMax = Math.max(...cardBreakdown.map((c: any) => c.total ?? c.amount ?? 0), 1);

  // Pie chart data
  const pieData: PieSliceData[] = byCategory.length > 0
    ? byCategory.map((cat) => ({
        value: cat.total,
        color: cat.color,
        label: cat.label,
      }))
    : [{ value: 1, color: '#757575', label: t('analytics.no_data') }];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('analytics.title')}</Text>
          <Text style={styles.subtitle}>{t('analytics.subtitle')}</Text>
        </View>

        {/* Summary Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatCard label={t('analytics.avg_month')} value={`$${Number(totalMonthly).toFixed(0)}`} />
          <StatCard label={t('analytics.total_year')} value={`$${Number(totalYearly).toFixed(0)}`} />
          {mostExpensive && (
            <StatCard label={t('analytics.most_expensive')} value={mostExpensive.name} sub={`$${Number(mostExpensive.amount).toFixed(0)}/mo`} />
          )}
        </ScrollView>

        {/* 1. Monthly Bar Chart (Victory) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('analytics.monthly_spend')}</Text>
          {monthlyData.length > 0 ? (
            <View style={{ height: CHART_HEIGHT }}>
              <CartesianChart
                data={monthlyData}
                xKey="month"
                yKeys={['total']}
                domainPadding={{ left: 20, right: 20, top: 20 }}
                axisOptions={{
                  font: null,
                  tickCount: { x: Math.min(monthlyData.length, 6), y: 4 },
                  formatXLabel: (val) => String(val).slice(-2),
                  labelColor: '#9CA3AF',
                  lineColor: 'rgba(255,255,255,0.1)',
                }}
              >
                {({ points, chartBounds }) => (
                  <Bar
                    points={points.total}
                    chartBounds={chartBounds}
                    roundedCorners={{ topLeft: 6, topRight: 6 }}
                    barWidth={Math.max(12, (SCREEN_WIDTH - 120) / monthlyData.length - 8)}
                  >
                    <LinearGradient
                      start={vec(0, 0)}
                      end={vec(0, CHART_HEIGHT)}
                      colors={['#8B5CF6', '#6C47FF']}
                    />
                  </Bar>
                )}
              </CartesianChart>
            </View>
          ) : (
            <Text style={styles.empty}>{t('analytics.no_data')}</Text>
          )}
        </View>

        {/* 2. Category Donut Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('analytics.by_category')}</Text>
          {byCategory.length > 0 ? (
            <>
              <View style={styles.pieContainer}>
                <View style={{ height: 200, width: 200 }}>
                  <Pie.Chart
                    data={pieData}
                    innerRadius={55}
                  >
                    {({ slice }) => (
                      <Pie.Slice key={slice.label} />
                    )}
                  </Pie.Chart>
                </View>
                <View style={styles.pieCenterLabel}>
                  <Text style={styles.pieCenterAmount}>${Number(categoryTotal).toFixed(0)}</Text>
                  <Text style={styles.pieCenterSub}>{t('analytics.avg_month')}</Text>
                </View>
              </View>
              {/* Legend */}
              <View style={styles.legendContainer}>
                {byCategory.map((cat) => (
                  <View key={cat.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.legendEmoji}>{cat.emoji}</Text>
                    <Text style={styles.legendLabel} numberOfLines={1}>{cat.label}</Text>
                    <Text style={styles.legendAmount}>${Number(cat.total).toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.empty}>{t('analytics.no_data')}</Text>
          )}
        </View>

        {/* 3. Card Breakdown */}
        {cardBreakdown.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('analytics.card_breakdown')}</Text>
            {cardBreakdown.map((card: any, i: number) => {
              const amount = card.total ?? card.amount ?? 0;
              return (
                <View key={card.label || i} style={styles.cardBreakdownRow}>
                  <Text style={styles.cardBreakdownIcon}>💳</Text>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.cardBreakdownLabelRow}>
                      <Text style={styles.cardBreakdownLabel} numberOfLines={1}>{card.label || card.nickname || `Card ${i + 1}`}</Text>
                      <Text style={styles.cardBreakdownAmount}>${Number(amount).toFixed(2)}</Text>
                    </View>
                    <View style={styles.barBg}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${(amount / cardMax) * 100}%`,
                            backgroundColor: COLORS.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 4. Forecast Section (Pro-gated) */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>{t('analytics.forecast')}</Text>
            {!isPro && <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>}
          </View>
          {isPro ? (
            <View style={styles.forecastRow}>
              <ForecastCard
                label={t('analytics.forecast_30d')}
                value={forecast?.day30 ?? Number(totalMonthly).toFixed(0)}
              />
              <ForecastCard
                label={t('analytics.forecast_6m')}
                value={forecast?.month6 ?? Number(totalMonthly * 6).toFixed(0)}
              />
              <ForecastCard
                label={t('analytics.forecast_12m')}
                value={forecast?.month12 ?? Number(totalYearly).toFixed(0)}
              />
            </View>
          ) : (
            <View style={styles.lockedContainer}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockedText}>{t('analytics.upgrade_forecast')}</Text>
            </View>
          )}
        </View>

        {/* 5. Savings Analysis (Pro-gated) */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>{t('analytics.savings')}</Text>
            {!isPro && <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>}
          </View>
          {isPro ? (
            <>
              <View style={styles.savingsHighlight}>
                <Text style={styles.savingsAmount}>
                  ${Number(savings?.potentialMonthlySavings ?? 0).toFixed(2)}
                </Text>
                <Text style={styles.savingsLabel}>{t('analytics.potential_savings')}</Text>
              </View>
              {(savings?.duplicates && savings.duplicates.length > 0) ? (
                <View style={styles.duplicatesSection}>
                  <Text style={styles.duplicatesTitle}>{t('analytics.duplicates')}</Text>
                  {savings.duplicates.map((dup: any, i: number) => (
                    <View key={i} style={styles.duplicateRow}>
                      <Text style={styles.duplicateIcon}>⚠️</Text>
                      <Text style={styles.duplicateText} numberOfLines={2}>
                        {dup.name || dup.names?.join(' & ') || `Duplicate ${i + 1}`}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDuplicates}>{t('analytics.no_duplicates')}</Text>
              )}
            </>
          ) : (
            <View style={styles.lockedContainer}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockedText}>{t('analytics.upgrade_savings')}</Text>
            </View>
          )}
        </View>

        {/* 6. Top 5 Most Expensive */}
        {top5.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('analytics.top5')}</Text>
            {top5.map((sub, index) => {
              const catInfo = CATEGORIES.find((c) => c.id.toUpperCase() === sub.category?.toUpperCase());
              const monthly = getMonthlyAmount(sub);
              return (
                <View key={sub.id} style={styles.top5Row}>
                  <Text style={styles.top5Rank}>{index + 1}</Text>
                  <View style={[styles.top5Icon, { backgroundColor: catInfo?.color || COLORS.primary }]}>
                    <Text style={styles.top5Emoji}>{catInfo?.emoji || '📦'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.top5Name} numberOfLines={1}>{sub.name}</Text>
                    <Text style={styles.top5Period}>
                      {sub.currency} {Number(sub.amount).toFixed(2)}/{PERIOD_SHORT[sub.billingPeriod] || 'mo'}
                    </Text>
                  </View>
                  <Text style={styles.top5Monthly}>${Number(monthly).toFixed(0)}/mo</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* All Subscriptions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('analytics.all_subscriptions')}</Text>
          {activeSubs.map((sub) => (
            <View key={sub.id} style={styles.subRow}>
              <View style={[styles.subIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Text style={styles.subIconText}>{sub.name[0]}</Text>
              </View>
              <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
              <Text style={styles.subAmount}>
                {sub.currency} {Number(sub.amount).toFixed(2)}/{PERIOD_SHORT[sub.billingPeriod] || 'mo'}
              </Text>
            </View>
          ))}
          {activeSubs.length === 0 && (
            <Text style={styles.empty}>{t('analytics.no_data')}</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
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

function ForecastCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={forecastStyles.card}>
      <Text style={forecastStyles.value}>${value}</Text>
      <Text style={forecastStyles.label}>{label}</Text>
    </View>
  );
}

const forecastStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(108, 71, 255, 0.15)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
  },
  value: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
  label: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
});

const statStyles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    padding: 16,
    minWidth: 130,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.2)',
    gap: 4,
  },
  label: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  value: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  sub: { fontSize: 11, color: '#6B7280' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#9CA3AF' },
  statsRow: { paddingHorizontal: 20, paddingVertical: 12 },
  card: {
    backgroundColor: CARD_BG,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  proBadgeText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },

  // Pie / Donut
  pieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  pieCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  pieCenterAmount: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  pieCenterSub: { fontSize: 11, color: '#9CA3AF' },

  // Legend
  legendContainer: { gap: 8, marginTop: 4 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendEmoji: { fontSize: 16, width: 22 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#E5E7EB' },
  legendAmount: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Card Breakdown
  cardBreakdownRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardBreakdownIcon: { fontSize: 20, width: 28 },
  cardBreakdownLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardBreakdownLabel: { fontSize: 14, fontWeight: '700', color: '#E5E7EB', flex: 1 },
  cardBreakdownAmount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  barBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  // Forecast
  forecastRow: { flexDirection: 'row', gap: 10 },

  // Locked / Pro gate
  lockedContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  lockIcon: { fontSize: 32 },
  lockedText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },

  // Savings
  savingsHighlight: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  savingsAmount: { fontSize: 28, fontWeight: '900', color: '#4CAF50' },
  savingsLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  duplicatesSection: { gap: 8 },
  duplicatesTitle: { fontSize: 14, fontWeight: '700', color: '#E5E7EB' },
  duplicateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  duplicateIcon: { fontSize: 16 },
  duplicateText: { flex: 1, fontSize: 13, color: '#9CA3AF' },
  noDuplicates: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingVertical: 8 },

  // Top 5
  top5Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  top5Rank: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    width: 20,
    textAlign: 'center',
  },
  top5Icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top5Emoji: { fontSize: 18 },
  top5Name: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  top5Period: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  top5Monthly: { fontSize: 14, fontWeight: '800', color: COLORS.primary },

  // All subs
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
  subName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#E5E7EB' },
  subAmount: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  empty: { color: '#6B7280', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
