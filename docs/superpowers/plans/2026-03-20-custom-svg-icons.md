# Custom SVG Icons & HomeScreen UI Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all unicode emoji across the mobile app with custom SVG icon components, fix HomeScreen layout (remove greeting, shorten text, fix price overflow).

**Architecture:** SVG icons as stateless React Native components using `react-native-svg`. Category icons are duotone (stroke + semi-transparent fill) with colors inherited from CATEGORIES constant (not hardcoded in icon). UI icons are monochrome with `color` prop. A `CategoryIcon` wrapper maps category IDs to the correct icon, passing the CATEGORIES color.

**Note on colors:** Category SVG icons accept a `color` prop from `CategoryIcon`, which reads `cat.color` from CATEGORIES. This keeps icon colors in sync with badge backgrounds. The spec's hardcoded colors were for reference only.

**Tech Stack:** React Native, react-native-svg (already installed v15.12.1), TypeScript, Expo Router

**Spec:** `docs/superpowers/specs/2026-03-20-custom-svg-icons-design.md`

---

## Task 1: Create category SVG icon components

**Files:**
- Create: `src/components/icons/StreamingIcon.tsx`
- Create: `src/components/icons/AiServicesIcon.tsx`
- Create: `src/components/icons/InfrastructureIcon.tsx`
- Create: `src/components/icons/MusicIcon.tsx`
- Create: `src/components/icons/GamingIcon.tsx`
- Create: `src/components/icons/ProductivityIcon.tsx`
- Create: `src/components/icons/HealthIcon.tsx`
- Create: `src/components/icons/NewsIcon.tsx`
- Create: `src/components/icons/OtherIcon.tsx`

All category icons share a common interface accepting `color` from the caller (CategoryIcon passes `cat.color` from CATEGORIES). This avoids color mismatches between icon and badge background.

```tsx
// Shared interface for all category icons:
interface CategoryIconProps {
  size?: number;
  color?: string;  // passed by CategoryIcon from CATEGORIES[].color
}
```

- [ ] **Step 1: Create StreamingIcon (TV/monitor)**

```tsx
// src/components/icons/StreamingIcon.tsx
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface CategoryIconProps { size?: number; color?: string; }

export const StreamingIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#E53935' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Streaming">
    <Rect x="2" y="3" width="20" height="14" rx="2" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M8 21h8M12 17v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M10 8l4 2.5-4 2.5V8z" fill={color} />
  </Svg>
);
```

- [ ] **Step 2: Create remaining 8 category icons**

All follow the same pattern as StreamingIcon — accept `size` and `color` props with default colors matching CATEGORIES constant. Create files:

- `AiServicesIcon.tsx` — brain/lightbulb shape, default color `#8E24AA`
- `InfrastructureIcon.tsx` — cloud shape, default color `#039BE5`
- `MusicIcon.tsx` — music notes shape, default color `#8E24AA`
- `GamingIcon.tsx` — gamepad shape, default color `#43A047`
- `ProductivityIcon.tsx` — checklist shape, default color `#1E88E5`
- `HealthIcon.tsx` — heart-pulse shape, default color `#FB8C00`
- `NewsIcon.tsx` — newspaper shape, default color `#00ACC1`
- `OtherIcon.tsx` — box shape, default color `#757575`

Each icon: duotone style (stroke + `fill={color + '20'}`), viewBox 24x24, `accessible accessibilityLabel="..."`.

Example for AiServicesIcon:
```tsx
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface CategoryIconProps { size?: number; color?: string; }

export const AiServicesIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#8E24AA' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="AI Services">
    <Path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.2 6H8.2C6.3 13.7 5 11.5 5 9a7 7 0 0 1 7-7z" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M9 22h6M10 19h4M9 15h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="10" cy="9" r="1" fill={color} />
    <Circle cx="14" cy="9" r="1" fill={color} />
  </Svg>
);
```

Follow same pattern for all 8 remaining icons.
```

- [ ] **Step 10: Commit category icons**

```bash
git add src/components/icons/
git commit -m "feat: add 9 duotone category SVG icon components"
```

---

## Task 2: Create CategoryIcon wrapper and index

**Files:**
- Create: `src/components/icons/CategoryIcon.tsx`
- Create: `src/components/icons/index.ts`

- [ ] **Step 1: Create CategoryIcon wrapper**

CategoryIcon reads `cat.color` from CATEGORIES and passes it to the icon component, ensuring icon color matches badge background.

```tsx
// src/components/icons/CategoryIcon.tsx
import React from 'react';
import { CATEGORIES } from '../../constants';
import { StreamingIcon } from './StreamingIcon';
import { AiServicesIcon } from './AiServicesIcon';
import { InfrastructureIcon } from './InfrastructureIcon';
import { MusicIcon } from './MusicIcon';
import { GamingIcon } from './GamingIcon';
import { ProductivityIcon } from './ProductivityIcon';
import { HealthIcon } from './HealthIcon';
import { NewsIcon } from './NewsIcon';
import { OtherIcon } from './OtherIcon';

const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  STREAMING: StreamingIcon,
  AI_SERVICES: AiServicesIcon,
  INFRASTRUCTURE: InfrastructureIcon,
  MUSIC: MusicIcon,
  GAMING: GamingIcon,
  PRODUCTIVITY: ProductivityIcon,
  HEALTH: HealthIcon,
  NEWS: NewsIcon,
  OTHER: OtherIcon,
};

interface Props {
  category: string;
  size?: number;
}

export const CategoryIcon: React.FC<Props> = ({ category, size = 24 }) => {
  const cat = CATEGORIES.find((c) => c.id === category);
  const Icon = ICON_MAP[category] || OtherIcon;
  return <Icon size={size} color={cat?.color} />;
};
```

- [ ] **Step 2: Create index.ts barrel export**

```tsx
// src/components/icons/index.ts
export { CategoryIcon } from './CategoryIcon';
export { StreamingIcon } from './StreamingIcon';
export { AiServicesIcon } from './AiServicesIcon';
export { InfrastructureIcon } from './InfrastructureIcon';
export { MusicIcon } from './MusicIcon';
export { GamingIcon } from './GamingIcon';
export { ProductivityIcon } from './ProductivityIcon';
export { HealthIcon } from './HealthIcon';
export { NewsIcon } from './NewsIcon';
export { OtherIcon } from './OtherIcon';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/icons/
git commit -m "feat: add CategoryIcon wrapper and barrel exports"
```

---

## Task 3: Create UI monochrome SVG icon components

**Files:**
- Create: `src/components/icons/GiftIcon.tsx`
- Create: `src/components/icons/GlobeIcon.tsx`
- Create: `src/components/icons/DownloadIcon.tsx`
- Create: `src/components/icons/HourglassIcon.tsx`
- Create: `src/components/icons/WarningIcon.tsx`
- Create: `src/components/icons/SparklesIcon.tsx`
- Create: `src/components/icons/ExternalLinkIcon.tsx`
- Create: `src/components/icons/PencilIcon.tsx`
- Create: `src/components/icons/PinIcon.tsx`
- Create: `src/components/icons/MoneyIcon.tsx`
- Create: `src/components/icons/ClipboardIcon.tsx`
- Create: `src/components/icons/AlarmIcon.tsx`
- Create: `src/components/icons/CameraIcon.tsx`
- Create: `src/components/icons/CreditCardIcon.tsx`
- Create: `src/components/icons/TrashIcon.tsx`

Each icon follows this pattern (monochrome, color from props):

```tsx
interface IconProps {
  size?: number;
  color?: string;
}
```

- [ ] **Step 1: Create GiftIcon**

```tsx
// src/components/icons/GiftIcon.tsx
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const GiftIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Gift">
    <Rect x="3" y="11" width="18" height="10" rx="2" stroke={color} strokeWidth="1.8" />
    <Rect x="2" y="7" width="20" height="4" rx="1" stroke={color} strokeWidth="1.8" />
    <Path d="M12 7v14M7.5 7C6 7 5 5.5 5.5 4.5S7.5 3 9 4l3 3M16.5 7c1.5 0 2.5-1.5 2-2.5S14.5 3 15 4l-3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
```

- [ ] **Step 2: Create GlobeIcon, DownloadIcon, HourglassIcon**

```tsx
// src/components/icons/GlobeIcon.tsx
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const GlobeIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Globe">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
    <Path d="M2 12h20M12 2a16 16 0 0 1 4 10 16 16 0 0 1-4 10 16 16 0 0 1-4-10A16 16 0 0 1 12 2z" stroke={color} strokeWidth="1.8" />
  </Svg>
);
```

```tsx
// src/components/icons/DownloadIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const DownloadIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Download">
    <Path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
```

```tsx
// src/components/icons/HourglassIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const HourglassIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Loading">
    <Path d="M5 3h14M5 21h14M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
```

- [ ] **Step 3: Create WarningIcon, SparklesIcon, ExternalLinkIcon**

```tsx
// src/components/icons/WarningIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const WarningIcon: React.FC<IconProps> = ({ size = 20, color = '#F59E0B' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Warning">
    <Path d="M12 2L2 20h20L12 2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M12 10v4M12 17v.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);
```

```tsx
// src/components/icons/SparklesIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const SparklesIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="AI">
    <Path d="M9 2l1.5 5L15 9l-4.5 2L9 16l-1.5-5L3 9l4.5-2L9 2z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity={0.15} strokeLinejoin="round" />
    <Path d="M18 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity={0.15} strokeLinejoin="round" />
  </Svg>
);
```

```tsx
// src/components/icons/ExternalLinkIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const ExternalLinkIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="External Link">
    <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
```

- [ ] **Step 4: Create PencilIcon, PinIcon, MoneyIcon, ClipboardIcon, AlarmIcon**

```tsx
// src/components/icons/PencilIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const PencilIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Edit">
    <Path d="M17 3l4 4L7 21H3v-4L17 3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M14 6l4 4" stroke={color} strokeWidth="1.8" />
  </Svg>
);
```

```tsx
// src/components/icons/PinIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const PinIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Details">
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={color} strokeWidth="1.8" />
    <Path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" stroke={color} strokeWidth="1.8" />
  </Svg>
);
```

```tsx
// src/components/icons/MoneyIcon.tsx
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const MoneyIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Price">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
    <Path d="M12 6v12M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
```

```tsx
// src/components/icons/ClipboardIcon.tsx
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const ClipboardIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Clipboard">
    <Rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M9 3V2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M9 10h6M9 14h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
```

```tsx
// src/components/icons/AlarmIcon.tsx
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const AlarmIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Alarm">
    <Circle cx="12" cy="13" r="8" stroke={color} strokeWidth="1.8" />
    <Path d="M12 9v4l2.5 2.5M4.5 4.5L7 7M19.5 4.5L17 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
```

- [ ] **Step 5: Create CameraIcon, CreditCardIcon, TrashIcon**

```tsx
// src/components/icons/CameraIcon.tsx
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const CameraIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Camera">
    <Path d="M3 9a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" stroke={color} strokeWidth="1.8" />
    <Circle cx="12" cy="14" r="4" stroke={color} strokeWidth="1.8" />
  </Svg>
);
```

```tsx
// src/components/icons/CreditCardIcon.tsx
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const CreditCardIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Credit Card">
    <Rect x="2" y="4" width="20" height="16" rx="3" stroke={color} strokeWidth="1.8" />
    <Path d="M2 10h20M6 15h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
```

```tsx
// src/components/icons/TrashIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const TrashIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Delete">
    <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
```

- [ ] **Step 6: Update index.ts with all new exports**

Add to `src/components/icons/index.ts`:

```tsx
export { GiftIcon } from './GiftIcon';
export { GlobeIcon } from './GlobeIcon';
export { DownloadIcon } from './DownloadIcon';
export { HourglassIcon } from './HourglassIcon';
export { WarningIcon } from './WarningIcon';
export { SparklesIcon } from './SparklesIcon';
export { ExternalLinkIcon } from './ExternalLinkIcon';
export { PencilIcon } from './PencilIcon';
export { PinIcon } from './PinIcon';
export { MoneyIcon } from './MoneyIcon';
export { ClipboardIcon } from './ClipboardIcon';
export { AlarmIcon } from './AlarmIcon';
export { CameraIcon } from './CameraIcon';
export { CreditCardIcon } from './CreditCardIcon';
export { TrashIcon } from './TrashIcon';
```

- [ ] **Step 7: Commit**

```bash
git add src/components/icons/
git commit -m "feat: add 15 monochrome UI SVG icon components"
```

---

## Task 4: Create popular service icons

**Files:**
- Create: `src/components/icons/MovieIcon.tsx`
- Create: `src/components/icons/PlayIcon.tsx`
- Create: `src/components/icons/FolderIcon.tsx`
- Create: `src/components/icons/BriefcaseIcon.tsx`
- Create: `src/components/icons/PaletteIcon.tsx`
- Create: `src/components/icons/ChartBarIcon.tsx`
- Create: `src/components/icons/PenIcon.tsx`
- Create: `src/components/icons/BrushIcon.tsx`
- Create: `src/components/icons/OctopusIcon.tsx`
- Create: `src/components/icons/WaveDropIcon.tsx`

- [ ] **Step 1: Create MovieIcon, PlayIcon, FolderIcon**

```tsx
// src/components/icons/MovieIcon.tsx
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const MovieIcon: React.FC<IconProps> = ({ size = 20, color = '#E53935' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Movie">
    <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M2 8l4-4M8 4l-4 4M22 8l-4-4M18 4l4 4M2 16l4 4M8 20l-4-4M22 16l-4 4M18 20l4-4" stroke={color} strokeWidth="1.2" />
    <Path d="M10 9l5 3-5 3V9z" fill={color} />
  </Svg>
);
```

```tsx
// src/components/icons/PlayIcon.tsx
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const PlayIcon: React.FC<IconProps> = ({ size = 20, color = '#FF0000' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Play">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
    <Path d="M10 8l6 4-6 4V8z" fill={color} />
  </Svg>
);
```

```tsx
// src/components/icons/FolderIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const FolderIcon: React.FC<IconProps> = ({ size = 20, color = '#4285F4' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Folder">
    <Path d="M2 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" stroke={color} strokeWidth="1.8" />
  </Svg>
);
```

- [ ] **Step 2: Create BriefcaseIcon, PaletteIcon, ChartBarIcon**

```tsx
// src/components/icons/BriefcaseIcon.tsx
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const BriefcaseIcon: React.FC<IconProps> = ({ size = 20, color = '#0A66C2' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Briefcase">
    <Rect x="2" y="7" width="20" height="14" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
```

```tsx
// src/components/icons/PaletteIcon.tsx
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const PaletteIcon: React.FC<IconProps> = ({ size = 20, color = '#FF0000' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Palette">
    <Path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2v-.5c0-.55.2-1.05.55-1.41.35-.37.85-.59 1.45-.59h1.5a4.5 4.5 0 0 0 4.5-4.5c0-5-4.03-9-9-9z" stroke={color} strokeWidth="1.8" />
    <Circle cx="7.5" cy="11" r="1.5" fill={color} />
    <Circle cx="11" cy="7" r="1.5" fill={color} />
    <Circle cx="15" cy="8" r="1.5" fill={color} />
  </Svg>
);
```

```tsx
// src/components/icons/ChartBarIcon.tsx
import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const ChartBarIcon: React.FC<IconProps> = ({ size = 20, color = '#D83B01' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Chart">
    <Rect x="3" y="12" width="4" height="9" rx="1" stroke={color} strokeWidth="1.8" />
    <Rect x="10" y="6" width="4" height="15" rx="1" stroke={color} strokeWidth="1.8" />
    <Rect x="17" y="3" width="4" height="18" rx="1" stroke={color} strokeWidth="1.8" />
  </Svg>
);
```

- [ ] **Step 3: Create PenIcon, BrushIcon, OctopusIcon, WaveDropIcon**

```tsx
// src/components/icons/PenIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const PenIcon: React.FC<IconProps> = ({ size = 20, color = '#000000' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Note">
    <Path d="M14 2l8 8-11 11H3v-8L14 2zM3 22h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
```

```tsx
// src/components/icons/BrushIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const BrushIcon: React.FC<IconProps> = ({ size = 20, color = '#A259FF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Brush">
    <Path d="M18 2l4 4-9.5 9.5a4 4 0 0 1-3 1.2L8 17l.3-1.5a4 4 0 0 1 1.2-3L18 2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M8 17c-2 0-4 1-4 4h4c3 0 4-2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
```

```tsx
// src/components/icons/OctopusIcon.tsx
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const OctopusIcon: React.FC<IconProps> = ({ size = 20, color = '#333' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="GitHub">
    <Circle cx="12" cy="10" r="7" stroke={color} strokeWidth="1.8" />
    <Path d="M5 14c-1 3 0 5 1 6M8 16c-1 3 0 5 1 5M12 17v4M16 16c1 3 0 5-1 5M19 14c1 3 0 5-1 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Circle cx="9.5" cy="9" r="1.2" fill={color} />
    <Circle cx="14.5" cy="9" r="1.2" fill={color} />
  </Svg>
);
```

```tsx
// src/components/icons/WaveDropIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps { size?: number; color?: string; }

export const WaveDropIcon: React.FC<IconProps> = ({ size = 20, color = '#0080FF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="DigitalOcean">
    <Path d="M12 2C7 2 3 7 3 12s4 8 9 8v-5H8v-3h4V9h3v3h3v4h-4v5c5-1 8-5 8-9s-5-10-10-10z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
  </Svg>
);
```

- [ ] **Step 4: Update index.ts with service icon exports**

Add to `src/components/icons/index.ts`:

```tsx
export { MovieIcon } from './MovieIcon';
export { PlayIcon } from './PlayIcon';
export { FolderIcon } from './FolderIcon';
export { BriefcaseIcon } from './BriefcaseIcon';
export { PaletteIcon } from './PaletteIcon';
export { ChartBarIcon } from './ChartBarIcon';
export { PenIcon } from './PenIcon';
export { BrushIcon } from './BrushIcon';
export { OctopusIcon } from './OctopusIcon';
export { WaveDropIcon } from './WaveDropIcon';
```

- [ ] **Step 5: Commit**

```bash
git add src/components/icons/
git commit -m "feat: add 10 popular service SVG icon components"
```

---

## Task 5: Update CategoryBadge to use CategoryIcon

**Files:**
- Modify: `src/components/CategoryBadge.tsx`

- [ ] **Step 1: Replace emoji rendering with CategoryIcon**

Replace the entire `CategoryBadge.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATEGORIES } from '../constants';
import { CategoryIcon } from './icons';

interface Props {
  categoryId: string;
  size?: 'sm' | 'md';
}

export const CategoryBadge: React.FC<Props> = ({ categoryId, size = 'md' }) => {
  const cat = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: cat.color + '20' }, isSmall && styles.sm]}>
      <CategoryIcon category={cat.id} size={isSmall ? 12 : 14} />
      {!isSmall && (
        <Text style={[styles.label, { color: cat.color }]}>{cat.label}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  sm: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  label: { fontSize: 12, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CategoryBadge.tsx
git commit -m "refactor: CategoryBadge uses CategoryIcon instead of emoji"
```

---

## Task 6: Fix HomeScreen — remove greeting, fix text, fix prices

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Remove greeting header (lines 143-160)**

Replace lines 143-160 (the Header section) with just the PRO badge if applicable:

```tsx
        {/* ── PRO Badge ────────────────────────────────────────── */}
        {isPro && (
          <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <View style={[styles.planBadge, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="diamond" size={12} color={colors.primary} />
              <Text style={[styles.planBadgeText, { color: colors.primary }]}>PRO</Text>
            </View>
          </View>
        )}
```

Also remove these unused style keys: `header`, `greeting`, `userName`, `avatar`, `avatarText`.
Remove the `greeting()` function (lines 116-121).

- [ ] **Step 2: Shorten "active subscriptions" text (line 181)**

Change line 181 from:
```tsx
<Text style={styles.heroMetaText}>{activeSubs.length} {t('dashboard.active_subscriptions')}</Text>
```
to:
```tsx
<Text style={styles.heroMetaText}>{activeSubs.length} {t('dashboard.active_subs', 'active subs')}</Text>
```

- [ ] **Step 3: Replace emoji in upcoming cards (line 219)**

Import CategoryIcon and replace line 219:
```tsx
// Before:
<Text style={styles.upcomingEmoji}>{cat?.emoji || '📦'}</Text>
// After:
<CategoryIcon category={sub.category} size={24} />
```

Remove the `upcomingEmoji` style.

Add import at top:
```tsx
import { CategoryIcon } from '../../src/components/icons';
```

- [ ] **Step 4: Replace emoji in active subs section (line 313)**

Change line 313 from:
```tsx
{cat?.emoji} {sub.currentPlan || cat?.label || sub.category}
```
to just:
```tsx
{sub.currentPlan || cat?.label || sub.category}
```

(CategoryBadge already shows the icon in the tags row below)

- [ ] **Step 5: Replace emoji in CategoryDonut legend (line 526, 538)**

In the `CategoryDonut` function, line 526 — remove `emoji` from the slice object:
```tsx
return { d, color, label: catInfo?.label || cat.category, pct: Math.round(fraction * 100), categoryId: catInfo?.id || 'OTHER' };
```

Line 538 — replace emoji text with CategoryIcon:
```tsx
// Before:
<Text style={{ fontSize: 13, color: colors.text, flex: 1 }} numberOfLines={1}>{slice.emoji} {slice.label}</Text>
// After:
<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
  <CategoryIcon category={slice.categoryId} size={14} />
  <Text style={{ fontSize: 13, color: colors.text, flex: 1 }} numberOfLines={1}>{slice.label}</Text>
</View>
```

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "fix: remove greeting/avatar, shorten sub count text, replace emoji with icons on dashboard"
```

---

## Task 7: Fix SubscriptionCard price overflow

**Files:**
- Modify: `src/components/SubscriptionCard.tsx`

- [ ] **Step 1: Fix price to stay on one line**

In `SubscriptionCard.tsx`, replace lines 77-81:

```tsx
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {subscription.currency} {Number(subscription.amount).toFixed(2)}
        </Text>
        <Text style={[styles.period, { color: colors.textSecondary }]} numberOfLines={1}>/{subscription.billingPeriod?.toLowerCase()?.replace('monthly', 'mo')?.replace('yearly', 'yr')?.replace('weekly', 'wk')?.replace('quarterly', 'qtr')}</Text>
```

- [ ] **Step 2: Replace trial emoji (line 89)**

Import `GiftIcon` and change line 89:

```tsx
// Before:
{trialExpired ? t('trials.expired') : trialDays === 0 ? t('trials.ends_today') : `🎁 ${trialDays}d`}
// After — replace emoji with icon inline:
```

Replace the entire trial badge Text (lines 86-90):
```tsx
            <Text style={[styles.trialBadgeText, {
              color: trialExpired ? '#EF4444' : trialUrgent ? '#F59E0B' : '#3B82F6',
            }]}>
              {trialExpired ? t('trials.expired') : trialDays === 0 ? t('trials.ends_today') : `${trialDays}d`}
            </Text>
```

And add a GiftIcon before the text in the trialBadge View:
```tsx
          <View style={[styles.trialBadge, {
            backgroundColor: trialExpired ? '#EF444420' : trialUrgent ? '#F59E0B20' : '#3B82F620',
          }]}>
            {!trialExpired && trialDays !== 0 && (
              <GiftIcon size={10} color={trialUrgent ? '#F59E0B' : '#3B82F6'} />
            )}
            <Text style={[styles.trialBadgeText, {
              color: trialExpired ? '#EF4444' : trialUrgent ? '#F59E0B' : '#3B82F6',
            }]}>
              {trialExpired ? t('trials.expired') : trialDays === 0 ? t('trials.ends_today') : `${trialDays}d`}
            </Text>
          </View>
```

Update trialBadge style to include `flexDirection: 'row', alignItems: 'center', gap: 3`.

- [ ] **Step 3: Commit**

```bash
git add src/components/SubscriptionCard.tsx
git commit -m "fix: price stays on one line, replace trial emoji with GiftIcon"
```

---

## Task 8: Update UpcomingPaymentCard

**Files:**
- Modify: `src/components/UpcomingPaymentCard.tsx`

- [ ] **Step 1: Replace emoji with CategoryIcon**

Replace line 22:
```tsx
// Before:
<Text style={styles.emoji}>{cat?.emoji || '📦'}</Text>
// After:
<CategoryIcon category={subscription.category} size={24} />
```

Add import:
```tsx
import { CategoryIcon } from './icons';
```

Remove `emoji` style from StyleSheet.

- [ ] **Step 2: Commit**

```bash
git add src/components/UpcomingPaymentCard.tsx
git commit -m "refactor: UpcomingPaymentCard uses CategoryIcon"
```

---

## Task 9: Update AddSubscriptionSheet

**Files:**
- Modify: `src/components/AddSubscriptionSheet.tsx`

- [ ] **Step 1: Replace POPULAR_SERVICES emoji with icon components**

Replace emoji strings in POPULAR_SERVICES array (lines 46-62) with React components. Change the type from `emoji: string` to `icon: React.FC<{size?: number}>`, then update the rendering.

Import icons:
```tsx
import {
  MovieIcon, MusicIcon, PlayIcon, InfrastructureIcon, FolderIcon,
  BriefcaseIcon, PaletteIcon, ChartBarIcon, AiServicesIcon,
  PenIcon, BrushIcon, OctopusIcon, WaveDropIcon, OtherIcon, SparklesIcon,
} from './icons';
```

Update POPULAR_SERVICES:
```tsx
const POPULAR_SERVICES = [
  { name: 'Netflix', icon: MovieIcon, category: 'STREAMING', ... },
  { name: 'Spotify', icon: MusicIcon, category: 'MUSIC', ... },
  // etc for all 15 services
];
```

Where the emoji was rendered as `<Text>{s.emoji}</Text>`, render `<s.icon size={20} />` instead.

- [ ] **Step 2: Replace FormSection emoji props**

Change FormSection `icon` prop from emoji string to a React element. For each usage:
- `icon="📌"` → `icon={<PinIcon size={16} color={colors.text} />}`
- `icon="💰"` → `icon={<MoneyIcon size={16} color={colors.text} />}`
- `icon="📋"` → `icon={<ClipboardIcon size={16} color={colors.text} />}`
- `icon="⏰"` → `icon={<AlarmIcon size={16} color={colors.text} />}`

Update FormSection component to accept `icon: React.ReactNode` instead of string.

- [ ] **Step 3: Replace trial section emoji (line ~594)**

Line 594 has `🎁` before trial period text. Replace with `<GiftIcon size={16} color={colors.text} />` inline before the text.

- [ ] **Step 4: Replace screenshot and sparkles emoji**

Line 654 `📸` → `<CameraIcon size={24} color={colors.textSecondary} />`
Line 686 `✨ {t('add.parse_screenshot')}` → render `<SparklesIcon size={16} color={colors.primary} />` before the text.

- [ ] **Step 5: Replace close button ✕ with Ionicons**

Replace `<Text style={styles.closeBtnText}>✕</Text>` with `<Ionicons name="close" size={22} color={colors.text} />`.

- [ ] **Step 6: Commit**

```bash
git add src/components/AddSubscriptionSheet.tsx
git commit -m "refactor: replace all emoji in AddSubscriptionSheet with SVG icons"
```

---

## Task 10: Update remaining components

**Files:**
- Modify: `src/components/EditSubscriptionSheet.tsx`
- Modify: `src/components/AIWizard.tsx`
- Modify: `src/components/VoiceRecorder.tsx`
- Modify: `src/utils/ErrorBoundary.tsx`

- [ ] **Step 1: EditSubscriptionSheet — close button + category emoji**

Replace `<Text style={styles.closeBtnText}>✕</Text>` (line 139) with:
```tsx
<Ionicons name="close" size={22} color={colors.text} />
```

Also replace `{cat.emoji} {cat.label}` (line ~222, category selector) with:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
  <CategoryIcon category={cat.id} size={14} />
  <Text>{cat.label}</Text>
</View>
```

Import: `import { CategoryIcon } from './icons';`

- [ ] **Step 2: AIWizard — emoji replacements**

Line 350: Replace `🔗` with `<ExternalLinkIcon size={14} color={colors.primary} />`
Line 356: Replace `✏️` with `<PencilIcon size={14} color={colors.primary} />`
Line 432: Replace `✓` with `<Ionicons name="checkmark" size={16} color="#FFF" />`

Import icons:
```tsx
import { ExternalLinkIcon, PencilIcon } from './icons';
```

- [ ] **Step 3: VoiceRecorder — mic/stop icons**

Replace line 107: `'⏹'` → `<Ionicons name="stop-circle" size={28} color={colors.error} />`
And `'🎙'` → `<Ionicons name="mic" size={28} color={colors.primary} />`

(If VoiceRecorder already uses SVG icons from AIWizard's MicSvg/StopSvg, skip this step and verify.)

- [ ] **Step 4: ErrorBoundary — warning icon**

Replace line 33 `<Text style={styles.emoji}>⚠️</Text>` with:
```tsx
<WarningIcon size={48} color="#F59E0B" />
```

Import: `import { WarningIcon } from '../components/icons';`

- [ ] **Step 5: Commit**

```bash
git add src/components/EditSubscriptionSheet.tsx src/components/AIWizard.tsx src/components/VoiceRecorder.tsx src/utils/ErrorBoundary.tsx
git commit -m "refactor: replace emoji in EditSheet, AIWizard, VoiceRecorder, ErrorBoundary"
```

---

## Task 11: Update screens (analytics, subscriptions, subscription detail, cards, paywall, settings)

**Files:**
- Modify: `app/(tabs)/analytics.tsx`
- Modify: `app/(tabs)/subscriptions.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/subscription/[id].tsx`
- Modify: `app/cards/index.tsx`
- Modify: `app/paywall.tsx`

- [ ] **Step 1: analytics.tsx — 4 emoji locations**

Import:
```tsx
import { CategoryIcon } from '../../src/components/icons';
```

Line 230 (`emoji: cat?.emoji`): Remove emoji from data mapping, add `categoryId: cat?.id || 'OTHER'`.
Line 350 (`{cat.emoji}`): Replace with `<CategoryIcon category={cat.id} size={14} />`.
Line 533 (`{catInfo?.emoji || '📦'}`): Replace with `<CategoryIcon category={catInfo?.id || 'OTHER'} size={16} />`.
Line 575 (CATEGORIES lookup for emoji): Replace emoji rendering with CategoryIcon.

- [ ] **Step 2: subscriptions.tsx — filter chips**

Line 218: Replace `{cat.emoji} {cat.label}` with CategoryIcon + label:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
  <CategoryIcon category={cat.id} size={13} />
  <Text style={{ fontSize: 13, color: selectedCategory === cat.id ? '#FFF' : colors.text }}>{cat.label}</Text>
</View>
```

Import: `import { CategoryIcon } from '../../src/components/icons';`

- [ ] **Step 3: subscription/[id].tsx — edit and delete buttons**

Line 114 (`✏️`): Replace with `<PencilIcon size={16} color={colors.primary} />`
Line 117 (`🗑`): Replace with `<TrashIcon size={16} color={colors.error} />`

Import: `import { PencilIcon, TrashIcon } from '../../src/components/icons';`

- [ ] **Step 4: cards/index.tsx — empty state**

Line 76 (`💳`): Replace with `<CreditCardIcon size={48} color={colors.textMuted} />`

Import: `import { CreditCardIcon } from '../../src/components/icons';`

- [ ] **Step 5: paywall.tsx — checkmark**

Line 143 (`` `${t('subscription_plan.active')} ✓` ``): This is inside a template literal. Refactor to JSX:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
  <Text>{t('subscription_plan.active')}</Text>
  <Ionicons name="checkmark" size={14} color={colors.success} />
</View>
```

- [ ] **Step 6: settings.tsx — emoji in pro badge**

Replace 3 emoji occurrences:
- `⏳ ${t('settings.pro_trial')}` → render `<HourglassIcon>` + text
- `✨ ${t('settings.subradar_pro')}` (2 occurrences) → render `<SparklesIcon>` + text

Import: `import { HourglassIcon, SparklesIcon } from '../../src/components/icons';`

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/analytics.tsx app/(tabs)/subscriptions.tsx app/(tabs)/settings.tsx app/subscription/\[id\].tsx app/cards/index.tsx app/paywall.tsx
git commit -m "refactor: replace emoji with icons across all screens"
```

---

## Task 12: Clean emoji from locale files

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/ru.json`
- Modify: `src/locales/es.json`
- Modify: `src/locales/de.json`
- Modify: `src/locales/fr.json`
- Modify: `src/locales/pt.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: Remove emoji prefix from 6 keys in all 9 locale files**

For each locale file, remove emoji prefix from these keys:
- `trial_until`: remove `🎁 ` prefix
- `open_website`: remove `🌐 ` prefix
- `cancel_page`: remove `🔗 ` prefix
- `cancel_subscription`: remove `✕ ` prefix
- `generate`: remove `📥 ` prefix
- `generating`: remove `⏳ ` prefix

Example for en.json:
```json
"trial_until": "Trial until",
"open_website": "Open website",
"cancel_page": "Cancel page",
"cancel_subscription": "Cancel subscription",
"generate": "Generate PDF Report",
"generating": "Generating...",
```

Also add new `dashboard.active_subs` key in all 9 locales (inside the `dashboard` object):
- en: `"active_subs": "active subs"`
- ru: `"active_subs": "актив. подп."`
- es: `"active_subs": "subs activas"`
- de: `"active_subs": "aktive Abos"`
- fr: `"active_subs": "abos actifs"`
- pt: `"active_subs": "assin. ativas"`
- zh: `"active_subs": "活跃订阅"`
- ja: `"active_subs": "有効"`
- ko: `"active_subs": "활성 구독"`

- [ ] **Step 2: Commit**

```bash
git add src/locales/
git commit -m "i18n: remove emoji from translation strings, add active_subs key"
```

---

## Task 13: Remove emoji field from CATEGORIES constant

**Files:**
- Modify: `src/constants/index.ts`

- [ ] **Step 1: Remove emoji from CATEGORIES**

Only after all consumers have been updated. Change:
```tsx
export const CATEGORIES = [
  { id: 'STREAMING', label: 'Streaming', color: '#E53935' },
  { id: 'AI_SERVICES', label: 'AI Services', color: '#8E24AA' },
  { id: 'INFRASTRUCTURE', label: 'Infrastructure', color: '#039BE5' },
  { id: 'MUSIC', label: 'Music', color: '#8E24AA' },
  { id: 'GAMING', label: 'Gaming', color: '#43A047' },
  { id: 'PRODUCTIVITY', label: 'Productivity', color: '#1E88E5' },
  { id: 'HEALTH', label: 'Health', color: '#FB8C00' },
  { id: 'NEWS', label: 'News', color: '#00ACC1' },
  { id: 'OTHER', label: 'Other', color: '#757575' },
];
```

- [ ] **Step 2: Search for remaining emoji references**

Run: `grep -r "\.emoji" src/ app/ --include="*.tsx" --include="*.ts"`

Expected: No matches to `.emoji` on CATEGORIES objects. If any remain, fix them.

- [ ] **Step 3: Commit**

```bash
git add src/constants/index.ts
git commit -m "cleanup: remove emoji field from CATEGORIES constant"
```

---

## Task 14: Verify build and test

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 3: Start Expo and verify visually**

Run: `npx expo start`
Check:
- Dashboard: no greeting, hero card starts at top, subs count shortened
- Subscription cards: price on one line, category icons render
- All screens: no unicode emoji except language flags and push notifications
- Dark and light themes work

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any remaining issues from icon migration"
```
