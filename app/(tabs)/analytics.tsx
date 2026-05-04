import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SubIcon } from '../../src/components/SubIcon';
import Svg, { Path as SvgPath, Rect, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { analyticsApi } from '../../src/api/analytics';
import { formatMoney } from '../../src/utils/formatMoney';
import i18n from '../../src/i18n';
import { CATEGORIES } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { CategoryIcon } from '../../src/components/icons';
import ProFeatureModal from '../../src/components/ProFeatureModal';
import { usePaymentCardsStore } from '../../src/stores/paymentCardsStore';
import { useAnalysisFlow } from '../../src/hooks/useAnalysis';
import AITeaser from '../../src/components/AITeaser';
import AIAnalysisSummary from '../../src/components/AIAnalysisSummary';
import AIRecommendationList from '../../src/components/AIRecommendationList';
import { analytics } from '../../src/services/analytics';
import AIDuplicateGroup from '../../src/components/AIDuplicateGroup';
import AnalysisLoadingState from '../../src/components/AnalysisLoadingState';
import { AnalyticsSkeleton } from '../../src/components/skeletons';
import BlurredProSection from '../../src/components/BlurredProSection';
import { useEffectiveAccess } from '../../src/hooks/useEffectiveAccess';

const CHART_HEIGHT = 200;

/** Format number with space separator: 1500 → "1 500" */
function formatNum(n: number | string | undefined | null, decimals = 0): string {
  const num = Number(n);
  if (!isFinite(num)) return '0';
  const fixed = num.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart ? `${formatted}.${decPart}` : formatted;
}

// ─── Custom MonthlyBarChart ──────────────────────────────────────────────────
function MonthlyBarChart({ data, currencySymbol = '$' }: { data: { month: string; total: number }[]; currencySymbol?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const yAxisW = 40;
  const chartW = screenWidth - 80;
  const barsW = chartW - yAxisW;
  const barW = Math.max(16, barsW / data.length - 6);
  const chartAreaH = CHART_HEIGHT - 30;
  const totalH = CHART_HEIGHT + 20;

  const gridLines = [0.25, 0.5, 0.75].map((frac) => ({
    y: chartAreaH - frac * chartAreaH,
    label: `${currencySymbol} ${formatNum(Math.round(maxVal * frac))}`,
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
        <Defs>
          <LinearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.35" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="barGradDim" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.15" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0.7" />
          </LinearGradient>
        </Defs>
        {gridLines.map((line, i) => (
          <React.Fragment key={`grid-${i}`}>
            <Line x1={yAxisW} y1={line.y} x2={chartW} y2={line.y} stroke={colors.text} strokeWidth={0.5} strokeOpacity={0.08} />
            <SvgText x={yAxisW - 4} y={line.y + 3} fontSize={9} fill={colors.textMuted} textAnchor="end">{line.label}</SvgText>
          </React.Fragment>
        ))}
        {data.map((d, i) => {
          const ratio = d.total / maxVal;
          const barH = d.total > 0 ? Math.max(6, ratio * chartAreaH) : 2;
          const x = yAxisW + i * (barsW / data.length) + (barsW / data.length - barW) / 2;
          const y = chartAreaH - barH;
          const isMax = d.total === maxVal && d.total > 0;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={barH} rx={barW / 4} fill={isMax ? 'url(#barGrad)' : 'url(#barGradDim)'} />
              {d.total > 0 && (
                <SvgText x={x + barW / 2} y={y - 5} fontSize={10} fontWeight={isMax ? '700' : '500'} fill={isMax ? colors.primary : colors.textMuted} textAnchor="middle" opacity={isMax ? 1 : 0.7}>
                  {d.total >= 1000 ? `${currencySymbol} ${(d.total / 1000).toFixed(1)}k` : `${currencySymbol} ${d.total.toFixed(0)}`}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingLeft: yAxisW, marginTop: -14 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ fontSize: 9, color: colors.textMuted, textAlign: 'center', flex: 1 }}>{getMonthLabel(d.month)}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Custom CategoryDonutChart ───────────────────────────────────────────────
function CategoryDonutChart({ categories, total, currencySymbol = '$' }: {
  categories: { id: string; color: string; total: number; label?: string; categoryId?: string }[];
  total: number;
  currencySymbol?: string;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const size = 280;
  const radius = 125;
  const innerRadius = 65;
  const cx = size / 2;
  const cy = size / 2;
  const midRadius = (radius + innerRadius) / 2;

  if (!total || !isFinite(total)) return null;

  let startAngle = -Math.PI / 2;
  const slices = categories
    .filter((c) => isFinite(c.total) && c.total > 0)
    .map((cat) => {
      const fraction = cat.total / total;
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

      const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

      const midAngle = startAngle + sweep / 2;
      const pct = Math.round(fraction * 100);
      const labelX = cx + midRadius * Math.cos(midAngle);
      const labelY = cy + midRadius * Math.sin(midAngle);

      startAngle += sweep;
      // Only show label inside segment if >= 15% (enough space to not overlap)
      return { d, color: cat.color, pct, labelX, labelY, showLabel: pct >= 8 };
    }).filter(Boolean) as { d: string; color: string; pct: number; labelX: number; labelY: number; showLabel: boolean }[];

  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginVertical: 8 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, idx) => (
          <SvgPath key={idx} d={slice.d} fill={slice.color} />
        ))}
        {slices.filter((s) => s.showLabel).map((slice, idx) => (
          <SvgText
            key={`lbl-${idx}`}
            x={slice.labelX}
            y={slice.labelY + 5}
            fontSize={12}
            fontWeight="900"
            fill="#FFF"
            textAnchor="middle"
          >
            {slice.pct}%
          </SvgText>
        ))}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        {/*
          Inner hole = 2 * innerRadius (130px). Reserve padding so text never
          touches the donut edge. `adjustsFontSizeToFit` + `numberOfLines={1}`
          shrinks long currency totals (e.g. "₸ 1,234,567") to fit instead of
          clipping or wrapping.
        */}
        <Text
          style={{ fontSize: 22, fontWeight: '900', color: colors.text, maxWidth: innerRadius * 2 - 16, textAlign: 'center' }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {currencySymbol} {formatNum(total)}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textMuted }}>{t('analytics.total')}</Text>
      </View>
    </View>
  );
}

// Period short labels are now in i18n: t('period_short.MONTHLY') etc.

// ─── AI Analysis Section ────────────────────────────────────────────────────
function AIAnalysisSection({ isPro }: { isPro: boolean }) {
  const { result, job, isPlanRequired, canRunManual, isRunning, autoTrigger, manualRun } = useAnalysisFlow();

  React.useEffect(() => {
    if (isPro) autoTrigger();
  }, [isPro]);

  if (!isPro || isPlanRequired) {
    return <AITeaser />;
  }

  if (isRunning && job) {
    return <AnalysisLoadingState status={job as any} />;
  }

  if (result) {
    return (
      <>
        <AIAnalysisSummary
          summary={result.summary}
          totalMonthlySavings={result.totalMonthlySavings}
          currency={result.currency}
          createdAt={result.createdAt}
          canRunManual={canRunManual}
          isRunning={isRunning}
          onRefresh={manualRun}
        />
        <AIRecommendationList recommendations={result.recommendations} currency={result.currency} />
        <AIDuplicateGroup groups={result.duplicates} currency={result.currency} />
      </>
    );
  }

  return <AITeaser />;
}

export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { subscriptions } = useSubscriptionsStore();
  const access = useEffectiveAccess();
  // `cancel_at_period_end` still has Pro access until period ends, so
  // `access.isPro` matches that semantics — no need for manual isCancelled gating.
  const isPro = access?.isPro ?? false;
  const { colors, isDark } = useTheme();
  const displayCurrency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');
  const lang = i18n.language || 'en';
  const money = useCallback(
    (amount: number | string) => formatMoney(amount, displayCurrency, lang),
    [displayCurrency, lang],
  );
  const currencySymbol = useMemo(() => {
    try {
      const parts = new Intl.NumberFormat(lang, { style: 'currency', currency: displayCurrency }).formatToParts(0);
      return parts.find((p) => p.type === 'currency')?.value ?? displayCurrency;
    } catch {
      return displayCurrency;
    }
  }, [displayCurrency, lang]);

  const [summary, setSummary] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<{ month: string; total: number }[]>([]);
  const [byCategoryData, setByCategoryData] = useState<any[]>([]);
  const [byCardData, setByCardData] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [savings, setSavings] = useState<any>(null);
  const [proModal, setProModal] = useState<{ visible: boolean; feature: string }>({ visible: false, feature: 'forecast' });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => { analytics.track('analytics_viewed'); }, []);

  const fetchAll = useCallback(async () => {
    let errors = 0;
    const promises = [
      analyticsApi.getSummary({ displayCurrency }).then((r) => setSummary(r.data)).catch(() => { errors++; }),
      analyticsApi.getMonthly(undefined, { displayCurrency }).then((r) => {
        const raw = r.data || [];
        const data = raw.map((d: any) => ({
          month: (d.label || d.month || '').slice(-5) || '',
          total: d.total ?? d.amount ?? 0,
        }));
        setMonthlyData(data.slice(-12));
      }).catch(() => { errors++; }),
      analyticsApi.getByCategory({ displayCurrency }).then((r) => {
        setByCategoryData(r.data || []);
      }).catch(() => { errors++; }),
      analyticsApi.getByCard({ displayCurrency }).then((r) => {
        setByCardData(r.data || []);
      }).catch(() => {}),
      analyticsApi.getForecast({ displayCurrency }).then((r) => {
        const d = r.data;
        setForecast({
          day30: d?.forecast30d ?? d?.day30 ?? null,
          month6: d?.forecast6mo ?? d?.month6 ?? null,
          month12: d?.forecast12mo ?? d?.month12 ?? null,
          currency: d?.currency ?? 'USD',
        });
      }).catch(() => {}),
      analyticsApi.getSavings({ displayCurrency }).then((r) => setSavings(r.data)).catch(() => {}),
    ];
    await Promise.all(promises);
    setFetchError(errors >= 3); // Most data failed
  }, [displayCurrency]);

  // Initial load + re-fetch when displayCurrency changes
  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  // Re-fetch when tab gains focus (e.g. after adding a subscription)
  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const activeSubs = useMemo(
    () => subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL'),
    [subscriptions],
  );

  const getMonthlyAmount = useCallback((s: typeof activeSubs[0]) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4.33
      : s.billingPeriod === 'QUARTERLY' ? 1 / 3
      : s.billingPeriod === 'YEARLY' ? 1 / 12
      : s.billingPeriod === 'LIFETIME' ? 0
      : s.billingPeriod === 'ONE_TIME' ? 0
      : 1;
    return (Number(s.displayAmount ?? s.amount) || 0) * mult;
  }, []);

  const totalMonthly = useMemo(
    () => summary?.totalMonthly ?? activeSubs.reduce((sum, s) => sum + getMonthlyAmount(s), 0),
    [summary, activeSubs, getMonthlyAmount],
  );
  const totalYearly = useMemo(() => summary?.totalYearly ?? totalMonthly * 12, [summary, totalMonthly]);

  const fullMonthly = useMemo(() => subscriptions.reduce((sum, s) => {
    if (s.status !== 'ACTIVE' && s.status !== 'TRIAL') return sum;
    const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1/3 : s.billingPeriod === 'YEARLY' ? 1/12 : 1;
    return sum + (Number(s.displayAmount ?? s.amount) || 0) * mult;
  }, 0), [subscriptions]);
  const mostExpensive = useMemo(
    () => activeSubs.reduce<typeof activeSubs[0] | null>(
      (max, s) => (!max || getMonthlyAmount(s) > getMonthlyAmount(max) ? s : max), null,
    ),
    [activeSubs, getMonthlyAmount],
  );

  // Category breakdown — memoized
  const byCategory = useMemo(() => byCategoryData.length > 0
    ? byCategoryData.map((d: any) => {
        const cat = CATEGORIES.find((c) => c.id.toUpperCase() === (d.category || '').toUpperCase());
        return {
          id: d.category || '',
          label: cat?.label || d.category || '',
          categoryId: cat?.id || 'OTHER',
          color: cat?.color || '#A78BFA',
          total: isFinite(Number(d.total ?? d.amount)) ? Number(d.total ?? d.amount) : 0,
          count: d.count ?? 0,
        };
      }).filter((c) => c.total > 0)
    : CATEGORIES.map((cat) => {
        const catSubs = activeSubs.filter((s) => s.category?.toUpperCase() === cat.id.toUpperCase());
        return { ...cat, total: catSubs.reduce((sum, s) => sum + getMonthlyAmount(s), 0), count: catSubs.length };
      }).filter((c) => c.count > 0),
    [byCategoryData, activeSubs],
  );

  const categoryTotal = useMemo(() => byCategory.reduce((sum, c) => sum + c.total, 0), [byCategory]);

  // Top 5 most expensive — memoized
  const top5 = useMemo(
    () => [...activeSubs].sort((a, b) => getMonthlyAmount(b) - getMonthlyAmount(a)).slice(0, 5),
    [activeSubs, getMonthlyAmount],
  );

  // Card breakdown — memoized
  const getCard = usePaymentCardsStore((s) => s.getCard);
  const cardBreakdown = useMemo(() => byCardData.length > 0
    ? byCardData
    : (() => {
        const map = new Map<string, { label: string; total: number }>();
        activeSubs.forEach((s) => {
          let cardLabel = t('common.no_card');
          if (s.paymentCardId) {
            const card = getCard(s.paymentCardId);
            cardLabel = card
              ? (card.nickname || `····${card.last4} ${card.brand}`)
              : `Card ····${s.paymentCardId.slice(-4)}`;
          }
          const key = s.paymentCardId || 'unknown';
          const existing = map.get(key);
          if (existing) {
            existing.total += getMonthlyAmount(s);
          } else {
            map.set(key, { label: cardLabel, total: getMonthlyAmount(s) });
          }
        });
        return Array.from(map.values());
      })(),
    [byCardData, activeSubs, getCard, getMonthlyAmount, t],
  );

  const cardMax = useMemo(() => Math.max(...cardBreakdown.map((c: any) => c.total ?? c.amount ?? 0), 1), [cardBreakdown]);

  const hasNoData = activeSubs.length === 0 && !summary && byCategoryData.length === 0 && monthlyData.length === 0;

  // Loading state — keep the real header visible (faster perceived load),
  // skeletonize only the body blocks (stat tiles → trend chart → category
  // breakdown → most-expensive list).
  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
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
        <AnalyticsSkeleton />
      </SafeAreaView>
    );
  }

  // Error state — most requests failed
  if (fetchError && !summary && monthlyData.length === 0) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 16 }}>
            {t('analytics.error_title', 'Could not load analytics')}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
            {t('analytics.error_subtitle', 'Check your connection and try again')}
          </Text>
          <TouchableOpacity
            onPress={() => { setFetchError(false); setLoading(true); fetchAll().finally(() => setLoading(false)); }}
            style={{ marginTop: 24, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state — no subscriptions at all
  if (hasNoData) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
          <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 }}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="pie-chart-outline" size={48} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 20 }}>
              {t('analytics.empty_title')}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
              {t('analytics.empty_subtitle')}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/subscriptions' as any)}
              style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('analytics.add_first', 'Add subscription →')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="analytics-screen" edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView testID="analytics-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

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
            value={money(totalMonthly)}
            color={colors.primary}
          />
          <StatCard
            icon="calendar-outline"
            label={t('analytics.total_year')}
            value={money(totalYearly)}
            color={colors.success}
          />
          <StatCard
            icon="repeat-outline"
            label={t('analytics.active_count', 'Active')}
            value={`${activeSubs.length}`}
            sub={t('analytics.subscriptions', 'subscriptions')}
            color="#3B82F6"
          />
          {mostExpensive && (
            <StatCard
              icon="flame-outline"
              label={t('analytics.most_expensive')}
              value={mostExpensive.name}
              sub={`${money(getMonthlyAmount(mostExpensive))}/mo`}
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
              <MonthlyBarChart data={monthlyData} currencySymbol={currencySymbol} />
            ) : (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('analytics.no_data')}</Text>
            )}
          </View>
          {access?.flags.degradedMode && (
            <View style={{ alignItems: 'center', marginVertical: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                {t('team_logic.analytics_locked_hint', { amount: money(fullMonthly) })}
              </Text>
            </View>
          )}
        </View>

        {/* ── Team Upsell Card ────────────────────────────────── */}
        {access?.plan === 'pro' && totalMonthly >= 20 && (() => {
          const dupeMonthly = Number(savings?.estimatedMonthlySavings) || 0;
          const dupeCount = Array.isArray(savings?.duplicates) ? savings.duplicates.length : 0;
          const hasDupes = dupeMonthly > 0 || dupeCount > 0;
          return (
            <TouchableOpacity
              style={[styles.teamCard, { backgroundColor: colors.card, borderColor: '#06B6D440' }]}
              onPress={() => {
                analytics.track('team_upsell_analytics_card_tapped', { variant: hasDupes ? 'dupes' : 'coord' });
                router.push('/paywall' as any);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.teamCardHeader}>
                <View style={[styles.teamCardIcon, { backgroundColor: '#06B6D420' }]}>
                  <Ionicons name={hasDupes ? 'copy-outline' : 'people'} size={20} color="#06B6D4" />
                </View>
                <Text style={[styles.teamCardTitle, { color: colors.text }]}>
                  {hasDupes ? t('team_upsell.analytics_dupes_title') : t('team_upsell.analytics_coord_title')}
                </Text>
              </View>
              <Text style={[styles.teamCardDesc, { color: colors.textMuted }]}>
                {hasDupes ? t('team_upsell.analytics_dupes_desc') : t('team_upsell.analytics_coord_desc')}
              </Text>
              {hasDupes && dupeMonthly > 0 && (
                <Text style={[styles.teamCardSavings, { color: '#22C55E' }]}>
                  {t('team_upsell.analytics_dupes_savings', { amount: money(dupeMonthly * 12) })}
                </Text>
              )}
            </TouchableOpacity>
          );
        })()}

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
                <CategoryDonutChart categories={byCategory} total={categoryTotal} currencySymbol={currencySymbol} />
                <View style={styles.legendContainer}>
                  {byCategory.map((cat, idx) => {
                    const pct = categoryTotal > 0 ? Math.round((cat.total / categoryTotal) * 100) : 0;
                    return (
                      <View key={cat.id}>
                        <View style={[styles.legendRow, { paddingVertical: 8, borderBottomColor: colors.border }]}>
                          <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                          <CategoryIcon category={cat.id} size={14} />
                          <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={1}>
                            {String(t(`categories.${cat.id.toLowerCase()}`, cat.label))}
                          </Text>
                          <Text style={[styles.legendPercent, { color: colors.textSecondary }]}>
                            {pct}%
                          </Text>
                          <Text style={[styles.legendAmount, { color: colors.primary }]}>{money(cat.total)}</Text>
                        </View>
                      </View>
                    );
                  })}
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
              {cardBreakdown.length > 1 && (
                <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                  {cardBreakdown.map((card: any, idx: number) => {
                    const cardTotal = card.total ?? card.amount ?? 0;
                    const totalCard = cardBreakdown.reduce((s: number, c: any) => s + (c.total ?? c.amount ?? 0), 0);
                    const pct = totalCard > 0 ? (cardTotal / totalCard) * 100 : 0;
                    const barColors = ['#7C5CFF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#94A3B8'];
                    return <View key={idx} style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: barColors[idx % barColors.length] }} />;
                  })}
                </View>
              )}
              {cardBreakdown.map((card: any, i: number) => {
                const amount = card.total ?? card.amount ?? 0;
                return (
                  <View key={card.label || i} style={styles.cardBreakdownRow}>
                    <View style={[styles.cardBreakdownIconCircle, { backgroundColor: colors.primary + '18' }]}>
                      <Ionicons name="card" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.cardBreakdownLabelRow}>
                        <Text style={[styles.cardBreakdownLabel, { color: colors.text }]} numberOfLines={1}>{(() => {
                          const nick = card.label || card.card?.nickname || card.nickname;
                          if (nick === 'Unassigned' || !nick) {
                            if (card.card?.last4) return `····${card.card.last4} ${card.card.brand}`;
                            return t('common.no_card');
                          }
                          return nick;
                        })()}</Text>
                        <Text style={[styles.cardBreakdownAmount, { color: colors.primary }]}>{money(amount)}</Text>
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
          <BlurredProSection isPro={isPro} onUpgrade={() => setProModal({ visible: true, feature: 'forecast' })}>
            <View testID="analytics-forecast-row" style={styles.forecastRow}>
              <ForecastCard
                icon="calendar"
                label={t('analytics.forecast_30d')}
                value={money(forecast?.day30 ?? totalMonthly)}
                sub={t('analytics.avg_month')}
                color={colors.primary}
                accent={true}
              />
              <ForecastCard
                icon="trending-up"
                label={t('analytics.forecast_6m')}
                value={money(forecast?.month6 ?? totalMonthly * 6)}
                sub={t('analytics.forecast')}
                color={colors.success}
              />
              <ForecastCard
                icon="analytics"
                label={t('analytics.forecast_12m')}
                value={money(forecast?.month12 ?? totalYearly)}
                sub={t('analytics.forecast')}
                color={colors.warning}
              />
            </View>
          </BlurredProSection>
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
          <BlurredProSection isPro={isPro} onUpgrade={() => setProModal({ visible: true, feature: 'savings' })}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.savingsHighlight, { backgroundColor: isDark ? 'rgba(52,211,153,0.10)' : 'rgba(5,150,105,0.06)', borderColor: isDark ? 'rgba(52,211,153,0.25)' : 'rgba(5,150,105,0.15)' }]}>
                <View style={[styles.savingsIconCircle, { backgroundColor: colors.success + '18' }]}>
                  <Ionicons name="leaf" size={20} color={colors.success} />
                </View>
                <Text style={[styles.savingsAmount, { color: colors.success }]}>
                  {money(savings?.estimatedMonthlySavings ?? summary?.savingsPossible ?? 0)}
                </Text>
                <Text style={[styles.savingsLabel, { color: colors.textMuted }]}>{t('analytics.potential_savings')}</Text>
              </View>
              {/* Insights */}
              {savings?.insights && savings.insights.length > 0 && (
                <View style={{ marginTop: 12, gap: 6 }}>
                  {savings.insights.map((ins: any, i: number) => {
                    const text = typeof ins === 'string' ? ins
                      : ins.type === 'overlap_count' ? t('analytics.insight_overlap', { count: ins.data?.count, defaultValue: '{{count}} categories with overlapping subscriptions' })
                      : ins.type === 'biggest_overlap' ? t('analytics.insight_biggest', { name: ins.data?.name, savings: ins.data?.savings?.toFixed(2), defaultValue: 'Biggest overlap: {{name}} — ${{savings}}/mo' })
                      : ins.type === 'total_savings' ? t('analytics.insight_total', { monthly: ins.data?.monthly?.toFixed(0), yearly: ins.data?.yearly?.toFixed(0), defaultValue: 'Save ${{monthly}}/mo (${{yearly}}/yr) by consolidating' })
                      : '';
                    if (!text) return null;
                    return (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                        <Ionicons name="bulb-outline" size={14} color={colors.warning} style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 18 }}>{text}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Duplicates list */}
              {savings?.duplicates && savings.duplicates.length > 0 ? (
                <View style={{ gap: 10, marginTop: 12 }}>
                  {savings.duplicates.slice(0, 5).map((d: any, i: number) => (
                    <View key={i} style={{ padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 }} numberOfLines={1}>{d.name}</Text>
                        <View style={{ backgroundColor: colors.success + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.success }}>-{money(d.potentialSavings ?? 0)}/{t('common.mo', 'mo')}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {d.count ?? 2} {t('analytics.subs_in_category', 'subs in')} {t(`categories.${(d.category ?? '').toLowerCase()}`, d.category)} · {money(d.totalMonthly ?? 0)}/{t('period_short.MONTHLY', 'mo')} {t('analytics.total_spend', 'total')}
                      </Text>
                    </View>
                  ))}
                  {savings.duplicates.length > 5 && (
                    <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
                      +{savings.duplicates.length - 5} {t('common.more', 'more')}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={[styles.noDuplicates, { color: colors.textSecondary }]}>{t('analytics.no_duplicates')}</Text>
              )}
            </View>
          </BlurredProSection>
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
            <View testID="analytics-top5">
              {top5.map((sub, idx) => {
                const catInfo = CATEGORIES.find((c) => c.id.toUpperCase() === sub.category?.toUpperCase());
                const monthlyAmt = getMonthlyAmount(sub);
                const pct = totalMonthly > 0 ? (monthlyAmt / totalMonthly) * 100 : 0;
                return (
                  <View key={sub.id} style={[styles.top5Card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.top5Rank, { backgroundColor: colors.primary }]}>
                      <Text style={styles.top5RankText}>#{idx + 1}</Text>
                    </View>
                    <SubIcon
                      iconUrl={sub.iconUrl}
                      name={sub.name}
                      imageStyle={styles.top5Icon}
                      placeholderStyle={[styles.top5IconPlaceholder, { backgroundColor: colors.primaryLight }]}
                      textStyle={{ fontSize: 16, fontWeight: '800', color: colors.primary }}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.top5Name, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <CategoryIcon category={sub.category} size={12} />
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          {catInfo
                            ? String(t(`categories.${catInfo.id.toLowerCase()}`, catInfo.label))
                            : sub.category}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.top5Amount, { color: colors.text }]}>{money(monthlyAmt)}</Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted }}>/{t(`period_short.${(sub.billingPeriod || 'MONTHLY').toUpperCase()}`, 'mo')}</Text>
                    </View>
                    <View style={[styles.top5ProgressBg, { backgroundColor: colors.border }]}>
                      <View style={[styles.top5ProgressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: catInfo?.color || colors.primary }]} />
                    </View>
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
                <SubIcon
                  iconUrl={sub.iconUrl}
                  name={sub.name}
                  imageStyle={styles.subIconImage}
                  placeholderStyle={[styles.subIcon, { backgroundColor: colors.primaryLight }]}
                  textStyle={[styles.subIconText, { color: colors.primary }]}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.subName, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                  <Text style={[styles.subCategory, { color: colors.textSecondary }]} numberOfLines={1}>
                    <CategoryIcon category={CATEGORIES.find((c) => c.id.toUpperCase() === sub.category?.toUpperCase())?.id || 'OTHER'} size={14} />{' '}
                    {(() => {
                      const cat = CATEGORIES.find((c) => c.id.toUpperCase() === sub.category?.toUpperCase());
                      return cat ? String(t(`categories.${cat.id.toLowerCase()}`, cat.label)) : sub.category;
                    })()}
                  </Text>
                </View>
                <Text style={[styles.subAmount, { color: colors.text }]} numberOfLines={1}>
                  {formatMoney(sub.displayAmount ?? sub.amount, sub.displayCurrency ?? displayCurrency, lang)}/{t(`period_short.${(sub.billingPeriod || 'MONTHLY').toUpperCase()}`, 'mo')}
                </Text>
              </View>
            ))}
            {activeSubs.length === 0 && (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('analytics.no_data')}</Text>
            )}
          </View>
        </View>

        {/* ── 8. AI Analysis ──────────────────────────────────── */}
        <View style={styles.section}>
          <AIAnalysisSection isPro={isPro} />
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
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      {sub && <Text style={[statStyles.sub, { color: colors.textSecondary }]} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

// ── ForecastCard ────────────────────────────────────────────────────────────
function ForecastCard({ icon, label, value, sub, color, accent }: {
  icon: string; label: string; value: string | number; sub: string; color: string; accent?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[
      forecastStyles.card,
      { backgroundColor: colors.card, borderColor: accent ? color : colors.border },
      accent && { borderWidth: 1.5 },
    ]}>
      <View style={[styles.forecastIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text
        style={{ fontSize: accent ? 16 : 15, fontWeight: '900', color: colors.text, textAlign: 'center' }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={[styles.forecastLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.forecastSub, { color: colors.textMuted }]} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

// ── StyleSheets ─────────────────────────────────────────────────────────────

const forecastStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    minWidth: 0,
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
  section: { paddingHorizontal: 24, paddingTop: 24 },
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
  sectionTitle: { fontSize: 18, fontWeight: '800', flex: 1, marginBottom: 8 },
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
  legendLabel: { flex: 1, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  legendPercent: { fontSize: 12, minWidth: 40, textAlign: 'right', fontWeight: '700', flexShrink: 0 },
  legendAmount: { fontSize: 13, fontWeight: '800', minWidth: 70, textAlign: 'right', flexShrink: 0 },

  // Card Breakdown
  cardBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  cardBreakdownIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBreakdownLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardBreakdownLabel: { fontSize: 14, fontWeight: '700', flex: 1, flexShrink: 1 },
  cardBreakdownAmount: { fontSize: 14, fontWeight: '800', flexShrink: 0 },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  // Forecast
  forecastRow: { flexDirection: 'row', gap: 8 },

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

  // Empty state
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Top 5
  top5Card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10, position: 'relative' as const, overflow: 'hidden' as const },
  top5Rank: { position: 'absolute' as const, top: -1, left: -1, minWidth: 26, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 1, paddingHorizontal: 6 },
  top5RankText: { fontSize: 11, fontWeight: '800' as const, color: '#FFF' },
  top5Icon: { width: 40, height: 40, borderRadius: 12 },
  top5IconPlaceholder: { width: 40, height: 40, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  top5Name: { fontSize: 14, fontWeight: '700' },
  top5Amount: { fontSize: 15, fontWeight: '800' },
  top5ProgressBg: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, height: 3 },
  top5ProgressFill: { height: 3 },

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
  // StatCard
  statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, marginRight: 10, minWidth: 100 },
  statIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // ForecastCard
  forecastIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  forecastLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  forecastSub: { fontSize: 9, fontWeight: '500', textAlign: 'center' },

  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  // Team upsell card
  teamCard: { marginHorizontal: 20, marginTop: 16, marginBottom: 8, borderRadius: 16, padding: 16, borderWidth: 1.5 },
  teamCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  teamCardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  teamCardTitle: { fontSize: 15, fontWeight: '700' },
  teamCardDesc: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  teamCardSavings: { fontSize: 12, fontWeight: '700', marginTop: 10 },
});
