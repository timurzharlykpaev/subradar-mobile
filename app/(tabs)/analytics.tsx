import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path as SvgPath, Rect } from 'react-native-svg';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { analyticsApi } from '../../src/api/analytics';
import { useBillingStatus } from '../../src/hooks/useBilling';
import { COLORS, CATEGORIES } from '../../src/constants';

const CHART_HEIGHT = 180;

// ─── Custom MonthlyBarChart ──────────────────────────────────────────────────
function MonthlyBarChart({ data }: { data: { month: string; total: number }[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const barW = Math.max(12, (screenWidth - 120) / data.length - 6);
  const chartW = screenWidth - 80;

  return (
    <View style={{ height: CHART_HEIGHT }}>
      <Svg width={chartW} height={CHART_HEIGHT}>
        {data.map((d, i) => {
          const barH = Math.max(4, (d.total / maxVal) * (CHART_HEIGHT - 30));
          const x = i * ((chartW) / data.length) + ((chartW / data.length) - barW) / 2;
          const y = CHART_HEIGHT - 30 - barH;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={barH} rx={4} fill="#8B5CF6" opacity={0.85} />
            </React.Fragment>
          );
        })}
      </Svg>
      {/* X labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 2 }}>
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i) => (
          <Text key={i} style={{ fontSize: 10, color: COLORS.textMuted }}>{String(d.month || '').slice(-2)}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Custom CategoryDonutChart ───────────────────────────────────────────────
function CategoryDonutChart({ categories, total, avgLabel }: {
  categories: { id: string; color: string; total: number }[];
  total: number;
  avgLabel: string;
}) {
  const size = 160;
  const radius = 60;
  const innerRadius = 40;
  const cx = size / 2;
  const cy = size / 2;

  if (!total || !isFinite(total)) return null;

  let startAngle = -Math.PI / 2;
  const slices = categories
    .filter((c) => isFinite(c.total) && c.total > 0)
    .map((cat) => {
      const fraction = cat.total / total;
      const sweep = fraction * 2 * Math.PI;
      if (!isFinite(sweep) || sweep <= 0) return null;

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
      return { d, color: cat.color };
    }).filter(Boolean) as { d: string; color: string }[];

  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginVertical: 8 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, idx) => (
          <SvgPath key={idx} d={slice.d} fill={slice.color} />
        ))}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.text }}>${Number(total).toFixed(0)}</Text>
        <Text style={{ fontSize: 11, color: COLORS.textMuted }}>{avgLabel}</Text>
      </View>
    </View>
  );
}

const CARD_BG = COLORS.card;
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
        const cat = CATEGORIES.find((c) => c.id.toUpperCase() === (d.category || '').toUpperCase());
        return {
          id: d.category || '',
          label: cat?.label || d.category || '',
          emoji: cat?.emoji || '📦',
          color: cat?.color || '#757575',
          total: isFinite(Number(d.total ?? d.amount)) ? Number(d.total ?? d.amount) : 0,
          count: d.count ?? 0,
        };
      }).filter((c) => c.total > 0)
    : CATEGORIES.map((cat) => {
        const catSubs = activeSubs.filter((s) => s.category?.toUpperCase() === cat.id.toUpperCase());
        return { ...cat, total: catSubs.reduce((sum, s) => sum + s.amount, 0), count: catSubs.length };
      }).filter((c) => c.count > 0);

  const categoryTotal = byCategory.reduce((sum, c) => sum + c.total, 0);

  // Pie chart data (unused - kept for reference)
  // const pieData = byCategory.map(cat => ({ value: cat.total, color: cat.color, label: cat.label }));

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
          const cardLabel = s.paymentCardId
            ? `Card ****${s.paymentCardId.slice(-4)}`
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

        {/* 1. Monthly Bar Chart (custom SVG) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('analytics.monthly_spend')}</Text>
          {monthlyData.length > 0 ? (
            <MonthlyBarChart data={monthlyData} />
          ) : (
            <Text style={styles.empty}>{t('analytics.no_data')}</Text>
          )}
        </View>

        {/* 2. Category Donut Chart (custom SVG) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('analytics.by_category')}</Text>
          {byCategory.length > 0 ? (
            <>
              <CategoryDonutChart categories={byCategory} total={categoryTotal} avgLabel={t('analytics.avg_month')} />
              <View style={styles.legendContainer}>
                {byCategory.map((cat) => (
                  <View key={cat.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.legendLabel} numberOfLines={1}>{cat.emoji} {cat.label}</Text>
                    <Text style={styles.legendPercent}>{categoryTotal > 0 ? Math.round((cat.total / categoryTotal) * 100) : 0}%</Text>
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
                      <Text style={styles.cardBreakdownLabel} numberOfLines={1}>{card.label || card.nickname || t('analytics.card_label', { number: i + 1 })}</Text>
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
                        {dup.name || dup.names?.join(' & ') || t('analytics.duplicate_label', { number: i + 1 })}
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
  label: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  value: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  sub: { fontSize: 11, color: COLORS.textSecondary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textMuted },
  statsRow: { paddingHorizontal: 20, paddingVertical: 12 },
  card: {
    backgroundColor: CARD_BG,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
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
  proBadgeText: { fontSize: 11, fontWeight: '900', color: COLORS.text },

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
  pieCenterAmount: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  pieCenterSub: { fontSize: 11, color: COLORS.textMuted },

  // Legend
  legendContainer: { gap: 8, marginTop: 4 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  legendPercent: { fontSize: 12, color: COLORS.textMuted, width: 36, textAlign: 'right' },
  legendAmount: { fontSize: 13, fontWeight: '700', color: COLORS.primary, width: 52, textAlign: 'right' },

  // Card Breakdown
  cardBreakdownRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardBreakdownIcon: { fontSize: 20, width: 28 },
  cardBreakdownLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardBreakdownLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
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
  lockedText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },

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
  savingsLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  duplicatesSection: { gap: 8 },
  duplicatesTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  duplicateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  duplicateIcon: { fontSize: 16 },
  duplicateText: { flex: 1, fontSize: 13, color: COLORS.textMuted },
  noDuplicates: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 8 },

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
  top5Name: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  top5Period: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
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
  subName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  subAmount: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  empty: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
