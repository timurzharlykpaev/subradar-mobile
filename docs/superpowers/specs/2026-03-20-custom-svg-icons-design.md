# Custom SVG Icons & HomeScreen UI Fixes

**Date:** 2026-03-20
**Status:** Approved

## Summary

Replace all unicode emoji icons across the mobile app with custom SVG React Native components (duotone style for categories, monochrome for UI). Fix HomeScreen layout issues: remove greeting/avatar, shorten subscription count text, fix price overflow.

## Scope

### Out of scope
- Language flags (stay as unicode emoji)
- Ionicons already used for navigation/system icons (checkmark-circle, time, close-circle, etc.)
- Push notification titles (`localNotifications.ts`) — OS renders emoji, SVG not applicable

---

## 1. HomeScreen Layout Fixes

### 1.1 Remove greeting & avatar
- **File:** `app/(tabs)/index.tsx` lines 143-160
- Remove the header row with "Good morning {name}" greeting, wave emoji, and profile avatar circle
- Screen starts directly with the Hero Card ("Total this month")
- Saves ~60px vertical space

### 1.2 Shorten "active subscriptions" text
- **File:** `app/(tabs)/index.tsx` hero card metadata section
- Change `active subscriptions` → `active subs`
- Prevents text from overflowing past the card center

### 1.3 Fix price "/mo" wrapping to second line
- **File:** `src/components/SubscriptionCard.tsx` line ~79
- Make amount + billing period stay on one line
- Apply `numberOfLines={1}` and `adjustsFontSizeToFit` on the price Text
- Ensure `flexShrink: 0` on price container so it doesn't compress

---

## 2. Custom SVG Icon System

### 2.1 Architecture
- Each icon is a `.tsx` file in `src/components/icons/`
- Uses `react-native-svg` (already a dependency via charts)
- All icons render on 24x24 viewBox
- Exported via `src/components/icons/index.ts`

### 2.2 Icon interface
```tsx
interface IconProps {
  size?: number;   // default 24, viewBox always 24x24, size scales via width/height
  color?: string;  // for monochrome icons — caller passes theme-aware color (e.g. colors.text)
}
```
- viewBox is always 24x24; `size` controls rendered `width`/`height`
- Monochrome icons require `color` from caller (no internal theme hook) — keeps icons pure/stateless
- Category icons have hardcoded colors — no `color` prop needed
- All icons include `accessibilityLabel` via accessible prop on root `<Svg>`

### 2.3 Category icons (duotone, colored)

Each category icon has a hardcoded brand color with duotone style (stroke + semi-transparent fill at 0.15-0.2 opacity).

| Category | Icon shape | Color |
|----------|-----------|-------|
| STREAMING | TV/monitor | `#7C3AED` (purple) |
| AI_SERVICES | brain/chip | `#3B82F6` (blue) |
| INFRASTRUCTURE | cloud | `#06B6D4` (cyan) |
| MUSIC | music note | `#EC4899` (pink) |
| GAMING | gamepad | `#10B981` (green) |
| PRODUCTIVITY | checklist | `#F59E0B` (amber) |
| HEALTH | heart-pulse | `#EF4444` (red) |
| NEWS | newspaper | `#6366F1` (indigo) |
| OTHER | box | `#6B7280` (gray) |

### 2.4 CategoryIcon wrapper component
```tsx
// src/components/icons/CategoryIcon.tsx
// Maps Category enum → colored icon component
// Props: { category: Category; size?: number }
```

Replaces current `CategoryBadge.tsx` emoji rendering.

### 2.5 UI icons (monochrome, color via props)

Default color adapts to theme. Size default 20px.

| Replaces | Icon | File |
|----------|------|------|
| `🎁` trial | gift box | GiftIcon.tsx |
| `🌐` website | globe | GlobeIcon.tsx |
| `📥` generate | download arrow | DownloadIcon.tsx |
| `⏳` loading | hourglass | HourglassIcon.tsx |
| `⚠️` error | warning triangle | WarningIcon.tsx |
| `✨` AI/screenshot | sparkles | SparklesIcon.tsx |
| `🔗` cancel page | external link | ExternalLinkIcon.tsx |
| `✕` close | X mark | (use Ionicons close-outline) |
| `🎙` microphone | mic | (use Ionicons mic-outline) |
| `⏹` stop | stop | (use Ionicons stop-circle-outline) |
| `✏️` edit | pencil | PencilIcon.tsx |
| `📌` pin/details | pin | PinIcon.tsx |
| `💰` money/price | dollar circle | MoneyIcon.tsx |
| `📋` clipboard | clipboard | ClipboardIcon.tsx |
| `⏰` alarm/trial | alarm clock | AlarmIcon.tsx |
| `📸` camera/screenshot | camera | CameraIcon.tsx |
| `💳` card | credit card | CreditCardIcon.tsx |
| `✓` checkmark | check | (use Ionicons checkmark-outline) |

### 2.6 Popular service icons (colored)

Used in AddSubscriptionSheet popular services list.

| Service | Replaces | Icon | File |
|---------|----------|------|------|
| Netflix | `🎬` | clapperboard | MovieIcon.tsx |
| Spotify | `🎵` | (reuse MusicIcon) | — |
| YouTube | `▶️` | play button | PlayIcon.tsx |
| iCloud | `☁️` | (reuse InfrastructureIcon) | — |
| Google One | `🗂️` | folder | FolderIcon.tsx |
| LinkedIn | `💼` | briefcase | BriefcaseIcon.tsx |
| Adobe | `🎨` | palette | PaletteIcon.tsx |
| Microsoft 365 | `📊` | bar chart | ChartBarIcon.tsx |
| ChatGPT | `🤖` | (reuse AiServicesIcon) | — |
| Notion | `📝` | pen/note | PenIcon.tsx |
| Figma | `🖌️` | brush/pen tool | BrushIcon.tsx |
| GitHub | `🐙` | octopus | OctopusIcon.tsx |
| DigitalOcean | `🌊` | wave/droplet | WaveDropIcon.tsx |
| Dropbox | `📦` | (reuse OtherIcon/box) | — |
| Disney+ | `✨` | (reuse SparklesIcon) | — |

Total unique new icons: ~28 (with reuse)

---

## 3. Files to modify

### Constants
- `src/constants/index.ts` — remove `emoji` field from CATEGORIES, keep for languages

### Components
- `src/components/CategoryBadge.tsx` — render CategoryIcon instead of emoji text
- `src/components/SubscriptionCard.tsx` — fix price overflow, replace trial emoji
- `src/components/UpcomingPaymentCard.tsx` — CategoryIcon instead of emoji
- `src/components/AddSubscriptionSheet.tsx` — service icons, FormSection emojis (pin, money, clipboard, alarm, camera), sparkles, close button
- `src/components/EditSubscriptionSheet.tsx` — Ionicons close-outline instead of ✕, FormSection emojis
- `src/components/VoiceRecorder.tsx` — mic/stop icons (Ionicons mic-outline, stop-circle-outline)
- `src/components/AIWizard.tsx` — ExternalLinkIcon, PencilIcon, checkmark
- `src/utils/ErrorBoundary.tsx` — WarningIcon instead of ⚠️

### Screens
- `app/(tabs)/index.tsx` — remove greeting/avatar, replace all emoji usage
- `app/(tabs)/analytics.tsx` — CategoryIcon in legends (4 locations: category mapping, legend, top-5 list, CATEGORIES lookup)
- `app/(tabs)/subscriptions.tsx` — CategoryIcon in filter chips
- `app/subscription/[id].tsx` — PencilIcon instead of ✏️ edit button
- `app/cards/index.tsx` — CreditCardIcon instead of 💳 empty state
- `app/paywall.tsx` — Ionicons checkmark-outline instead of ✓

### Notifications
- `src/utils/localNotifications.ts` — keep 💳 emoji in push notification titles (OS renders these, SVG not applicable)

### Localization (9 files)
- `src/locales/{en,ru,es,de,fr,pt,zh,ja,ko}.json` — remove emoji from translation strings (trial_until, open_website, cancel_page, cancel_subscription, generate, generating)

---

## 4. Migration strategy

1. Create all icon components in `src/components/icons/`
2. Update `CategoryBadge` to use `CategoryIcon`
3. Fix HomeScreen layout (greeting, text overflow, price)
4. Replace emoji in all screens and components
5. Clean emoji from all 9 locale files
6. Verify dark/light theme compatibility
