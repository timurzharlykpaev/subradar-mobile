# Subscription Form Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new fields to subscription form (startDate, reminder, color, tags), fix voice/screenshot parsing, improve form UX.

**Architecture:** Backend already has `startDate`, `reminderDaysBefore`, `reminderEnabled`, `notes` in entity+DTO. Only `color` and `tags` need backend migration. Mobile needs new form fields in AddSubscriptionSheet, voice/screenshot response parsing fix, and error feedback.

**Tech Stack:** NestJS + TypeORM (backend), React Native + Expo (mobile), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-subscription-form-improvements-design.md`

---

## Task 1: Backend — add `color` and `tags` columns

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/subscriptions/entities/subscription.entity.ts`
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/subscriptions/dto/create-subscription.dto.ts`
- Create: `/Users/timurzharlykpaev/Desktop/repositories/subradar-backend/src/migrations/<timestamp>-AddColorAndTags.ts`

- [ ] **Step 1: Add columns to entity**

In `subscription.entity.ts`, before the `createdAt` field, add:

```typescript
@Column({ type: 'varchar', length: 7, nullable: true })
color: string | null;

@Column({ type: 'simple-json', nullable: true })
tags: string[] | null;
```

- [ ] **Step 2: Add fields to CreateSubscriptionDto**

In `create-subscription.dto.ts`, before the closing `}`, add:

```typescript
@ApiPropertyOptional() @IsOptional() @IsString() color?: string;
@ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
```

Add `Matches` to imports from class-validator (for future color validation if needed).

- [ ] **Step 3: Generate migration**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npx typeorm migration:generate src/migrations/AddColorAndTags -d src/data-source.ts
```

If auto-generation fails, create manually:

```typescript
// src/migrations/<timestamp>-AddColorAndTags.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColorAndTags<timestamp> implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN "color" varchar(7)`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN "tags" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "tags"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "color"`);
  }
}
```

- [ ] **Step 4: Run migration**

```bash
npm run migration:run
```

- [ ] **Step 5: Commit**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
git add -A
git commit -m "feat: add color and tags columns to subscription entity"
```

---

## Task 2: Mobile — update types and form state

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/types/index.ts`
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/components/AddSubscriptionSheet.tsx` (emptyForm only)

- [ ] **Step 1: Add fields to Subscription interface**

In `src/types/index.ts`, find the `Subscription` interface and add:

```typescript
startDate?: string;
reminderDaysBefore?: number[] | null;
reminderEnabled?: boolean;
color?: string | null;
tags?: string[] | null;
```

- [ ] **Step 2: Update emptyForm in AddSubscriptionSheet**

In `AddSubscriptionSheet.tsx`, update `emptyForm` (line ~71):

```typescript
const emptyForm = {
  name: '',
  category: 'STREAMING',
  amount: '',
  currency: 'USD',
  billingPeriod: 'MONTHLY' as const,
  billingDay: '1',
  paymentCardId: '',
  currentPlan: '',
  serviceUrl: '',
  cancelUrl: '',
  notes: '',
  iconUrl: '',
  isTrial: false,
  trialEndDate: '',
  // New fields:
  startDate: new Date().toISOString().split('T')[0],
  reminderDaysBefore: [3] as number[],
  color: '' as string,
  tags: [] as string[],
};
```

- [ ] **Step 3: Update save handler to send new fields**

In the save handler (line ~193), add new fields to the `subscriptionsApi.create()` call:

```typescript
startDate: form.startDate || undefined,
reminderDaysBefore: form.reminderDaysBefore.length > 0 ? form.reminderDaysBefore : undefined,
reminderEnabled: form.reminderDaysBefore.length > 0 ? true : undefined,
color: form.color || undefined,
tags: form.tags.length > 0 ? form.tags : undefined,
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/components/AddSubscriptionSheet.tsx
git commit -m "feat: add startDate, reminder, color, tags to form state and types"
```

---

## Task 3: Mobile — add new form UI fields

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/components/AddSubscriptionSheet.tsx`

- [ ] **Step 1: Add startDate picker in Payment section**

After the billing period chips (line ~516), before the cards section, add:

```tsx
<Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
  {t('add.start_date')}
</Text>
<TextInput
  style={inputStyle}
  value={form.startDate}
  onChangeText={(v) => setF('startDate', v)}
  placeholder="YYYY-MM-DD"
  placeholderTextColor={colors.textMuted}
  keyboardType="numbers-and-punctuation"
/>
```

- [ ] **Step 2: Add reminder chips in Extra section**

After the notes TextInput (line ~601), before the closing `</FormSection>`, add:

```tsx
<Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
  {t('add.reminder')}
</Text>
<View style={{ flexDirection: 'row', gap: 6 }}>
  {[
    { label: t('add.reminder_off'), value: [] },
    { label: t('add.reminder_1d', '1d'), value: [1] },
    { label: t('add.reminder_3d', '3d'), value: [3] },
    { label: t('add.reminder_7d', '7d'), value: [7] },
  ].map((opt) => {
    const isSelected = JSON.stringify(form.reminderDaysBefore) === JSON.stringify(opt.value);
    return (
      <TouchableOpacity
        key={opt.label}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          backgroundColor: isSelected ? colors.primary : colors.background,
          borderWidth: 1,
          borderColor: isSelected ? colors.primary : colors.border,
        }}
        onPress={() => setF('reminderDaysBefore', opt.value)}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#FFF' : colors.text }}>
          {opt.label}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>
```

- [ ] **Step 3: Add color picker in Extra section**

After reminder chips, add:

```tsx
<Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
  {t('add.card_color')}
</Text>
<View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
  {[
    { label: t('add.color_auto'), value: '', hex: colors.primary },
    { value: '#3B82F6', hex: '#3B82F6' },
    { value: '#10B981', hex: '#10B981' },
    { value: '#EF4444', hex: '#EF4444' },
    { value: '#F59E0B', hex: '#F59E0B' },
    { value: '#EC4899', hex: '#EC4899' },
    { value: '#06B6D4', hex: '#06B6D4' },
    { value: '#6B7280', hex: '#6B7280' },
  ].map((c) => (
    <TouchableOpacity
      key={c.value || 'auto'}
      onPress={() => setF('color', c.value)}
      style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: c.hex,
        borderWidth: 2.5,
        borderColor: form.color === c.value ? colors.text : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {c.label && (
        <Text style={{ fontSize: 8, fontWeight: '800', color: '#FFF' }}>{c.label}</Text>
      )}
    </TouchableOpacity>
  ))}
</View>
```

- [ ] **Step 4: Add tags input in Extra section**

After color picker, add:

```tsx
<Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
  {t('add.tags')}
</Text>
{form.tags.length > 0 && (
  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
    {form.tags.map((tag, idx) => (
      <View key={idx} style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
      }}>
        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>{tag}</Text>
        <TouchableOpacity onPress={() => setF('tags', form.tags.filter((_, i) => i !== idx))}>
          <Ionicons name="close" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
    ))}
  </View>
)}
<TextInput
  style={inputStyle}
  placeholder={t('add.tags_placeholder', 'Type and press comma...')}
  placeholderTextColor={colors.textMuted}
  onChangeText={(v) => {
    if (v.includes(',')) {
      const tag = v.replace(',', '').trim();
      if (tag && !form.tags.includes(tag)) {
        setF('tags', [...form.tags, tag]);
      }
    }
  }}
  onSubmitEditing={(e) => {
    const tag = e.nativeEvent.text.trim();
    if (tag && !form.tags.includes(tag)) {
      setF('tags', [...form.tags, tag]);
    }
  }}
  returnKeyType="done"
/>
```

- [ ] **Step 5: Add spacing between FormSections**

In the FormSection component (line ~88), add `marginTop: 16` to the outer View style:

```tsx
<View style={{
  backgroundColor: colors.surface2,
  borderRadius: 16,
  padding: 16,
  marginTop: 16,  // ← add this
  ...
}}>
```

- [ ] **Step 6: Improve URL fields**

For `serviceUrl` TextInput (line ~580), add:

```tsx
keyboardType="url"
autoCorrect={false}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/AddSubscriptionSheet.tsx
git commit -m "feat: add startDate, reminder, color, tags UI fields to subscription form"
```

---

## Task 4: Fix voice input parsing

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/components/AddSubscriptionSheet.tsx`

- [ ] **Step 1: Fix handleVoiceDone response mapping**

Replace the `handleVoiceDone` function (lines ~302-319) with:

```typescript
const handleVoiceDone = async (uri: string) => {
  if (!uri) return;
  setAiLoading(true);
  try {
    const formData = new FormData();
    formData.append('file', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
    const res = await aiApi.parseAudio(formData);
    const data = res.data;
    // Show transcription to user
    if (data.text) setAiText(data.text);
    // Backend returns flat object { text, name, amount, ... } — not subscriptions array
    const subs = Array.isArray(data.subscriptions)
      ? data.subscriptions
      : data.subscriptions
        ? [data.subscriptions]
        : (data.name && data.amount) ? [data] : [];
    if (subs.length > 0) applyParsedSubscriptions(subs);
  } catch {
    Alert.alert(t('common.error'), t('add.parse_failed', 'Could not parse. Try again.'));
  } finally {
    setAiLoading(false);
  }
};
```

Key change: added `(data.name && data.amount) ? [data] : []` fallback for flat object response.

- [ ] **Step 2: Fix handleRecognize error handling**

Replace the catch block in `handleRecognize` (line ~294):

```typescript
} catch {
  Alert.alert(t('common.error'), t('add.parse_failed', 'Could not parse. Try again.'));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AddSubscriptionSheet.tsx
git commit -m "fix: voice input now handles flat object response from backend"
```

---

## Task 5: Mobile — update localNotifications to use reminderDaysBefore

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/utils/localNotifications.ts`

- [ ] **Step 1: Update notification scheduling to use subscription's reminderDaysBefore**

The current code uses hardcoded `[1, 3]` days before. Update to read from `sub.reminderDaysBefore` if available:

Find the line that defines reminder days (currently something like `const daysBefore = [1, 3]`) and replace with:

```typescript
const daysBefore = (sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0)
  ? sub.reminderDaysBefore
  : [1, 3]; // default fallback
```

Also check `sub.reminderEnabled !== false` before scheduling.

- [ ] **Step 2: Commit**

```bash
git add src/utils/localNotifications.ts
git commit -m "feat: use subscription reminderDaysBefore for notification scheduling"
```

---

## Task 6: i18n — add new keys

**Files:**
- Modify: `src/locales/{en,ru,es,de,fr,pt,zh,ja,ko}.json` (9 files)

- [ ] **Step 1: Add keys to all 9 locale files**

Inside the `add` object in each locale file, add:

**en.json:**
```json
"start_date": "Start date",
"reminder": "Reminder",
"reminder_off": "Off",
"reminder_1d": "1 day",
"reminder_3d": "3 days",
"reminder_7d": "7 days",
"card_color": "Card color",
"color_auto": "Auto",
"tags": "Tags",
"tags_placeholder": "Type and press comma...",
"parse_failed": "Could not parse. Try again."
```

**ru.json:**
```json
"start_date": "Дата начала",
"reminder": "Напоминание",
"reminder_off": "Выкл",
"reminder_1d": "1 день",
"reminder_3d": "3 дня",
"reminder_7d": "7 дней",
"card_color": "Цвет карточки",
"color_auto": "Авто",
"tags": "Теги",
"tags_placeholder": "Введите и нажмите запятую...",
"parse_failed": "Не удалось распознать. Попробуйте ещё раз."
```

**es.json:**
```json
"start_date": "Fecha de inicio",
"reminder": "Recordatorio",
"reminder_off": "No",
"reminder_1d": "1 dia",
"reminder_3d": "3 dias",
"reminder_7d": "7 dias",
"card_color": "Color de tarjeta",
"color_auto": "Auto",
"tags": "Etiquetas",
"tags_placeholder": "Escribe y presiona coma...",
"parse_failed": "No se pudo analizar. Intenta de nuevo."
```

For de, fr, pt, zh, ja, ko — translate similarly.

- [ ] **Step 2: Commit**

```bash
git add src/locales/
git commit -m "i18n: add start_date, reminder, color, tags keys for 9 locales"
```

---

## Task 7: Update API docs

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/docs/API_CONTRACTS.md`

- [ ] **Step 1: Fix endpoint names**

Replace:
- `/ai/parse-text-subscription` → `/ai/parse-text`
- `/ai/parse-subscription-image` → `/ai/parse-screenshot`

- [ ] **Step 2: Add new fields to POST/PUT /subscriptions**

Add `color`, `tags` to the request body docs. Note that `startDate`, `reminderDaysBefore`, `reminderEnabled` already exist in backend DTO.

- [ ] **Step 3: Commit**

```bash
git add docs/API_CONTRACTS.md
git commit -m "docs: fix AI endpoint names, add color/tags to subscription API"
```

---

## Task 8: Verify build

- [ ] **Step 1: TypeScript check (mobile)**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
npx tsc --noEmit
```

- [ ] **Step 2: TypeScript check (backend)**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npx tsc --noEmit
```

- [ ] **Step 3: Run backend tests**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-backend
npm test
```

- [ ] **Step 4: Run mobile tests**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
npm test
```
