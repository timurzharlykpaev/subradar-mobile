import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path as SvgPath, Rect, Text as SvgText, Line } from 'react-native-svg';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { analyticsApi } from '../../src/api/analytics';
import { useBillingStatus } from '../../src/hooks/useBilling';
import { CATEGORIES } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { CategoryIcon } from '../../src/components/icons';
import ProFeatureModal from '../../src/components/ProFeatureModal';

const CHART_HEIGHT = 180;

// ─── Custom MonthlyBarChart ──────────────────────────────────────────────────
function MonthlyBarChart({ data }: { data: { month: string; total: number }[] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const yAxisW = 40;
  const chartW = screenWidth - 80;
  const barsW = chartW - yAxisW;
  const barW = Math.max(10, barsW / data.length - 4);
  const labelHeight = 18;
  const chartAreaH = CHART_HEIGHT - 30;
  const totalH = CHART_HEIGHT + labelHeight;

  // Y-axis grid: 4 steps
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    y: chartAreaH - frac * chartAreaH,
    label: `$${Math.round(maxVal * frac)}`,
  }));

  const getMonthLabel = (monthStr: string) => {
    const parts = String(monthStr || '').split('-');
    const monthNum = parts.length >= 2 ? parseInt(parts[1], 10) : parseInt(parts[0], 10);
    if (monthNum >= 1 && monthNum <= 12) return t(`months.${monthNum}`, { defaultValue: monthStr });
    return monthStr.slice(-2);
  };

  return (
    <View style={{ height: totalH }}>
      <Svg width={chartW} height={totalH}>
        {/* Grid lines */}
        {gridLines.map((line, i) => (
          <React.Fragment key={`grid-${i}`}>
            <Line
              x1={yAxisW} y1={line.y} x2={chartW} y2={line.y}
              stroke={colors.border}
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
            <SvgText x={yAxisW - 4} y={line.y + 3} fontSize={9} fill={colors.textMuted} textAnchor="end">
              {line.label}
            </SvgText>
          </React.Fragment>
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const barH = Math.max(4, (d.total / maxVal) * chartAreaH);
          const x = yAxisW + i * (barsW / data.length) + (barsW / data.length - barW) / 2;
          const y = chartAreaH - barH;
          const isMax = d.total === maxVal;
          const labelX = x + barW / 2;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={barH} rx={5} fill={isMax ? colors.primary : `${colors.primary}88`} />
              {d.total > 0 && (
                <SvgText
                  x={labelX} y={y - 4}
                  fontSize={9} fontWeight="700"
                  fill={isMax ? colors.primary : colors.textMuted}
                  textAnchor="middle"
                >
                  ${d.total >= 1000 ? `${(d.total / 1000).toFixed(1)}k` : d.total.toFixed(0)}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      {/* X labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: -labelHeight + 4, paddingLeft: yAxisW }}>
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i) => (
          <Text key={i} style={{ fontSize: 10, color: colors.textMuted }}>{getMonthLabel(d.month)}</Text>
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
  const { colors } = useTheme();
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
      // Cap at 99.9% to avoid SVG arc rendering bug when start ≈ end
      const sweep = Math.min(fraction, 0.999) * 2 * Math.PI;
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
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>${Number(total).toFixed(0)}</Text>
        <Text style={{ fontSize: 11, color: colors.textMuted }}>{avgLabel}</Text>
      </View>
    </View>
  );
}

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
  const { colors, isDark } = useTheme();

  const [summary, setSummary] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<{ month: string; total: number }[]>([]);
  const [byCategoryData, setByCategoryData] = useState<any[]>([]);
  const [byCardData, setByCardData] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [proModal, setProModal] = useState<{ visible: boolean; feature: string }>({ visible: false, feature: 'forecast' });

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
          categoryId: cat?.id || 'OTHER',
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
    <SafeAreaView testID="analytics-screen" edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView testID="analytics-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={[styles.headerIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="analytics" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{t('analytics.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('analytics.subtitle')}</Text>
            </View>
          </View>
        </View>

        {/* ── Summary Strip ─────────────────────────────────────── */}
        <ScrollView testID="analytics-stats-row" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatCard
            icon="wallet-outline"
            label={t('analytics.avg_month')}
            value={`$${Number(totalMonthly).toFixed(0)}`}
            color={colors.primary}
          />
          <StatCard
            icon="calendar-outline"
            label={t('analytics.total_year')}
            value={`$${Number(totalYearly).toFixed(0)}`}
            color={colors.success}
          />
          {mostExpensive && (
            <StatCard
              icon="flame-outline"
              label={t('analytics.most_expensive')}
              value={mostExpensive.name}
              sub={`$${Number(mostExpensive.amount).toFixed(0)}/mo`}
              color={colors.warning}
            />
          )}
        </ScrollView>

        {/* ── 1. Monthly Bar Chart ───────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="bar-chart-outline" size={14} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analytics.monthly_spend')}</Text>
          </View>
          <View testID="analytics-monthly-chart" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {monthlyData.length > 0 ? (
              <MonthlyBarChart data={monthlyData} />
            ) : (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('analytics.no_data')}</Text>
            )}
          </View>
        </View>

        {/* ── 2. Category Donut Chart ────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.warning + '18' }]}>
              <Ionicons name="pie-chart-outline" size={14} color={colors.warning} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analytics.by_category')}</Text>
            {byCategory.length > 0 && (
              <View style={[styles.sectionBadge, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.sectionBadgeText, { color: colors.primary }]}>{byCategory.length}</Text>
              </View>
            )}
          </View>
          <View testID="analytics-category-chart" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {byCategory.length > 0 ? (
              <>
                <CategoryDonutChart categories={byCategory} total={categoryTotal} avgLabel={t('analytics.avg_month')} />
                <View style={styles.legendContainer}>
                  {byCategory.map((cat) => (
                    <View key={cat.id} style={[styles.legendRow, { borderColor: colors.border }]}>
                      <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                      <CategoryIcon category={cat.id || cat.categoryId} size={14} />
                      <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={1}>{cat.label}</Text>
                      <Text style={[styles.legendPercent, { color: colors.textMuted }]}>{categoryTotal > 0 ? Math.round((cat.total / categoryTotal) * 100) : 0}%</Text>
                      <Text style={[styles.legendAmount, { color: colors.primary }]}>${Number(cat.total).toFixed(0)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('analytics.no_data')}</Text>
            )}
          </View>
        </View>

        {/* ── 3. Card Breakdown ──────────────────────────────────── */}
        {cardBreakdown.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: colors.secondary + '18' }]}>
                <Ionicons name="card-outline" size={14} color={colors.secondary} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analytics.card_breakdown')}</Text>
            </View>
            <View testID="analytics-card-breakdown" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {cardBreakdown.map((card: any, i: number) => {
                const amount = card.total ?? card.amount ?? 0;
                return (
                  <View key={card.label || i} style={styles.cardBreakdownRow}>
                    <View style={[styles.cardBreakdownIconCircle, { backgroundColor: colors.primary + '18' }]}>
                      <Ionicons name="card" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.cardBreakdownLabelRow}>
                        <Text style={[styles.cardBreakdownLabel, { color: colors.text }]} numberOfLines={1}>{card.label || card.nickname || t('analytics.card_label', { number: i + 1 })}</Text>
                        <Text style={[styles.cardBreakdownAmount, { color: colors.primary }]}>${Number(amount).toFixed(2)}</Text>
                      </View>
                      <View style={[styles.barBg, { backgroundColor: colors.border }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${(amount / cardMax) * 100}%`,
                              backgroundColor: colors.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── 4. Forecast Section (Pro-gated) ────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="trending-up-outline" size={14} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analytics.forecast')}</Text>
            {!isPro && (
              <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
          {isPro ? (
            <View testID="analytics-forecast-row" style={styles.forecastRow}>
              <ForecastCard
                icon="calendar"
                label={t('analytics.forecast_30d')}
                value={forecast?.day30 ?? Number(totalMonthly).toFixed(0)}
                color={colors.primary}
              />
              <ForecastCard
                icon="trending-up"
                label={t('analytics.forecast_6m')}
                value={forecast?.month6 ?? Number(totalMonthly * 6).toFixed(0)}
                color={colors.success}
              />
              <ForecastCard
                icon="analytics"
                label={t('analytics.forecast_12m')}
                value={forecast?.month12 ?? Number(totalYearly).toFixed(0)}
                color={colors.warning}
              />
            </View>
          ) : (
            <TouchableOpacity
              testID="btn-unlock-forecast"
              style={[styles.lockedContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setProModal({ visible: true, feature: 'forecast' })}
              activeOpacity={0.7}
            >
              <View style={[styles.lockIconCircle, { backgroundColor: isDark ? 'rgba(124,92,255,0.12)' : 'rgba(108,71,255,0.08)' }]}>
                <Ionicons name="trending-up" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.lockedTitle, { color: colors.text }]}>{t('analytics.forecast')}</Text>
              <Text style={[styles.lockedText, { color: colors.textMuted }]}>{t('analytics.upgrade_forecast')}</Text>
              <View style={[styles.lockedCta, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.lockedCtaText, { color: colors.primary }]}>{t('pro_modal.unlock', 'Unlock')}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 5. Savings Analysis (Pro-gated) ────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.success + '18' }]}>
              <Ionicons name="cash-outline" size={14} color={colors.success} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analytics.savings')}</Text>
            {!isPro && (
              <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
          {isPro ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.savingsHighlight, { backgroundColor: isDark ? 'rgba(52,211,153,0.10)' : 'rgba(5,150,105,0.06)', borderColor: isDark ? 'rgba(52,211,153,0.25)' : 'rgba(5,150,105,0.15)' }]}>
                <View style={[styles.savingsIconCircle, { backgroundColor: colors.success + '18' }]}>
                  <Ionicons name="leaf" size={20} color={colors.success} />
                </View>
                <Text style={[styles.savingsAmount, { color: colors.success }]}>
                  ${Number(summary?.savingsPossible ?? 0).toFixed(2)}
                </Text>
                <Text style={[styles.savingsLabel, { color: colors.textMuted }]}>{t('analytics.potential_savings')}</Text>
              </View>
              <Text style={[styles.noDuplicates, { color: colors.textSecondary }]}>{t('analytics.no_duplicates')}</Text>
            </View>
          ) : (
            <TouchableOpacity
              testID="btn-unlock-savings"
              style={[styles.lockedContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setProModal({ visible: true, feature: 'savings' })}
              activeOpacity={0.7}
            >
              <View style={[styles.lockIconCircle, { backgroundColor: isDark ? 'rgba(52,211,153,0.12)' : 'rgba(5,150,105,0.08)' }]}>
                <Ionicons name="cash-outline" size={24} color={colors.success} />
              </View>
              <Text style={[styles.lockedTitle, { color: colors.text }]}>{t('analytics.savings')}</Text>
              <Text style={[styles.lockedText, { color: colors.textMuted }]}>{t('analytics.upgrade_savings')}</Text>
              <View style={[styles.lockedCta, { backgroundColor: colors.success + '15' }]}>
                <Text style={[styles.lockedCtaText, { color: colors.success }]}>{t('pro_modal.unlock', 'Unlock')}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.success} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        <ProFeatureModal
          visible={proModal.visible}
          onClose={() => setProModal({ ...proModal, visible: false })}
          feature={proModal.feature}
        />

        {/* ── 6. Top 5 Most Expensive ────────────────────────────── */}
        {top5.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: colors.error + '18' }]}>
                <Ionicons name="trophy-outline" size={14} color={colors.error} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analytics.top5')}</Text>
              <View style={[styles.sectionBadge, { backgroundColor: colors.error + '18' }]}>
                <Text style={[styles.sectionBadgeText, { color: colors.error }]}>{top5.length}</Text>
              </View>
            </View>
            <View testID="analytics-top5" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {top5.map((sub, index) => {
                const catInfo = CATEGORIES.find((c) => c.id.toUpperCase() === sub.category?.toUpperCase());
                const monthly = getMonthlyAmount(sub);
                return (
                  <View key={sub.id} style={[styles.top5Row, index < top5.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined]}>
                    <View style={[styles.top5RankBadge, { backgroundColor: index === 0 ? colors.warning + '20' : index === 1 ? colors.textMuted + '20' : colors.secondary + '15' }]}>
                      <Text style={[styles.top5Rank, { color: index === 0 ? colors.warning : index === 1 ? colors.textMuted : colors.textSecondary }]}>{index + 1}</Text>
                    </View>
                    <View style={[styles.top5Icon, { backgroundColor: (catInfo?.color || colors.primary) + '18' }]}>
                      <CategoryIcon category={catInfo?.id || 'OTHER'} size={16} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.top5Name, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                      <Text style={[styles.top5Period, { color: colors.textSecondary }]} numberOfLines={1}>
                        {sub.currency} {Number(sub.amount).toFixed(2)}/{PERIOD_SHORT[sub.billingPeriod] || 'mo'}
                      </Text>
                    </View>
                    <Text style={[styles.top5Monthly, { color: colors.primary }]}>${Number(monthly).toFixed(0)}/mo</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── 7. All Subscriptions ───────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="list-outline" size={14} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('analytics.all_subscriptions')}</Text>
            {activeSubs.length > 0 && (
              <View style={[styles.sectionBadge, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.sectionBadgeText, { color: colors.primary }]}>{activeSubs.length}</Text>
              </View>
            )}
          </View>
          <View testID="analytics-all-subs" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {activeSubs.map((sub, index) => (
              <View key={sub.id} style={[styles.subRow, index < activeSubs.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined]}>
                {sub.iconUrl ? (
                  <Image source={{ uri: sub.iconUrl }} style={styles.subIconImage} />
                ) : (
                  <View style={[styles.subIcon, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.subIconText, { color: colors.primary }]}>{sub.name[0]}</Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.subName, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                  <Text style={[styles.subCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                    <CategoryIcon category={CATEGORIES.find((c) => c.id.toUpperCase() === sub.category?.toUpperCase())?.id || 'OTHER'} size={14} />{' '}
                    {CATEGORIES.find((c) => c.id.toUpperCase() === sub.category?.toUpperCase())?.label || sub.category}
                  </Text>
                </View>
                <Text style={[styles.subAmount, { color: colors.text }]} numberOfLines={1}>
                  {sub.currency} {Number(sub.amount).toFixed(2)}/{PERIOD_SHORT[sub.billingPeriod] || 'mo'}
                </Text>
              </View>
            ))}
            {activeSubs.length === 0 && (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('analytics.no_data')}</Text>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── StatCard ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; sub?: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[statStyles.iconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[statStyles.label, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[statStyles.value, { color }]} numberOfLines={1}>{value}</Text>
      {sub && <Text style={[statStyles.sub, { color: colors.textSecondary }]} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

// ── ForecastCard ────────────────────────────────────────────────────────────
function ForecastCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[forecastStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[forecastStyles.iconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[forecastStyles.value, { color }]}>${value}</Text>
      <Text style={[forecastStyles.label, { color: colors.textSecondary }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

// ── StyleSheets ─────────────────────────────────────────────────────────────

const forecastStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: 18, fontWeight: '900' },
  label: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});

const statStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    minWidth: 140,
    marginRight: 10,
    borderWidth: 1,
    gap: 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  label: { fontSize: 12, fontWeight: '600' },
  value: { fontSize: 22, fontWeight: '900' },
  sub: { fontSize: 11 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },

  // Stats row
  statsRow: { paddingHorizontal: 20, paddingVertical: 14 },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', flex: 1 },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sectionBadgeText: { fontSize: 12, fontWeight: '800' },

  // Card
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },

  // Pro badge
  proBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  proBadgeText: { fontSize: 11, fontWeight: '900', color: '#fff' },

  // Legend
  legendContainer: { gap: 6, marginTop: 4 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendEmoji: { fontSize: 16, width: 22, textAlign: 'center' },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  legendPercent: { fontSize: 12, width: 36, textAlign: 'right', fontWeight: '600' },
  legendAmount: { fontSize: 13, fontWeight: '700', width: 56, textAlign: 'right' },

  // Card Breakdown
  cardBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  cardBreakdownIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBreakdownLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardBreakdownLabel: { fontSize: 14, fontWeight: '700', flex: 1 },
  cardBreakdownAmount: { fontSize: 14, fontWeight: '800' },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  // Forecast
  forecastRow: { flexDirection: 'row', gap: 10 },

  // Locked / Pro gate
  lockedContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  lockIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  lockedTitle: { fontSize: 17, fontWeight: '800' },
  lockedText: { fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },
  lockedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  lockedCtaText: { fontSize: 14, fontWeight: '700' },

  // Savings
  savingsHighlight: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  savingsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  savingsAmount: { fontSize: 32, fontWeight: '900' },
  savingsLabel: { fontSize: 12, fontWeight: '600' },
  duplicatesSection: { gap: 8 },
  duplicatesTitle: { fontSize: 14, fontWeight: '700' },
  duplicateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
  },
  duplicateIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  duplicateText: { flex: 1, fontSize: 13 },
  noDuplicates: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },

  // Top 5
  top5Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  top5RankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top5Rank: {
    fontSize: 14,
    fontWeight: '900',
  },
  top5Icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top5Emoji: { fontSize: 18 },
  top5Name: { fontSize: 14, fontWeight: '700' },
  top5Period: { fontSize: 11, marginTop: 2 },
  top5Monthly: { fontSize: 14, fontWeight: '800', flexShrink: 0 },

  // All subs
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  subIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subIconImage: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  subIconText: { fontSize: 16, fontWeight: '800' },
  subName: { fontSize: 14, fontWeight: '700' },
  subCategory: { fontSize: 11, marginTop: 2 },
  subAmount: { fontSize: 13, fontWeight: '700', flexShrink: 0 },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});
