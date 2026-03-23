# Improve Add Subscription UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make adding subscriptions faster and more intuitive — AI saves directly, simplified manual form, tap-to-record voice, success animation.

**Architecture:** 4 independent changes in the mobile app: (A) AIWizard's "Add" button calls subscriptionsApi.create directly instead of filling Manual tab; (B) Manual form collapses optional fields into expandable "More" section; (C) VoiceRecorder switches from hold-to-record to tap-to-toggle; (D) New SuccessOverlay component shown after saving.

**Tech Stack:** React Native (Expo), expo-audio, react-native Animated API, Zustand, axios, react-i18next

---

### File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| **Modify** | `src/components/AIWizard.tsx:430-451` | AI "Add" button saves directly via API |
| **Modify** | `src/components/AddSubscriptionSheet.tsx:393-408` | Pass addSubscription + handleClose to AIWizard |
| **Modify** | `src/components/AddSubscriptionSheet.tsx:412-850` | Collapse optional fields in Manual form |
| **Modify** | `src/components/VoiceRecorder.tsx` | Tap-to-toggle recording |
| **Create** | `src/components/SuccessOverlay.tsx` | Green checkmark animation overlay |
| **Modify** | `src/components/AddSubscriptionSheet.tsx` | Show SuccessOverlay after save |
| **Modify** | `src/i18n/locales/*.json` | New i18n keys |

---

### Task 1: AI saves directly (no Manual tab redirect)

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/components/AIWizard.tsx`
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/components/AddSubscriptionSheet.tsx`

Currently when user confirms in AIWizard, `onDone(sub)` fills the Manual form and switches to tab 1. Instead, the "Add" button should save directly.

- [ ] **Step 1: Change AIWizard props to accept onSave callback**

In `AIWizard.tsx`, update the Props interface and the confirm button. The component currently accepts `onDone: (sub: ParsedSub) => void`. Change to also accept `onSave` and `onEdit`:

Replace the Props/export interface (find `interface` near top of file that defines `onDone`):

```typescript
interface Props {
  onSave: (sub: ParsedSub) => Promise<void>;  // save directly
  onEdit: (sub: ParsedSub) => void;            // switch to manual for editing
}
```

- [ ] **Step 2: Update the confirm footer buttons**

Replace lines 430-451 (footer section) with two buttons — "Add" (primary) and "Edit" (secondary):

```typescript
{/* ── Footer button ─────────────────────────────────────────────────── */}
<View style={styles.footer}>
  {ui.kind === 'confirm' ? (
    <View style={{ gap: 8 }}>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: '#10B981' }, saving && { opacity: 0.6 }]}
        onPress={async () => {
          setSaving(true);
          try {
            await onSave(ui.subscription);
          } finally {
            setSaving(false);
          }
        }}
        disabled={saving}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="checkmark" size={16} color="#FFF" />
          )}
          <Text style={styles.actionTxt}>{t('add.ai_add', 'Добавить')}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ alignItems: 'center', paddingVertical: 10 }}
        onPress={() => onEdit(ui.subscription)}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
          {t('add.edit_details', 'Редактировать детали')}
        </Text>
      </TouchableOpacity>
    </View>
  ) : (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: colors.primary }, (!input.trim() || loading) && { opacity: 0.4 }]}
      onPress={() => callWizard(input)}
      disabled={!input.trim() || loading}
    >
      <Text style={styles.actionTxt}>{t('add.ai_next', 'Далее →')}</Text>
    </TouchableOpacity>
  )}
</View>
```

Add `saving` state and `ActivityIndicator` import at top of component:
```typescript
const [saving, setSaving] = useState(false);
```

Make sure `ActivityIndicator` is imported from react-native.

- [ ] **Step 3: Update AddSubscriptionSheet to pass onSave/onEdit**

In `AddSubscriptionSheet.tsx`, replace lines 393-408 (the AIWizard usage):

```typescript
{tab === 0 && (
  <View style={{ flex: 1, paddingHorizontal: 4, paddingBottom: 16 }}>
    <AIWizard
      onSave={async (sub) => {
        const iconUrl = sub.iconUrl || (sub.serviceUrl
          ? `https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(sub.serviceUrl).hostname; } catch { return ''; } })()}&sz=64`
          : sub.name
            ? `https://www.google.com/s2/favicons?domain=${sub.name.toLowerCase().replace(/\s+/g, '').replace(/\+/g, 'plus')}.com&sz=64`
            : undefined);

        const res = await subscriptionsApi.create({
          name: sub.name || 'Subscription',
          category: (sub.category || 'OTHER').toUpperCase(),
          amount: sub.amount || 0,
          currency: sub.currency || currency || 'USD',
          billingPeriod: sub.billingPeriod || 'MONTHLY',
          billingDay: 1,
          status: 'ACTIVE',
          serviceUrl: sub.serviceUrl || undefined,
          cancelUrl: sub.cancelUrl || undefined,
          iconUrl: iconUrl || undefined,
          startDate: new Date().toISOString().split('T')[0],
        });
        addSubscription(res.data);
        setShowSuccess(true);
      }}
      onEdit={(sub) => {
        setForm((f) => ({
          ...f,
          name: sub.name ?? f.name,
          amount: sub.amount != null ? String(sub.amount) : f.amount,
          currency: sub.currency ?? f.currency,
          billingPeriod: (sub.billingPeriod ?? f.billingPeriod) as typeof f.billingPeriod,
          category: sub.category?.toLowerCase() ?? f.category,
          serviceUrl: sub.serviceUrl ?? f.serviceUrl,
          cancelUrl: sub.cancelUrl ?? f.cancelUrl,
          iconUrl: sub.iconUrl ?? f.iconUrl,
        }));
        setTab(1);
      }}
    />
  </View>
)}
```

Add state for success overlay (near other useState calls):
```typescript
const [showSuccess, setShowSuccess] = useState(false);
```

- [ ] **Step 4: Update AIWizard export type**

Remove old `onDone` from the exported interface. Make sure the component no longer references `onDone`.

Also remove the "Edit" link inside the confirm card (the `editLink` touchable around line 479 area) — that's now handled by the footer "Edit details" button.

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/AIWizard.tsx src/components/AddSubscriptionSheet.tsx
git commit -m "feat: AI wizard saves subscription directly, skip manual form"
```

---

### Task 2: Progressive disclosure in Manual form

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/components/AddSubscriptionSheet.tsx`

Currently all 4 sections (Main, Payment, Additional, Trial) are visible. Change to: show only essential fields (Name, Amount, Currency, Period), with an expandable "More" section for everything else.

- [ ] **Step 1: Add expanded state**

Near the other useState declarations in AddSubscriptionSheet:
```typescript
const [moreExpanded, setMoreExpanded] = useState(false);
```

- [ ] **Step 2: Restructure the Manual tab content**

Replace the Manual tab content (tab === 1 block). Keep the essential fields at top level (no FormSection wrapper for cleaner look), and wrap optional fields in a collapsible section:

The structure should be:
```
Name input
Amount + Currency (side by side)
Billing Period chips
[Start Date input]
────────────────────
▼ Ещё (More) — tap to expand
  Category chips
  Plan name
  Service URL
  Payment card
  Notes
  Reminder
  Color
  Tags
  Trial toggle + date
────────────────────
[Добавить подписку] button
```

Key changes:
- Name, Amount, Currency, Period — always visible, no section header
- Amount + Currency in a row (`flexDirection: 'row'`)
- "More" button: `TouchableOpacity` with chevron icon that toggles `moreExpanded`
- All optional fields wrapped in `{moreExpanded && (...)}`
- Remove the 4 separate FormSection wrappers for simpler layout

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AddSubscriptionSheet.tsx
git commit -m "feat: progressive disclosure in manual form — collapse optional fields"
```

---

### Task 3: Tap-to-record voice (instead of hold)

**Files:**
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/components/VoiceRecorder.tsx`

Change from `onPressIn`/`onPressOut` (hold) to `onPress` toggle (tap to start, tap to stop). Like Telegram voice messages.

- [ ] **Step 1: Replace hold-to-record with tap-to-toggle**

Replace the entire VoiceRecorder component:

```typescript
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import { COLORS } from '../constants';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  onRecordingComplete: (uri: string) => void;
  customButton?: React.ReactNode;
}

export const VoiceRecorder: React.FC<Props> = ({ onRecordingComplete, customButton }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    scaleAnim.stopAnimation();
    scaleAnim.setValue(1);

    await recorder.stop();
    setIsRecording(false);

    if (recorder.uri) {
      onRecordingComplete(recorder.uri);
    }
  }, [isRecording, recorder, scaleAnim, onRecordingComplete]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState !== 'active' && isRecording) {
        stopRecording();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isRecording, stopRecording]);

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('Recording error', msg);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View testID="voice-recorder" style={styles.container}>
      <Pressable testID="btn-record" onPress={toggleRecording}>
        {customButton ? (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            {customButton}
          </Animated.View>
        ) : (
          <Animated.View
            style={[styles.button, isRecording && styles.recording, { transform: [{ scale: scaleAnim }] }]}
          >
            {isRecording
              ? <Ionicons name="stop" size={28} color={colors.error} />
              : <Ionicons name="mic" size={28} color={colors.primary} />
            }
          </Animated.View>
        )}
      </Pressable>
      {!customButton && (
        <Text style={[styles.label, isRecording && { color: colors.error }]}>
          {isRecording ? formatDuration(duration) : t('voice.tap_to_record')}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recording: { backgroundColor: '#FFE0E0' },
  label: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
});
```

Key changes:
- `onPressIn`/`onPressOut` → single `onPress` that calls `toggleRecording()`
- "stop-circle" icon → "stop" icon (cleaner)
- Label: `voice.tap_to_record` instead of `voice.hold_to_record`
- Duration text turns red while recording
- Pulse animation slightly slower (600ms vs 500ms)

- [ ] **Step 2: Update i18n key**

In all locale files, add/update:
- en: `"tap_to_record": "Tap to record"`
- ru: `"tap_to_record": "Нажмите для записи"`

Keep `hold_to_record` for backward compat but it's no longer used.

- [ ] **Step 3: Also update AIWizard mic hint text**

In AIWizard.tsx, find the mic hint text (around line 370-375) that says "Hold and speak" or similar. Change to match tap-to-record:
- Find: `t('ai.hold_speak')` or `t('voice.hold_to_record')`
- Replace with: `t('voice.tap_to_record')`

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/VoiceRecorder.tsx src/components/AIWizard.tsx src/i18n/
git commit -m "feat: tap-to-record voice instead of hold-to-record"
```

---

### Task 4: Success animation after adding subscription

**Files:**
- Create: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/components/SuccessOverlay.tsx`
- Modify: `/Users/timurzharlykpaev/Desktop/repositories/subradar-mobile/src/components/AddSubscriptionSheet.tsx`

Show a brief green checkmark animation when subscription is saved, then close the sheet.

- [ ] **Step 1: Create SuccessOverlay component**

```typescript
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onFinish: () => void;
  name?: string;
}

export function SuccessOverlay({ visible, onFinish, name }: Props) {
  const { t } = useTranslation();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 12,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1200),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      scaleAnim.setValue(0);
      onFinish();
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
      <Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name="checkmark" size={48} color="#FFF" />
      </Animated.View>
      <Animated.View style={{ opacity: opacityAnim, transform: [{ scale: scaleAnim }] }}>
        <Text style={styles.title}>{t('add.success_added')}</Text>
        {name && <Text style={styles.name}>{name}</Text>}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    borderRadius: 24,
  },
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  name: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
});
```

- [ ] **Step 2: Integrate SuccessOverlay into AddSubscriptionSheet**

Import at top:
```typescript
import { SuccessOverlay } from './SuccessOverlay';
```

Add `showSuccess` state and `successName` state (if not already added from Task 1):
```typescript
const [showSuccess, setShowSuccess] = useState(false);
const [successName, setSuccessName] = useState('');
```

Inside the sheet's animated container (the main `Animated.View` that holds the content), add at the bottom before the closing tag:

```typescript
<SuccessOverlay
  visible={showSuccess}
  name={successName}
  onFinish={() => {
    setShowSuccess(false);
    setSuccessName('');
    setForm(emptyForm);
    setFoundService(null);
    setAiQuery('');
    setTab(0);
    handleClose();
  }}
/>
```

- [ ] **Step 3: Trigger success in handleSave (Manual tab)**

In `handleSave`, after `addSubscription(res.data)`, replace the cleanup + handleClose with:

```typescript
addSubscription(res.data);
setSuccessName(form.name);
setShowSuccess(true);
```

Remove the old cleanup lines (setForm, setFoundService, setAiQuery, handleClose) — they're now in SuccessOverlay's `onFinish`.

- [ ] **Step 4: Trigger success in AI save (from Task 1)**

In the `onSave` callback passed to AIWizard, after `addSubscription(res.data)`:

```typescript
addSubscription(res.data);
setSuccessName(sub.name || 'Subscription');
setShowSuccess(true);
```

- [ ] **Step 5: Add i18n keys**

All locales — add to `add` section:
- en: `"success_added": "Added!"`
- ru: `"success_added": "Добавлено!"`
- (other locales with English fallback)

Also add for Task 1:
- en: `"edit_details": "Edit details"`
- ru: `"edit_details": "Редактировать детали"`

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/components/SuccessOverlay.tsx src/components/AddSubscriptionSheet.tsx src/i18n/
git commit -m "feat: success animation after adding subscription"
```

---

### Task 5: Final verification + push

- [ ] **Step 1: TypeScript check**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile && npx tsc --noEmit
```

- [ ] **Step 2: Push**

```bash
git push origin dev
```

- [ ] **Step 3: Manual test checklist**

1. AI tab → say "Netflix" → confirm → "Add" button saves directly → success animation → sheet closes
2. AI tab → say "Netflix" → "Edit details" → switches to Manual tab with fields filled
3. Manual tab → only Name, Amount, Currency, Period visible → tap "More" → optional fields expand
4. Voice → tap mic → recording starts → tap mic again → stops and transcribes
5. Manual tab → fill and save → success animation → sheet closes
6. Error case → API fails → alert shows, modal stays open
