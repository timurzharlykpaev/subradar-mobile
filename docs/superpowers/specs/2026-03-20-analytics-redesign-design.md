# Analytics Screen Redesign — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Summary

Full visual redesign of the analytics screen: gradient bar chart, improved donut chart with % on slices, new color palette, better summary/forecast/top-5 cards, increased spacing.

## Out of scope
- Backend API changes (data stays the same)
- New analytics features (savings, trends)
- Reports screen (subproject C)

---

## 1. MonthlyBarChart — Gradient Bars

### Changes
- **Gradient fill** using `react-native-svg` `Defs` + `LinearGradient` + `Stop`
  - Bottom: transparent → Top: `colors.primary`
  - Max bar: full brightness gradient
  - Other bars: 60% opacity gradient
- **Labels** — only on max bar, 11px bold, with text shadow for readability
- **Grid lines** — remove dashed lines, keep subtle horizontal lines at 25%/50%/75% (1px, 5% opacity)
- **Month labels** — show all months, 10px, adequate spacing
- **Bar dimensions** — min width 16px (was 10px), gap 6px between bars
- **Chart height** — 200px (was 180px)
- **Rounded top** — bars have rounded top corners (rx=6)

### Technical approach
```tsx
<Defs>
  <LinearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
    <Stop offset="0" stopColor={colors.primary} stopOpacity="0" />
    <Stop offset="1" stopColor={colors.primary} stopOpacity="1" />
  </LinearGradient>
  <LinearGradient id="barGradientDim" x1="0" y1="1" x2="0" y2="0">
    <Stop offset="0" stopColor={colors.primary} stopOpacity="0" />
    <Stop offset="1" stopColor={colors.primary} stopOpacity="0.6" />
  </LinearGradient>
</Defs>
```
Each `<Rect>` uses `fill="url(#barGradient)"` or `fill="url(#barGradientDim)"`.

---

## 2. CategoryDonut — Larger, % on Slices

### Changes
- **Size** — 200x200 (was 160x160)
- **Radius** — outer 80, inner 52 (was 60/40)
- **% labels on slices** — for slices > 10%, show percentage in white bold text positioned at the midpoint of the arc
- **Center text** — total amount 24px bold 900 + "Total" label 11px muted below
- **New color palette** (brighter, more contrast):

| Category | Color |
|----------|-------|
| STREAMING | `#FF4757` |
| AI_SERVICES | `#A855F7` |
| INFRASTRUCTURE | `#3B82F6` |
| MUSIC | `#EC4899` |
| GAMING | `#22C55E` |
| PRODUCTIVITY | `#F59E0B` |
| HEALTH | `#EF4444` |
| NEWS | `#06B6D4` |
| OTHER | `#94A3B8` |

- **Legend** — each row: color dot + CategoryIcon (14px) + label + percent + amount, with horizontal divider line between rows

### % label positioning
Calculate midpoint angle of each arc, then position text at `(cx + midRadius * cos(midAngle), cy + midRadius * sin(midAngle))` where `midRadius = (outerRadius + innerRadius) / 2`.

---

## 3. Summary Strip

### Current
3 flat numbers in a row (monthly/yearly/active count)

### New
3 cards with:
- Ionicon on top in colored circle (24px)
- Number below, 20px bold 900
- Label below number, 11px muted
- Card: `colors.card` background, rounded 16px, borderWidth 1, borderColor `colors.border`
- Icons: `repeat-outline` (monthly) / `calendar-outline` (yearly) / `trending-up-outline` (active)

---

## 4. Forecast Section

### Current
3 identical cards in a row

### New — visual hierarchy
- **First card (30 days)** — larger, accent color border (`colors.primary`), amount 20px bold, label + sub count below, icon in colored circle
- **Second + Third (6mo, 12mo)** — smaller, neutral border, amount 16px bold
- Pro badge overlay if user on free plan
- Cards: rounded 16px, `colors.card` bg

---

## 5. Top 5 Most Expensive

### Current
Plain text list

### New — subscription cards
Each item is a card with:
- **Left:** subscription icon (iconUrl → Image, or name initial placeholder), 40x40 rounded 12
- **Center:** name (14px bold) + category with CategoryIcon (12px)
- **Right:** price (16px bold 800) + billing period (10px muted)
- **Bottom:** thin progress bar showing % of total spend, height 3px, rounded, filled with subscription color or primary
- **Rank badge** — small circle (#1, #2...) top-left of icon, primary bg, white text, 16x16

---

## 6. Card Breakdown

### Current
Basic list

### New
- Each payment card: card with brand icon + last4 + total amount
- Horizontal stacked bar showing distribution across cards (each segment = card's % of total)
- "Unassigned" shown in gray

---

## 7. General Spacing & Layout

- Section padding: 24px horizontal, 24px top gap between sections (was ~16px)
- Section headers: 18px bold, left-aligned, no icons
- 8px gap between header and content
- Scroll padding bottom: 120px
- Card shadow: `shadowOpacity: 0.04, shadowRadius: 8, elevation: 2`

---

## 8. Color Palette Update

The new category colors should be updated in `src/constants/index.ts` CATEGORIES array (the `color` field). This affects CategoryBadge, CategoryIcon, and all chart rendering.

**Note:** CategoryIcon components use `cat.color` from CATEGORIES via CategoryIcon wrapper — updating CATEGORIES.color automatically updates icons.

---

## 9. Files to Modify

- `app/(tabs)/analytics.tsx` — entire screen rewrite (MonthlyBarChart, CategoryDonut, layout, cards)
- `src/constants/index.ts` — update CATEGORIES color palette
- No backend changes needed
- No new dependencies (react-native-svg already installed)
