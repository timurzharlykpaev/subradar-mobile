# Analytics Screen Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the analytics screen with gradient bar chart, improved donut, better cards, and more spacing.

**Architecture:** Single file rewrite of `app/(tabs)/analytics.tsx` plus color palette update in constants. Charts use react-native-svg with LinearGradient. No backend changes needed.

**Tech Stack:** React Native, react-native-svg (LinearGradient, Defs, Stop), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-analytics-redesign-design.md`

---

## Task 1: Update category color palette

**Files:**
- Modify: `src/constants/index.ts`

- [ ] **Step 1: Update CATEGORIES colors**

In `src/constants/index.ts`, update the `color` field for each category:

```typescript
export const CATEGORIES = [
  { id: 'STREAMING', label: 'Streaming', color: '#FF4757' },
  { id: 'AI_SERVICES', label: 'AI Services', color: '#A855F7' },
  { id: 'INFRASTRUCTURE', label: 'Infrastructure', color: '#3B82F6' },
  { id: 'MUSIC', label: 'Music', color: '#EC4899' },
  { id: 'GAMING', label: 'Gaming', color: '#22C55E' },
  { id: 'PRODUCTIVITY', label: 'Productivity', color: '#F59E0B' },
  { id: 'HEALTH', label: 'Health', color: '#EF4444' },
  { id: 'NEWS', label: 'News', color: '#06B6D4' },
  { id: 'OTHER', label: 'Other', color: '#94A3B8' },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/index.ts
git commit -m "style: update category color palette to brighter tones"
```

---

## Task 2: Rewrite MonthlyBarChart with gradient bars

**Files:**
- Modify: `app/(tabs)/analytics.tsx` (MonthlyBarChart function only, lines ~26-101)

- [ ] **Step 1: Read the full file, then rewrite MonthlyBarChart**

Replace the entire `MonthlyBarChart` function with a new version that uses gradient fills. Key changes:

1. Add `Defs`, `LinearGradient`, `Stop` to the `react-native-svg` import (add if not already there)
2. Increase `CHART_HEIGHT` to 200 (from 180)
3. Increase bar min width to 16 (from 10)
4. Replace solid `fill` with `fill="url(#barGrad)"` and `fill="url(#barGradDim)"`
5. Replace dashed grid lines with subtle solid lines (opacity 0.05)
6. Show labels only on max bar, 11px bold with shadow
7. Show all month labels (not filtered)
8. Increase bar corner radius to 6

The new MonthlyBarChart should look like:

```tsx
const CHART_HEIGHT = 200;

function MonthlyBarChart({ data }: { data: { month: string; total: number }[] }) {
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
        <Defs>
          <LinearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.05" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="barGradDim" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.02" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0.5" />
          </LinearGradient>
        </Defs>
        {gridLines.map((line, i) => (
          <React.Fragment key={`grid-${i}`}>
            <Line x1={yAxisW} y1={line.y} x2={chartW} y2={line.y} stroke={colors.text} strokeWidth={0.5} strokeOpacity={0.05} />
            <SvgText x={yAxisW - 4} y={line.y + 3} fontSize={9} fill={colors.textMuted} textAnchor="end">{line.label}</SvgText>
          </React.Fragment>
        ))}
        {data.map((d, i) => {
          const barH = Math.max(4, (d.total / maxVal) * chartAreaH);
          const x = yAxisW + i * (barsW / data.length) + (barsW / data.length - barW) / 2;
          const y = chartAreaH - barH;
          const isMax = d.total === maxVal && d.total > 0;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={barH} rx={6} fill={isMax ? 'url(#barGrad)' : 'url(#barGradDim)'} />
              {isMax && d.total > 0 && (
                <SvgText x={x + barW / 2} y={y - 6} fontSize={11} fontWeight="700" fill={colors.primary} textAnchor="middle">
                  ${d.total >= 1000 ? `${(d.total / 1000).toFixed(1)}k` : d.total.toFixed(0)}
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
```

Make sure to update the `react-native-svg` import to include `Defs`, `LinearGradient`, `Stop`:

```tsx
import Svg, { Path as SvgPath, Rect, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
```

- [ ] **Step 2: Commit**

```bash
git add "app/(tabs)/analytics.tsx"
git commit -m "feat: gradient bar chart with improved labels and spacing"
```

---

## Task 3: Rewrite CategoryDonutChart with % on slices

**Files:**
- Modify: `app/(tabs)/analytics.tsx` (CategoryDonutChart function only, lines ~103-162)

- [ ] **Step 1: Rewrite CategoryDonutChart**

Replace the entire `CategoryDonutChart` function. Key changes:
- Size 200x200, radius 80, innerRadius 52
- Add `pct` and `midAngle` to each slice for % label positioning
- Show % label on slices > 10% using SvgText at arc midpoint
- Center: total amount 24px bold + "Total" 11px muted
- Return `categoryId` in slice data for legend

```tsx
function CategoryDonutChart({ categories, total, avgLabel }: {
  categories: { id: string; color: string; total: number; label?: string; categoryId?: string }[];
  total: number;
  avgLabel: string;
}) {
  const { colors } = useTheme();
  const size = 200;
  const radius = 80;
  const innerRadius = 52;
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
      return { d, color: cat.color, pct, labelX, labelY, showLabel: pct >= 10 };
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
            y={slice.labelY + 4}
            fontSize={11}
            fontWeight="800"
            fill="#FFF"
            textAnchor="middle"
          >
            {slice.pct}%
          </SvgText>
        ))}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>${Number(total).toFixed(0)}</Text>
        <Text style={{ fontSize: 11, color: colors.textMuted }}>Total</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(tabs)/analytics.tsx"
git commit -m "feat: donut chart with % labels on slices, larger size"
```

---

## Task 4: Redesign screen layout — summary, forecast, top-5, cards, spacing

**Files:**
- Modify: `app/(tabs)/analytics.tsx` (the main AnalyticsScreen component + StatCard/ForecastCard + styles)

- [ ] **Step 1: Read the rest of the file (lines 270+) and update the layout**

Make these changes throughout the screen:

### Summary Strip
Update the StatCard component to have icon in colored circle on top:
```tsx
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}
```

### Forecast Section
Update ForecastCard — first card (30d) larger with accent border:
```tsx
function ForecastCard({ icon, label, value, sub, color, accent }: {
  icon: string; label: string; value: string; sub: string; color: string; accent?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[
      styles.forecastCard,
      { backgroundColor: colors.card, borderColor: accent ? color : colors.border },
      accent && { borderWidth: 1.5 },
    ]}>
      <View style={[styles.forecastIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[accent ? styles.forecastValueLg : styles.forecastValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.forecastLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.forecastSub, { color: colors.textMuted }]}>{sub}</Text>
    </View>
  );
}
```

Pass `accent={true}` to the first forecast card (30 days).

### Top 5 Most Expensive
Replace the current rendering with cards that include:
- Icon/placeholder left (40x40)
- Name + category center
- Price right (bold)
- Progress bar bottom (thin, 3px, rounded)
- Rank badge

```tsx
{top5.map((sub, idx) => {
  const catInfo = CATEGORIES.find((c) => c.id.toUpperCase() === sub.category?.toUpperCase());
  const monthlyAmt = getMonthlyAmount(sub);
  const pct = totalMonthly > 0 ? (monthlyAmt / totalMonthly) * 100 : 0;
  return (
    <View key={sub.id} style={[styles.top5Card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.top5Rank}>
        <Text style={styles.top5RankText}>#{idx + 1}</Text>
      </View>
      {sub.iconUrl ? (
        <Image source={{ uri: sub.iconUrl }} style={styles.top5Icon} />
      ) : (
        <View style={[styles.top5IconPlaceholder, { backgroundColor: colors.primaryLight }]}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>{sub.name[0]}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.top5Name, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <CategoryIcon category={sub.category} size={12} />
          <Text style={{ fontSize: 11, color: colors.textMuted }}>{catInfo?.label || sub.category}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.top5Amount, { color: colors.text }]}>${monthlyAmt.toFixed(2)}</Text>
        <Text style={{ fontSize: 10, color: colors.textMuted }}>/{PERIOD_SHORT[sub.billingPeriod] || 'mo'}</Text>
      </View>
      <View style={[styles.top5ProgressBg, { backgroundColor: colors.border }]}>
        <View style={[styles.top5ProgressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: catInfo?.color || colors.primary }]} />
      </View>
    </View>
  );
})}
```

### Legend for donut
Update the legend section (after CategoryDonutChart) to include dividers:
```tsx
{byCategory.map((cat, idx) => (
  <View key={cat.id}>
    <View style={[styles.legendRow, { paddingVertical: 8 }]}>
      <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
      <CategoryIcon category={cat.id} size={14} />
      <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={1}>{cat.label}</Text>
      <Text style={[styles.legendPercent, { color: colors.textMuted }]}>
        {categoryTotal > 0 ? Math.round((cat.total / categoryTotal) * 100) : 0}%
      </Text>
      <Text style={[styles.legendAmount, { color: colors.primary }]}>${Number(cat.total).toFixed(0)}</Text>
    </View>
    {idx < byCategory.length - 1 && <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.3 }} />}
  </View>
))}
```

### Card Breakdown
Add horizontal stacked bar for card distribution:
```tsx
<View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
  {cardBreakdown.map((card: any, idx: number) => {
    const pct = (card.total ?? card.amount ?? 0) / cardMax * 100;
    const barColors = ['#7C5CFF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#94A3B8'];
    return <View key={idx} style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: barColors[idx % barColors.length] }} />;
  })}
</View>
```

### Spacing updates in styles
Update StyleSheet:
```tsx
section: { paddingHorizontal: 24, paddingTop: 24 },
sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
```

And add new styles for top5:
```tsx
top5Card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8, position: 'relative' },
top5Rank: { position: 'absolute', top: -6, left: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#7C5CFF', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
top5RankText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
top5Icon: { width: 40, height: 40, borderRadius: 12 },
top5IconPlaceholder: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
top5Name: { fontSize: 14, fontWeight: '700' },
top5Amount: { fontSize: 15, fontWeight: '800' },
top5ProgressBg: { position: 'absolute', bottom: 0, left: 12, right: 12, height: 3, borderRadius: 1.5 },
top5ProgressFill: { height: 3, borderRadius: 1.5 },
forecastValueLg: { fontSize: 20, fontWeight: '900' },
```

- [ ] **Step 2: Commit**

```bash
git add "app/(tabs)/analytics.tsx"
git commit -m "feat: redesign analytics layout — summary, forecast, top-5, spacing"
```

---

## Task 5: Verify build

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Visual check**

```bash
npx expo start
```

Check analytics screen: gradient bars, donut with %, new colors, improved cards.

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: address analytics redesign issues"
```
