# Subscription Form Improvements — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Scope:** Add subscription form UX, new fields, voice/screenshot fix

## Summary

Improve the add-subscription flow: 4 new fields (startDate, reminderDaysBefore, color, tags), UX improvements (textarea, spacing, error feedback), fix voice/screenshot input parsing, backend schema update.

## Out of scope
- Analytics/charts redesign (subproject B)
- Report export fixes (subproject C)
- API docs update for non-subscription endpoints

---

## 1. New Form Fields

### 1.1 Start Date (`startDate`)
- **Type:** Date | null
- **UI:** DatePicker in "Payment" section, after billing period chips
- **Default:** today's date
- **Purpose:** calculate total lifetime spend

### 1.2 Reminder (`reminderDaysBefore`)
- **Type:** number | null
- **UI:** Chips in "Extra" section: `Off` | `1d` | `3d` | `7d`
- **Default:** `3` (3 days before)
- **Behavior:** on subscription save, schedule local notification via `localNotifications.ts`
- **On update:** cancel old notification, schedule new one

### 1.3 Card Color (`color`)
- **Type:** string | null (hex color)
- **UI:** Horizontal row of 8-10 color circles in "Extra" section
- **Palette:** `#7C5CFF` (purple/auto), `#3B82F6` (blue), `#10B981` (green), `#EF4444` (red), `#F59E0B` (orange), `#EC4899` (pink), `#06B6D4` (cyan), `#6B7280` (gray)
- **Default:** null (auto = category color)
- **Usage:** SubscriptionCard border/accent color, donut chart override

### 1.4 Tags (`tags`)
- **Type:** string[] | null
- **UI:** TextInput in "Extra" section. Type tag + comma/enter → appears as chip with X button
- **Storage:** JSON array column in DB
- **Usage:** filterable on subscriptions list (future)

---

## 2. Form UX Improvements

### 2.1 Notes field → multiline TextArea
- `multiline={true}`, `numberOfLines={3}`, `minHeight: 80`
- `textAlignVertical: 'top'`

### 2.2 URL fields — better input
- `autoCapitalize="none"`, `keyboardType="url"`, `autoCorrect={false}`
- Left icon: GlobeIcon for serviceUrl, ExternalLinkIcon for cancelUrl
- Placeholder: `"https://example.com"`

### 2.3 Section spacing
- Gap between FormSections: 16px (currently 0)
- Gap between fields within section: 12px

### 2.4 AI parse error feedback
- Replace `catch {}` with `catch (e) { Alert.alert(t('common.error'), t('add.parse_failed')) }`
- Applies to: voice handler, screenshot handler, text handler in AddSubscriptionSheet

---

## 3. Voice Input Fix

### 3.1 Problem
Backend `POST /ai/parse-audio` returns flat object:
```json
{ "text": "Netflix 15.99 monthly", "name": "Netflix", "amount": 15.99, "currency": "USD", "billingPeriod": "MONTHLY", "category": "STREAMING" }
```

Mobile expects `data.subscriptions` array — doesn't find it, so ignores parsed subscription data.

### 3.2 Fix in AddSubscriptionSheet `handleVoiceDone`
```typescript
// Current: looks for data.subscriptions array
// Fix: if data.name && data.amount → treat as single subscription
const subs = Array.isArray(data.subscriptions)
  ? data.subscriptions
  : data.subscriptions
    ? [data.subscriptions]
    : (data.name && data.amount) ? [data] : [];
```

### 3.3 Fix in AIWizard voice handling
After transcription, if response contains `name` + `amount`:
- Auto-call `onDone(subscription)` with the parsed data
- Skip the text-input step

### 3.4 Show transcription to user
After voice input, show recognized text in a small banner/toast above the input field so user sees what was recognized.

---

## 4. Screenshot Input Fix

### 4.1 Problem
Same as voice — backend returns flat object, mobile looks for `data.subscriptions` or array.

### 4.2 Fix in AddSubscriptionSheet screenshot handler
```typescript
// Current:
const subs = Array.isArray(data) ? data : (data.subscriptions ?? [data]);
// This already handles flat object via [data] fallback
// But data.subscriptions is undefined, so it falls to [data] — this SHOULD work
// Verify: is the issue that data wraps in { data: {...} } from axios?
// Axios: res.data → the actual response body
// So: data = res.data → should be the flat object
// Double-check: aiApi.parseScreenshot returns res directly or res.data?
```

Need to verify the actual axios response shape. The fix may be in how `aiApi.parseScreenshot` returns data.

---

## 5. Backend Changes

### 5.1 Subscription Entity — 4 new columns
**File:** `src/subscriptions/entities/subscription.entity.ts`

```typescript
@Column({ type: 'date', nullable: true })
startDate: Date | null;

@Column({ type: 'int', nullable: true })
reminderDaysBefore: number | null;

@Column({ type: 'varchar', length: 7, nullable: true })
color: string | null;

@Column({ type: 'simple-json', nullable: true })
tags: string[] | null;
```

### 5.2 CreateSubscriptionDTO — add optional fields
```typescript
@IsOptional() @IsDateString()
startDate?: string;

@IsOptional() @IsInt() @Min(0) @Max(30)
reminderDaysBefore?: number;

@IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/)
color?: string;

@IsOptional() @IsArray() @IsString({ each: true })
tags?: string[];
```

### 5.3 UpdateSubscriptionDTO — same fields

### 5.4 Migration
```sql
ALTER TABLE subscriptions ADD COLUMN "startDate" date;
ALTER TABLE subscriptions ADD COLUMN "reminderDaysBefore" int;
ALTER TABLE subscriptions ADD COLUMN color varchar(7);
ALTER TABLE subscriptions ADD COLUMN tags text; -- simple-json stores as text
```

---

## 6. Mobile Type Updates

### 6.1 `src/types/index.ts` — Subscription interface
Add fields:
```typescript
startDate?: string;
reminderDaysBefore?: number | null;
color?: string | null;
tags?: string[] | null;
```

---

## 7. i18n Keys to Add (all 9 locales)

```
add.start_date: "Start date"
add.reminder: "Reminder"
add.reminder_off: "Off"
add.reminder_1d: "1 day"
add.reminder_3d: "3 days"
add.reminder_7d: "7 days"
add.card_color: "Card color"
add.color_auto: "Auto"
add.tags: "Tags"
add.tags_placeholder: "Type and press comma..."
add.parse_failed: "Could not parse. Try again."
```

---

## 8. Files to modify

### Mobile
- `src/components/AddSubscriptionSheet.tsx` — new fields, UX fixes, voice/screenshot fix
- `src/components/AIWizard.tsx` — voice transcription handling
- `src/types/index.ts` — Subscription interface
- `src/utils/localNotifications.ts` — schedule with reminderDaysBefore
- `src/locales/*.json` (9 files) — new i18n keys

### Backend
- `src/subscriptions/entities/subscription.entity.ts` — 4 new columns
- `src/subscriptions/dto/create-subscription.dto.ts` — 4 new optional fields
- `src/subscriptions/dto/update-subscription.dto.ts` — 4 new optional fields
- Migration file — ALTER TABLE

### Docs
- `docs/API_CONTRACTS.md` — new fields + fix endpoint names
