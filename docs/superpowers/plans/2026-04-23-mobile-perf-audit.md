# Mobile Performance Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 48% CPU spike on keystroke, make Done keyboard accessory universal and high-contrast, ensure all modal inputs auto-scroll — by splitting three monster components and introducing shared keyboard/input primitives.

**Architecture:** Three layers. (1) Shared primitives (`DoneAccessoryInput`, `KeyboardAwareModal`, `Chip`, `useDebouncedValue`). (2) Split `AddSubscriptionSheet` (2165 lines), `AIWizard` (1192), `BulkAddSheet` (829) into per-mode sub-components so a keystroke re-renders only the active mode. (3) Cross-cutting `React.memo` + debounce pass.

**Tech Stack:** React Native, Expo SDK 51, TypeScript strict, Jest, i18next, Reanimated, Axios, TanStack Query v5, Zustand.

**Spec reference:** [docs/superpowers/specs/2026-04-23-mobile-perf-audit-design.md](../specs/2026-04-23-mobile-perf-audit-design.md)

**Working mode:** Commit directly on `main` in small PR-sized chunks. After each Part, run `npx tsc --noEmit`, `npm test`, and manually verify the touched flow in the iOS simulator (`npm run start:dev`). No TestFlight builds (user does them manually).

**Conventions:**
- Commit messages: `refactor(mobile): ...`, `fix(mobile): ...`, `feat(mobile): ...`.
- No changes to public props, i18n keys, analytics events, or API calls.
- All new files use absolute imports only where existing project uses them; otherwise relative (follow the file they neighbor).
- Use `useTheme()` → `colors.xxx` only — never `COLORS.xxx` constants in StyleSheet.

---

## Part A — Shared Primitives (Day 1)

### Task A1: Create `DoneAccessoryInput`

**Files:**
- Create: `src/components/primitives/DoneAccessoryInput.tsx`
- Create: `src/components/primitives/__tests__/DoneAccessoryInput.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/primitives/__tests__/DoneAccessoryInput.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { DoneAccessoryInput } from '../DoneAccessoryInput';

jest.mock('../../../theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#11111F',
      border: '#2A2A40',
      primary: '#7C5CFF',
    },
  }),
}));

describe('DoneAccessoryInput', () => {
  it('renders the TextInput with accessory on iOS', () => {
    Platform.OS = 'ios';
    const { getByTestId } = render(
      <DoneAccessoryInput testID="in" value="hi" onChangeText={() => {}} />
    );
    expect(getByTestId('in').props.inputAccessoryViewID).toBe('done-accessory');
  });

  it('omits the accessoryId on Android', () => {
    Platform.OS = 'android';
    const { getByTestId } = render(
      <DoneAccessoryInput testID="in" value="hi" onChangeText={() => {}} />
    );
    expect(getByTestId('in').props.inputAccessoryViewID).toBeUndefined();
  });

  it('honors showDoneAccessory={false}', () => {
    Platform.OS = 'ios';
    const { getByTestId } = render(
      <DoneAccessoryInput testID="in" value="" onChangeText={() => {}} showDoneAccessory={false} />
    );
    expect(getByTestId('in').props.inputAccessoryViewID).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/primitives/__tests__/DoneAccessoryInput.test.tsx`
Expected: FAIL — `Cannot find module '../DoneAccessoryInput'`.

- [ ] **Step 3: Implement `DoneAccessoryInput`**

```tsx
// src/components/primitives/DoneAccessoryInput.tsx
import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import {
  TextInput,
  InputAccessoryView,
  View,
  TouchableOpacity,
  Text,
  Platform,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';

const DEFAULT_ACCESSORY_ID = 'done-accessory';

export interface DoneAccessoryInputProps extends TextInputProps {
  /** Unique accessory ID. Defaults to a shared ID so multiple inputs reuse one toolbar. */
  accessoryId?: string;
  /** Show the iOS Done toolbar. Defaults to true. */
  showDoneAccessory?: boolean;
}

/**
 * TextInput that always ships a high-contrast iOS "Done" keyboard accessory.
 * Supersedes NumericInput (which is kept as a thin re-export during migration).
 */
export const DoneAccessoryInput = forwardRef<TextInput, DoneAccessoryInputProps>(function DoneAccessoryInput(
  { accessoryId, showDoneAccessory = true, ...props },
  ref,
) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const innerRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => innerRef.current!, []);

  const id = accessoryId || DEFAULT_ACCESSORY_ID;
  const shouldAttach = Platform.OS === 'ios' && showDoneAccessory;

  return (
    <>
      <TextInput
        ref={innerRef}
        inputAccessoryViewID={shouldAttach ? id : undefined}
        {...props}
      />
      {shouldAttach && (
        <InputAccessoryView nativeID={id}>
          <View style={[styles.toolbar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => innerRef.current?.blur()}
              accessibilityRole="button"
              accessibilityLabel={t('common.done', 'Done')}
            >
              <Text style={[styles.doneText, { color: colors.primary }]}>
                {t('common.done', 'Done')}
              </Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/primitives/__tests__/DoneAccessoryInput.test.tsx`
Expected: PASS (3 passing).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/primitives/DoneAccessoryInput.tsx src/components/primitives/__tests__/DoneAccessoryInput.test.tsx
git commit -m "feat(mobile): add DoneAccessoryInput primitive"
```

---

### Task A2: Create `KeyboardAwareModal`

**Files:**
- Create: `src/components/primitives/KeyboardAwareModal.tsx`

- [ ] **Step 1: Implement the wrapper**

```tsx
// src/components/primitives/KeyboardAwareModal.tsx
import React from 'react';
import {
  Modal,
  ModalProps,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';

export interface KeyboardAwareModalProps extends Omit<ModalProps, 'children'> {
  children: React.ReactNode;
  /** Wrap content in a ScrollView. Default true. Set false for screens with their own FlatList. */
  scrollable?: boolean;
  /** Dismiss keyboard on tap outside inputs. Default true. */
  dismissOnTapOutside?: boolean;
  /** iOS keyboardVerticalOffset. Default 0. */
  keyboardVerticalOffset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

/**
 * Modal + KeyboardAvoidingView + ScrollView with auto-scroll-to-input and tap-outside-to-dismiss.
 * Consistent keyboard behavior across all sheets.
 */
export function KeyboardAwareModal({
  children,
  scrollable = true,
  dismissOnTapOutside = true,
  keyboardVerticalOffset = 0,
  contentContainerStyle,
  style,
  ...modalProps
}: KeyboardAwareModalProps) {
  const inner = scrollable ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
  );

  const body = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[{ flex: 1 }, style]}
    >
      {inner}
    </KeyboardAvoidingView>
  );

  return (
    <Modal {...modalProps}>
      {dismissOnTapOutside ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {body}
        </TouchableWithoutFeedback>
      ) : (
        body
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/primitives/KeyboardAwareModal.tsx
git commit -m "feat(mobile): add KeyboardAwareModal primitive"
```

---

### Task A3: Create `useDebouncedValue` hook

**Files:**
- Create: `src/hooks/useDebouncedValue.ts`
- Create: `src/hooks/__tests__/useDebouncedValue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/__tests__/useDebouncedValue.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useDebouncedValue } from '../useDebouncedValue';

jest.useFakeTimers();

describe('useDebouncedValue', () => {
  it('returns the latest value after the delay', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });
    expect(result.current).toBe('a');
    rerender({ v: 'b' });
    expect(result.current).toBe('a');
    act(() => { jest.advanceTimersByTime(299); });
    expect(result.current).toBe('a');
    act(() => { jest.advanceTimersByTime(1); });
    expect(result.current).toBe('b');
  });

  it('resets the timer when the value changes again before the delay', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    act(() => { jest.advanceTimersByTime(200); });
    rerender({ v: 'c' });
    act(() => { jest.advanceTimersByTime(200); });
    expect(result.current).toBe('a');
    act(() => { jest.advanceTimersByTime(100); });
    expect(result.current).toBe('c');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (module not found)

Run: `npx jest src/hooks/__tests__/useDebouncedValue.test.ts`

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useDebouncedValue.ts
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest src/hooks/__tests__/useDebouncedValue.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDebouncedValue.ts src/hooks/__tests__/useDebouncedValue.test.ts
git commit -m "feat(mobile): add useDebouncedValue hook"
```

---

### Task A4: Create `Chip` memoized primitive

**Files:**
- Create: `src/components/primitives/Chip.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/primitives/Chip.tsx
import React, { memo, useCallback } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface ChipProps {
  id: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  /** Stable callback — parent should wrap in useCallback. */
  onPress: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

function ChipImpl({ id, label, icon, active, onPress, style }: ChipProps) {
  const { colors } = useTheme();
  const handlePress = useCallback(() => onPress(id), [id, onPress]);
  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.primary : colors.surface2, borderColor: colors.border },
        style,
      ]}
      activeOpacity={0.7}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, { color: active ? '#FFF' : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const Chip = memo(ChipImpl);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  icon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/primitives/Chip.tsx
git commit -m "feat(mobile): add memoized Chip primitive"
```

---

### Task A5: Re-export `NumericInput` through the new primitive

**Files:**
- Modify: `src/components/NumericInput.tsx`

- [ ] **Step 1: Replace file body**

```tsx
// src/components/NumericInput.tsx
/**
 * @deprecated Use DoneAccessoryInput directly. Kept as a compatibility shim.
 */
import React from 'react';
import { DoneAccessoryInput, DoneAccessoryInputProps } from './primitives/DoneAccessoryInput';

export const NumericInput = React.forwardRef<any, DoneAccessoryInputProps>((props, ref) => (
  <DoneAccessoryInput ref={ref} keyboardType={props.keyboardType ?? 'decimal-pad'} {...props} />
));
```

- [ ] **Step 2: Type-check and test**

Run: `npx tsc --noEmit && npm test`
Expected: both green. Existing NumericInput call sites continue working.

- [ ] **Step 3: Commit**

```bash
git add src/components/NumericInput.tsx
git commit -m "refactor(mobile): NumericInput now wraps DoneAccessoryInput"
```

---

### Task A6: Fix `JoinTeamSheet` Done bar contrast

**Files:**
- Modify: `src/components/JoinTeamSheet.tsx:119`

- [ ] **Step 1: Change the background token**

Find the block in `src/components/JoinTeamSheet.tsx:117-131` and change line 119:

```tsx
// BEFORE:
<View style={[styles.keyboardBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
// AFTER:
<View style={[styles.keyboardBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Manual QA**

1. `npm run start:dev`
2. Open the app → Settings → Team → Join team sheet.
3. Tap code input. Verify the keyboard Done/Join bar has a dark (`colors.background`) background, clearly distinct from the sheet surface.

- [ ] **Step 4: Commit**

```bash
git add src/components/JoinTeamSheet.tsx
git commit -m "fix(mobile): darken JoinTeamSheet keyboard Done bar for contrast"
```

---

## Part B — Split `AddSubscriptionSheet` (Days 2–3)

The current file has 7 render functions keyed off `flowState`: `renderIdle` (766), `renderLoading` (933), `renderTranscription`, `renderConfirm` (993), `renderBulkConfirm` (1078), `renderWizard` (1234), `renderManual` (1355). The ScrollView switch is at 1839–1845. Additionally there is a nested full-screen bulk-edit Modal starting at line 1872.

**Target directory:** `src/components/add-subscription/`

### Task B1: Scaffold the target directory and `IdleView`

**Files:**
- Create: `src/components/add-subscription/IdleView.tsx`
- Create: `src/components/add-subscription/types.ts`
- Modify: `src/components/AddSubscriptionSheet.tsx` (only the `renderIdle` call site)

- [ ] **Step 1: Create the shared types file**

```ts
// src/components/add-subscription/types.ts
export type FlowState =
  | 'idle'
  | 'loading'
  | 'transcription'
  | 'confirm'
  | 'bulk-confirm'
  | 'wizard'
  | 'manual';

export type AddedViaSource = 'MANUAL' | 'AI_TEXT' | 'AI_SCREENSHOT';
```

- [ ] **Step 2: Read existing `renderIdle` body**

Open `src/components/AddSubscriptionSheet.tsx` lines 766–931. Copy the full JSX and the inline style closures it depends on.

- [ ] **Step 3: Create `IdleView.tsx` with lifted state**

Move the following state into `IdleView`:
- `smartInput`, `setSmartInput`
- `showAllChips`, `setShowAllChips`

Keep the following in the orchestrator and pass as props:
- `catalogServices`, `isRecording`, `durationFmt`, `handleSmartSubmit`, `handleQuickChip`, `handleCatalogChip`, `handleVoiceComplete`, `handleVoiceError`, `handleCamera`, `startRecording`, `stopRecording`.

File skeleton:

```tsx
// src/components/add-subscription/IdleView.tsx
import React, { memo, useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import { Chip } from '../primitives/Chip';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { CatalogService } from '../../api/catalogApi'; // or whatever the actual path is

interface Props {
  catalogServices: CatalogService[];
  isRecording: boolean;
  durationFmt: string;
  onSmartSubmit: (text: string) => void;
  onQuickChip: (chipId: string) => void;
  onCatalogChip: (service: CatalogService) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCamera: () => void;
}

function IdleViewImpl(props: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [smartInput, setSmartInput] = useState('');
  const [showAllChips, setShowAllChips] = useState(false);
  // debounced only used for UI hints (e.g., "looks like a bulk input?")
  const smartInputDebounced = useDebouncedValue(smartInput, 300);

  const handleSubmit = useCallback(() => {
    const v = smartInput.trim();
    if (v.length > 0) props.onSmartSubmit(v);
  }, [smartInput, props]);

  // ...rest of JSX copied from renderIdle, with:
  //   <TextInput .../> → <DoneAccessoryInput ... />
  //   inline <TouchableOpacity onPress={() => handleCatalogChip(svc)}> inside .map()
  //     → <Chip id={svc.id} label={svc.name} onPress={handleCatalogChipById} />
  //   where handleCatalogChipById is a useCallback wrapping a lookup by id.
  return (/* ... */);
}

export const IdleView = memo(IdleViewImpl);
```

Apply these transformations inside the copied JSX:
1. Replace `<TextInput>` controlling `smartInput` with `<DoneAccessoryInput>`.
2. Replace inline `onPress={() => handleCatalogChip(svc)}` inside `.map()` with `<Chip id={svc.id} label={svc.name} onPress={handleCatalogChipById} />`, where:
   ```ts
   const handleCatalogChipById = useCallback((id: string) => {
     const svc = props.catalogServices.find((s) => s.id === id);
     if (svc) props.onCatalogChip(svc);
   }, [props.catalogServices, props.onCatalogChip]);
   ```
3. Replace inline `onPress={() => handleQuickChip(chip)}` similarly.

- [ ] **Step 4: Wire `IdleView` into the orchestrator**

In `src/components/AddSubscriptionSheet.tsx`:
- Add import: `import { IdleView } from './add-subscription/IdleView';`
- Delete the local `smartInput`/`setSmartInput` and `showAllChips`/`setShowAllChips` useState lines (≈203, ≈211).
- Delete the `renderIdle` function (lines 766–931).
- Delete any now-unused helper (e.g., `QuickChipButton` if fully moved).
- Replace `{flowState === 'idle' && renderIdle()}` with:

```tsx
{flowState === 'idle' && (
  <IdleView
    catalogServices={catalogServices}
    isRecording={isRecording}
    durationFmt={durationFmt}
    onSmartSubmit={handleSmartSubmit}
    onQuickChip={handleQuickChip}
    onCatalogChip={handleCatalogChip}
    onStartRecording={startRecording}
    onStopRecording={stopRecording}
    onCamera={handleCamera}
  />
)}
```

- `handleSmartSubmit` currently reads `smartInput` from closure (line 492). Refactor it to accept `text: string` explicitly — the orchestrator no longer owns `smartInput`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. Fix any prop mismatches.

- [ ] **Step 6: Manual QA**

1. `npm run start:dev`
2. Open Add sheet.
3. Type "Netflix" in the smart input. Verify no lag. Verify Done accessory appears on keyboard.
4. Tap a Quick chip. Verify confirm flow triggers.
5. Tap a Catalog chip. Verify confirm flow triggers.
6. Tap mic / camera. Verify those flows still trigger.

- [ ] **Step 7: Commit**

```bash
git add src/components/add-subscription/IdleView.tsx src/components/add-subscription/types.ts src/components/AddSubscriptionSheet.tsx
git commit -m "refactor(mobile): extract IdleView from AddSubscriptionSheet"
```

---

### Task B2: Extract `LoadingView` and `TranscriptionView`

**Files:**
- Create: `src/components/add-subscription/LoadingView.tsx`
- Create: `src/components/add-subscription/TranscriptionView.tsx`
- Modify: `src/components/AddSubscriptionSheet.tsx`

- [ ] **Step 1: Extract `LoadingView`**

Copy `renderLoading` body (lines 933–991) and the `LoadingStage` type. State `loadingStage` stays in the orchestrator (cross-mode). `LoadingView` receives it as a prop.

```tsx
// src/components/add-subscription/LoadingView.tsx
import React, { memo } from 'react';
import { View, Text /* ... */ } from 'react-native';
import { useTheme } from '../../theme';
import { useTranslation } from 'react-i18next';

export type LoadingStage = /* keep same union as in original */;

interface Props {
  stage: LoadingStage;
  source: 'MANUAL' | 'AI_TEXT' | 'AI_SCREENSHOT';
}

function LoadingViewImpl({ stage, source }: Props) {
  /* paste JSX from renderLoading */
}

export const LoadingView = memo(LoadingViewImpl);
```

- [ ] **Step 2: Extract `TranscriptionView`** (whatever is currently under `flowState === 'transcription'`)

Find `renderTranscription` and repeat the extraction pattern.

- [ ] **Step 3: Wire both into orchestrator**

Replace:
```tsx
{flowState === 'loading' && renderLoading()}
{flowState === 'transcription' && renderTranscription()}
```

With:
```tsx
{flowState === 'loading' && <LoadingView stage={loadingStage} source={addedViaSource} />}
{flowState === 'transcription' && <TranscriptionView text={transcribedText} onEdit={...} onConfirm={...} />}
```

Delete the two now-unused `renderX` functions.

- [ ] **Step 4: Type-check + manual QA**

- `npx tsc --noEmit`
- Trigger a voice flow: record a voice memo with a subscription name. Verify loading stages render. Verify transcription view shows text.

- [ ] **Step 5: Commit**

```bash
git add src/components/add-subscription/LoadingView.tsx src/components/add-subscription/TranscriptionView.tsx src/components/AddSubscriptionSheet.tsx
git commit -m "refactor(mobile): extract LoadingView and TranscriptionView"
```

---

### Task B3: Extract `ConfirmView` and `BulkConfirmView`

**Files:**
- Create: `src/components/add-subscription/ConfirmView.tsx`
- Create: `src/components/add-subscription/BulkConfirmView.tsx`
- Modify: `src/components/AddSubscriptionSheet.tsx`

- [ ] **Step 1: Extract `ConfirmView`**

Copy `renderConfirm` body (lines 993–1076). Props: `confirmData`, `onSave`, `onEdit`, `onCancel`.

State stays in orchestrator: `confirmData`. Any local state such as a "show more fields" toggle moves into `ConfirmView`.

- [ ] **Step 2: Extract `BulkConfirmView`**

Copy `renderBulkConfirm` body (lines 1078–1232). Props: `items: ParsedSub[]`, `onSave`, `onEdit(index)`, `onRemove(index)`, `onCancel`.

Replace inline `onPress={() => {...}}` in the `.map()` with stable callbacks:
```tsx
const handleToggle = useCallback((index: number) => { /* ... */ }, []);
const handleEdit = useCallback((index: number) => onEdit(index), [onEdit]);
```

Wrap each row in a `memo`-ed `BulkRow` sub-component that takes `index` and the memoized callbacks.

- [ ] **Step 3: Wire both into orchestrator**

```tsx
{flowState === 'confirm' && confirmData && (
  <ConfirmView data={confirmData} onSave={handleConfirmSave} onEdit={handleEditFromConfirm} onCancel={() => setFlowState('idle')} />
)}
{flowState === 'bulk-confirm' && (
  <BulkConfirmView items={bulkItems} onSave={/*...*/} onEdit={(i) => setBulkEditIdx(i)} onRemove={/*...*/} onCancel={() => setFlowState('idle')} />
)}
```

- [ ] **Step 4: Type-check + manual QA**

- Type-check clean.
- Manually trigger confirm flow (AI parse single service) → verify confirm view renders and save works.
- Manually trigger bulk flow (AI parse multiple) → verify bulk confirm renders and row edit/remove works.

- [ ] **Step 5: Commit**

```bash
git add src/components/add-subscription/ConfirmView.tsx src/components/add-subscription/BulkConfirmView.tsx src/components/AddSubscriptionSheet.tsx
git commit -m "refactor(mobile): extract ConfirmView and BulkConfirmView"
```

---

### Task B4: Extract `ManualFormView` and `useAddSubscriptionForm`

**Files:**
- Create: `src/components/add-subscription/ManualFormView.tsx`
- Create: `src/components/add-subscription/useAddSubscriptionForm.ts`
- Modify: `src/components/AddSubscriptionSheet.tsx`

- [ ] **Step 1: Extract the form hook**

Lift the following from the orchestrator into `useAddSubscriptionForm`:
- `form`, `setForm`, `setF`
- `moreExpanded`, `setMoreExpanded`
- `manualExpanded`, `setManualExpanded`
- validation helpers currently inlined in `handleSave` (VALID_CATEGORIES, VALID_BILLING)

```ts
// src/components/add-subscription/useAddSubscriptionForm.ts
import { useCallback, useState } from 'react';

export const emptyForm = { /* copy emptyForm from orchestrator */ };

export function useAddSubscriptionForm(initial = emptyForm) {
  const [form, setForm] = useState(initial);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);

  const setF = useCallback((key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setForm(initial);
    setMoreExpanded(false);
    setManualExpanded(false);
  }, [initial]);

  return { form, setForm, setF, moreExpanded, setMoreExpanded, manualExpanded, setManualExpanded, reset };
}
```

- [ ] **Step 2: Extract `ManualFormView`**

Copy `renderManual` body (lines 1355–1800 approx). All `<TextInput>` become `<DoneAccessoryInput>`. All `<NumericInput>` remain (they already wrap the primitive).

Props:
```ts
interface Props {
  form: ReturnType<typeof useAddSubscriptionForm>['form'];
  setF: ReturnType<typeof useAddSubscriptionForm>['setF'];
  moreExpanded: boolean;
  setMoreExpanded: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}
```

Wrap the exported component in `React.memo`.

- [ ] **Step 3: Wire into orchestrator**

In the orchestrator:
- Replace the lifted state lines (≈186–188) with `const formCtx = useAddSubscriptionForm();`
- `handleSave` now reads `formCtx.form`.
- Replace `{flowState === 'manual' && renderManual()}` with:

```tsx
{flowState === 'manual' && (
  <ManualFormView
    form={formCtx.form}
    setF={formCtx.setF}
    moreExpanded={formCtx.moreExpanded}
    setMoreExpanded={formCtx.setMoreExpanded}
    saving={saving}
    onSave={handleSave}
    onCancel={() => setFlowState('idle')}
  />
)}
```

Call `formCtx.reset()` from `resetAll()`.

- [ ] **Step 4: Type-check + manual QA — the big one**

- `npx tsc --noEmit`
- Open manual form. Type in `name`. **CPU must stay ≤20%** in Xcode Instruments (verify in dev-menu performance monitor or Instruments).
- Change amount, category, cycle, tags, notes.
- Save.
- Verify the subscription is persisted and list updates.

- [ ] **Step 5: Commit**

```bash
git add src/components/add-subscription/ManualFormView.tsx src/components/add-subscription/useAddSubscriptionForm.ts src/components/AddSubscriptionSheet.tsx
git commit -m "refactor(mobile): extract ManualFormView and useAddSubscriptionForm hook"
```

---

### Task B5: Extract `WizardView` (question-flow fallback)

**Files:**
- Create: `src/components/add-subscription/WizardView.tsx`
- Modify: `src/components/AddSubscriptionSheet.tsx`

- [ ] **Step 1: Extract**

Copy `renderWizard` body (1234–1353). Props: the question text + field + available quick-answer chips + `onAnswer(text)`, `onCancel`.

Replace the text input with `DoneAccessoryInput`.

- [ ] **Step 2: Wire + verify + commit**

```bash
git add src/components/add-subscription/WizardView.tsx src/components/AddSubscriptionSheet.tsx
git commit -m "refactor(mobile): extract WizardView from AddSubscriptionSheet"
```

---

### Task B6: Extract the embedded bulk-edit Modal

**Files:**
- Create: `src/components/add-subscription/BulkEditModal.tsx`
- Modify: `src/components/AddSubscriptionSheet.tsx`

The full-screen edit modal at lines 1872–2010 is effectively a separate screen nested inside `AddSubscriptionSheet`. Extract it.

- [ ] **Step 1: Extract as a dedicated component using `KeyboardAwareModal`**

```tsx
// src/components/add-subscription/BulkEditModal.tsx
import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { KeyboardAwareModal } from '../primitives/KeyboardAwareModal';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import type { ParsedSub } from './types';

interface Props {
  visible: boolean;
  sub: ParsedSub | null;
  onClose: () => void;
  onUpdate: (patch: Partial<ParsedSub>) => void;
}

function BulkEditModalImpl({ visible, sub, onClose, onUpdate }: Props) {
  if (!sub) return null;
  return (
    <KeyboardAwareModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* paste JSX from lines 1872–2010, replace <TextInput> with <DoneAccessoryInput> */}
    </KeyboardAwareModal>
  );
}

export const BulkEditModal = memo(BulkEditModalImpl);
```

Add `ParsedSub` to `types.ts` if not already there.

- [ ] **Step 2: Wire + verify + commit**

In orchestrator: replace the inline JSX at 1872–2010 with `<BulkEditModal visible={bulkEditIdx !== null} sub={bulkEditIdx !== null ? bulkItems[bulkEditIdx] : null} onClose={() => setBulkEditIdx(null)} onUpdate={updateSub} />`.

Manual QA: in bulk-confirm, tap edit on a row — modal opens, tap an input — keyboard auto-scrolls, Done appears.

```bash
git add src/components/add-subscription/BulkEditModal.tsx src/components/add-subscription/types.ts src/components/AddSubscriptionSheet.tsx
git commit -m "refactor(mobile): extract BulkEditModal using KeyboardAwareModal"
```

---

### Task B7: Post-split cleanup on `AddSubscriptionSheet`

**Files:**
- Modify: `src/components/AddSubscriptionSheet.tsx`

- [ ] **Step 1: Remove dead imports**

After the extractions, these imports are likely unused: `Animated`, some Ionicons, `QuickChipButton` (if fully moved), `CatalogService` if no longer referenced directly. Remove all unused imports.

- [ ] **Step 2: Wrap eligible handlers in `useCallback`**

Every handler passed to a memoized child (`IdleView`, `ConfirmView`, etc.) must be stable. Audit:
- `handleSmartSubmit`, `handleQuickChip`, `handleCatalogChip`, `handleVoiceComplete`, `handleVoiceError`, `handleCamera`, `handleSave`, `handleConfirmSave`, `handleEditFromConfirm`, `startRecording`, `stopRecording`

Ensure each is `useCallback` with exhaustive deps. Where a handler depends on many refs, prefer refs over dep arrays to keep the callback stable.

- [ ] **Step 3: Verify line count**

Run: `wc -l src/components/AddSubscriptionSheet.tsx`
Expected: ≤ ~450 lines. If larger, something wasn't fully extracted — audit and fix.

- [ ] **Step 4: Final manual QA — all Add flows**

Complete at minimum:
- Idle → smart text → single confirm → save.
- Idle → smart text → bulk confirm → save.
- Idle → quick chip → confirm → save.
- Idle → catalog chip → confirm → save.
- Idle → voice → transcription → confirm → save.
- Idle → camera → parse → confirm → save.
- Idle → expand manual → manual save.
- Bulk confirm → tap edit → BulkEditModal → edit → save.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddSubscriptionSheet.tsx
git commit -m "refactor(mobile): stabilize handlers with useCallback post-split"
```

---

## Part C — Split `AIWizard` (Day 4)

The `ui` discriminated union has kinds: `idle`, `question`, `confirm`, `bulk`, `bulk-edit`, `plans`. File: `src/components/AIWizard.tsx` (1192 lines).

**Target directory:** `src/components/ai-wizard/`

### Task C1: Scaffold and extract `BulkEditStage` first (bug-fix priority)

The `ui.kind === 'bulk-edit'` branch at lines 797–900 **lacks `KeyboardAvoidingView`** — this is the root cause of the "keyboard covers input after opening modal" bug. Fix it as part of the extraction.

**Files:**
- Create: `src/components/ai-wizard/types.ts`
- Create: `src/components/ai-wizard/BulkEditStage.tsx`
- Modify: `src/components/AIWizard.tsx`

- [ ] **Step 1: Create the types file**

```ts
// src/components/ai-wizard/types.ts
export type ParsedSub = /* copy ParsedSub definition from AIWizard.tsx */;
export type PlanOption = /* copy PlanOption definition */;

export type UIState =
  | { kind: 'idle' }
  | { kind: 'question'; text: string; field: string }
  | { kind: 'confirm'; subscription: ParsedSub }
  | { kind: 'bulk'; subs: ParsedSub[]; checked: boolean[] }
  | { kind: 'bulk-edit'; subs: ParsedSub[]; checked: boolean[]; editIdx: number }
  | { kind: 'plans'; plans: PlanOption[]; serviceName: string; iconUrl?: string; serviceUrl?: string; cancelUrl?: string; category?: string };
```

- [ ] **Step 2: Create `BulkEditStage` with `KeyboardAvoidingView`**

Copy JSX from `AIWizard.tsx:797-900`. Wrap the ScrollView in `KeyboardAvoidingView` with proper behavior. Use `DoneAccessoryInput` for all text/numeric inputs.

```tsx
// src/components/ai-wizard/BulkEditStage.tsx
import React, { memo, useCallback } from 'react';
import { View, Text, ScrollView, Platform, KeyboardAvoidingView, TouchableOpacity } from 'react-native';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import { useTheme } from '../../theme';
import { useTranslation } from 'react-i18next';
import type { ParsedSub } from './types';

interface Props {
  sub: ParsedSub;
  index: number;
  onUpdate: (patch: Partial<ParsedSub>) => void;
  onDone: () => void;
  onCancel: () => void;
}

function BulkEditStageImpl({ sub, index, onUpdate, onDone, onCancel }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const setName = useCallback((v: string) => onUpdate({ name: v }), [onUpdate]);
  const setAmount = useCallback((v: string) => onUpdate({ amount: parseFloat(v) || 0 }), [onUpdate]);
  // ...etc per field

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        {/* paste the actual JSX from AIWizard.tsx:822-898, replacing <TextInput> with <DoneAccessoryInput> */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const BulkEditStage = memo(BulkEditStageImpl);
```

- [ ] **Step 3: Wire into orchestrator**

Replace the inline `ui.kind === 'bulk-edit'` block (lines 797–900) with:

```tsx
{ui.kind === 'bulk-edit' && (
  <BulkEditStage
    sub={ui.subs[ui.editIdx]}
    index={ui.editIdx}
    onUpdate={(patch) => setUi((prev) => {
      if (prev.kind !== 'bulk-edit') return prev;
      const nextSubs = [...prev.subs];
      nextSubs[prev.editIdx] = { ...nextSubs[prev.editIdx], ...patch };
      return { ...prev, subs: nextSubs };
    })}
    onDone={() => fade(() => setUi({ kind: 'bulk', subs: ui.subs, checked: ui.checked }))}
    onCancel={() => fade(() => setUi({ kind: 'bulk', subs: ui.subs, checked: ui.checked }))}
  />
)}
```

- [ ] **Step 4: Manual QA — the bug fix**

1. Open AIWizard (from whichever entry point uses it — Add sheet voice flow).
2. Reach bulk-edit stage.
3. Tap any text input.
4. **Verify:** the keyboard does NOT cover the input; scroll-to-input works; Done accessory is visible with dark bg.

- [ ] **Step 5: Commit**

```bash
git add src/components/ai-wizard/types.ts src/components/ai-wizard/BulkEditStage.tsx src/components/AIWizard.tsx
git commit -m "fix(mobile): wrap AIWizard bulk-edit in KeyboardAvoidingView"
```

---

### Task C2: Extract `BulkListStage`

**Files:**
- Create: `src/components/ai-wizard/BulkListStage.tsx`
- Modify: `src/components/AIWizard.tsx`

- [ ] **Step 1: Extract `ui.kind === 'bulk'` branch (lines 690–795)**

Create a memoized row component for each list item so per-row re-renders do not cascade:

```tsx
// internal BulkRow
interface RowProps {
  index: number;
  sub: ParsedSub;
  checked: boolean;
  onToggle: (i: number) => void;
  onEdit: (i: number) => void;
  onRemove: (i: number) => void;
}
const BulkRow = memo(function BulkRow({ index, sub, checked, onToggle, onEdit, onRemove }: RowProps) {
  const handleToggle = useCallback(() => onToggle(index), [index, onToggle]);
  const handleEdit = useCallback(() => onEdit(index), [index, onEdit]);
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);
  return (/* row JSX */);
});
```

- [ ] **Step 2: Wire + QA + commit**

Replace inline `onPress={() => fade(() => setUi({ kind: 'bulk-edit', ... }))}` with stable callbacks in the parent passed as `onEdit`, `onToggle`, `onRemove`. Keep the `fade` animation in the parent.

Commit:
```bash
git add src/components/ai-wizard/BulkListStage.tsx src/components/AIWizard.tsx
git commit -m "refactor(mobile): extract AIWizard BulkListStage with memoized rows"
```

---

### Task C3: Extract `QuestionStage`, `ConfirmStage`, `PlansStage`

**Files:**
- Create: `src/components/ai-wizard/QuestionStage.tsx`
- Create: `src/components/ai-wizard/ConfirmStage.tsx`
- Create: `src/components/ai-wizard/PlansStage.tsx`
- Modify: `src/components/AIWizard.tsx`

- [ ] **Step 1: Extract each in turn using the same memoization pattern**

Each stage is a small pure view; props are the discriminated-union branch data plus callbacks.

- [ ] **Step 2: Replace all `<TextInput>` with `<DoneAccessoryInput>`**

- [ ] **Step 3: Wire + QA + commit**

QA: run through a voice flow that hits each stage (you may need to fabricate AI responses via local catalog or dev menu).

```bash
git add src/components/ai-wizard/QuestionStage.tsx src/components/ai-wizard/ConfirmStage.tsx src/components/ai-wizard/PlansStage.tsx src/components/AIWizard.tsx
git commit -m "refactor(mobile): extract AIWizard Question/Confirm/Plans stages"
```

---

### Task C4: Extract `VoiceInputStage` (idle kind)

**Files:**
- Create: `src/components/ai-wizard/VoiceInputStage.tsx`
- Modify: `src/components/AIWizard.tsx`

- [ ] **Step 1: Extract**

Current `ui.kind === 'idle'` holds the mic button + loading indicator. Extract the mic UI and loading stages into `VoiceInputStage`, keeping the `LoadingIndicator` and `MicButton` helpers inline there (they are already memoized at lines 155 and 211).

- [ ] **Step 2: Wire + QA + commit**

```bash
git add src/components/ai-wizard/VoiceInputStage.tsx src/components/AIWizard.tsx
git commit -m "refactor(mobile): extract AIWizard VoiceInputStage"
```

---

### Task C5: Post-split cleanup on `AIWizard`

- [ ] **Step 1: Remove dead imports, stabilize remaining handlers**

Same pattern as Task B7. Target: `wc -l src/components/AIWizard.tsx` ≤ ~350.

- [ ] **Step 2: Run full manual QA on AIWizard**

- idle/voice → recording → transcription → one of: confirm | question | bulk | plans.
- bulk → edit row → verify keyboard behavior (Task C1 fix).
- plans → select plan → confirm.

- [ ] **Step 3: Commit**

```bash
git add src/components/AIWizard.tsx
git commit -m "refactor(mobile): AIWizard cleanup and handler stabilization"
```

---

## Part D — Split `BulkAddSheet` (Day 5)

File: `src/components/BulkAddSheet.tsx` (829 lines). Mode enum: `'select' | 'voice' | 'text' | 'screenshot' | 'review'` (line 46). Mode switch at lines 497–658.

**Target directory:** `src/components/bulk-add/`

### Task D1: Scaffold + extract `TextInputMode`

**Files:**
- Create: `src/components/bulk-add/TextInputMode.tsx`
- Modify: `src/components/BulkAddSheet.tsx`

- [ ] **Step 1: Extract the `mode === 'text'` branch (lines 543–590)**

Move local state: `textInput`, `setTextInput` into `TextInputMode`. Replace `<TextInput>` with `<DoneAccessoryInput>` (note: `multiline` still works with the accessory).

```tsx
// src/components/bulk-add/TextInputMode.tsx
import React, { memo, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import { useTheme } from '../../theme';
import { useTranslation } from 'react-i18next';

interface Props {
  onSubmit: (text: string) => void;
  onBack: () => void;
}

function TextInputModeImpl({ onSubmit, onBack }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const handleSubmit = useCallback(() => onSubmit(text.trim()), [text, onSubmit]);
  return (/* JSX */);
}

export const TextInputMode = memo(TextInputModeImpl);
```

Orchestrator `BulkAddSheet` no longer holds `textInput` state.

- [ ] **Step 2: Wire + QA + commit**

QA: open Add → bulk → text mode → paste multi-line text → no per-keystroke lag.

```bash
git add src/components/bulk-add/TextInputMode.tsx src/components/BulkAddSheet.tsx
git commit -m "refactor(mobile): extract BulkAddSheet TextInputMode"
```

---

### Task D2: Extract `VoiceMode`

- Similar pattern. Extract `mode === 'voice'` (lines 527–541). Wrap in `React.memo`. Owns local animation state for the mic button.

```bash
git commit -m "refactor(mobile): extract BulkAddSheet VoiceMode"
```

---

### Task D3: Extract `ScreenshotMode`

- Extract `mode === 'screenshot'` (lines 592–610). Owns local `imageUri` state.

```bash
git commit -m "refactor(mobile): extract BulkAddSheet ScreenshotMode"
```

---

### Task D4: Extract `ReviewMode` and `SelectMode`

- Extract `mode === 'review'` (lines 612–657) and `mode === 'select'` (lines 497–525). After this `BulkAddSheet.tsx` is only the orchestrator.

- [ ] **Step 1: Wire, post-split cleanup, stabilize handlers**

- [ ] **Step 2: Final QA**

All four modes + mode switching from select → voice/text/screenshot → review → save.

- [ ] **Step 3: Commit**

```bash
git add src/components/bulk-add/ReviewMode.tsx src/components/bulk-add/SelectMode.tsx src/components/BulkAddSheet.tsx
git commit -m "refactor(mobile): extract BulkAddSheet ReviewMode and SelectMode; finalize split"
```

---

## Part E — Cross-Cutting Fixes (Day 5–6)

### Task E1: Debounce the subscriptions list search

**Files:**
- Modify: `app/(tabs)/subscriptions.tsx`

- [ ] **Step 1: Replace direct store write with local state + debounced push**

In `app/(tabs)/subscriptions.tsx` (around lines 131–134):

```tsx
// BEFORE:
const searchQuery = useSubscriptionsStore((s) => s.searchQuery);
const setSearchQuery = useSubscriptionsStore((s) => s.setSearchQuery);
// <TextInput value={searchQuery} onChangeText={setSearchQuery} />

// AFTER:
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
// ...
const setStoreQuery = useSubscriptionsStore((s) => s.setSearchQuery);
const [localQuery, setLocalQuery] = useState(useSubscriptionsStore.getState().searchQuery);
const debouncedQuery = useDebouncedValue(localQuery, 300);
useEffect(() => { setStoreQuery(debouncedQuery); }, [debouncedQuery, setStoreQuery]);
// <TextInput value={localQuery} onChangeText={setLocalQuery} />
```

- [ ] **Step 2: Replace the search TextInput with `DoneAccessoryInput`**

- [ ] **Step 3: Type-check + manual QA**

Type fast into the search box. Verify FlatList updates smoothly 300ms after last keystroke; no per-keystroke re-render of the whole list.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/subscriptions.tsx
git commit -m "perf(mobile): debounce subscriptions search by 300ms"
```

---

### Task E2: Memoize `SubscriptionCard` row

**Files:**
- Modify: `src/components/SubscriptionCard.tsx`

- [ ] **Step 1: Verify current memo state**

Run: `grep -n "React.memo\|memo(" src/components/SubscriptionCard.tsx`

If not already wrapped in `memo`, wrap the default export:

```tsx
export default memo(SubscriptionCard);
```

Ensure the card's `onPress`, `onSwipe`, etc. are stable via `useCallback` in the parent (`app/(tabs)/subscriptions.tsx`).

- [ ] **Step 2: Stabilize callbacks in the parent**

In the consumer, wrap handlers used per-row in `useCallback`.

- [ ] **Step 3: Commit**

```bash
git add src/components/SubscriptionCard.tsx app/\(tabs\)/subscriptions.tsx
git commit -m "perf(mobile): memoize SubscriptionCard and stabilize row callbacks"
```

---

### Task E3: Sweep remaining text inputs for `DoneAccessoryInput`

**Files:**
- Modify: `app/edit-profile.tsx`
- Modify: `app/onboarding.tsx`
- Modify: `app/cards/index.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/(tabs)/workspace.tsx`
- Modify: `src/components/TranscriptionConfirm.tsx`
- Modify: `src/components/DeleteAccountConfirm.tsx`
- Modify: `src/components/InlineConfirmCard.tsx`
- Modify: `src/components/CountryPicker.tsx`
- Modify: `src/components/CurrencyPicker.tsx`
- Modify: `src/components/EditSubscriptionSheet.tsx`

- [ ] **Step 1: Grep for remaining `<TextInput`**

Run: `grep -rn "<TextInput" --include="*.tsx" app src/components | grep -v DoneAccessoryInput | grep -v NumericInput`

- [ ] **Step 2: Replace each with `<DoneAccessoryInput>`**

For each occurrence, replace the JSX tag. Keep all existing props; add `import { DoneAccessoryInput } from '...'`.

Do NOT replace: `TextInput` imported from `react-native` inside `DoneAccessoryInput.tsx` itself, or inside test files.

- [ ] **Step 3: Type-check + manual smoke test**

- Open edit-profile → type in display name, email → Done accessory visible.
- Open onboarding → proceed through language / currency / country pickers.
- Open cards → name a card.

- [ ] **Step 4: Commit (may need multiple commits by file group)**

```bash
git add app/edit-profile.tsx app/onboarding.tsx app/cards/index.tsx "app/(tabs)/settings.tsx" "app/(tabs)/workspace.tsx"
git commit -m "refactor(mobile): use DoneAccessoryInput across app/ inputs"

git add src/components/TranscriptionConfirm.tsx src/components/DeleteAccountConfirm.tsx src/components/InlineConfirmCard.tsx src/components/CountryPicker.tsx src/components/CurrencyPicker.tsx src/components/EditSubscriptionSheet.tsx
git commit -m "refactor(mobile): use DoneAccessoryInput across component inputs"
```

---

### Task E4: Verify all modal `ScrollView`s have proper keyboard props

**Files:**
- Audit: every `ScrollView` inside a `Modal` or sheet component.

- [ ] **Step 1: Grep audit**

Run: `grep -rn "ScrollView" --include="*.tsx" src/components app`

For each hit inside a modal/sheet, verify presence of all four:
- `keyboardShouldPersistTaps="handled"`
- `keyboardDismissMode="interactive"`
- `automaticallyAdjustKeyboardInsets`
- `contentInsetAdjustmentBehavior="automatic"`

- [ ] **Step 2: Add any missing props**

Edit each file that's missing props.

- [ ] **Step 3: Commit**

```bash
git add <changed files>
git commit -m "fix(mobile): ensure all modal ScrollViews auto-scroll to focused input"
```

---

## Part F — Final Sweep (Day 6)

### Task F1: Line-count sanity check

- [ ] **Step 1: Verify sizes**

Run:
```bash
wc -l src/components/AddSubscriptionSheet.tsx src/components/AIWizard.tsx src/components/BulkAddSheet.tsx src/components/EditSubscriptionSheet.tsx
```

Expected:
- `AddSubscriptionSheet.tsx`: ≤ 500
- `AIWizard.tsx`: ≤ 400
- `BulkAddSheet.tsx`: ≤ 300
- `EditSubscriptionSheet.tsx`: unchanged (~550)

If any file is still large, review whether more extraction is warranted. (It's acceptable if the orchestrator retains complex state-machine logic — but pure JSX should be in sub-components.)

---

### Task F2: Performance sanity check in iOS simulator

- [ ] **Step 1: Profile with Xcode Instruments (Time Profiler or CPU)**

1. `npm run start:dev`
2. Open iOS simulator. Attach Instruments → Time Profiler.
3. Open Add sheet → tap manual form → type "Netflix" rapidly.
4. Observe CPU: expected ≤ 20% sustained, no multi-hundred-ms main-thread blocks.
5. Repeat for AIWizard bulk-edit.
6. Repeat for BulkAddSheet text mode.

If any mode still spikes > 30%, investigate: `<Profiler>` component or `why-did-you-render`.

- [ ] **Step 2: Record findings in the plan file** (add a "Results" section at the bottom)

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-04-23-mobile-perf-audit.md
git commit -m "docs: record perf verification results"
```

---

### Task F3: Android smoke test

- [ ] **Step 1: Launch Android emulator**

Run: `npm run start:dev` → press `a`.

- [ ] **Step 2: Verify KAV behavior**

All modals: open → tap input → keyboard doesn't cover field. Android uses `behavior="height"`, so there may be slight visual differences from iOS — acceptable as long as inputs stay visible.

- [ ] **Step 3: If regressions, fix by adjusting `keyboardVerticalOffset` on `KeyboardAwareModal` consumers**

---

### Task F4: Type-check + test suite

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: all green (including the new `DoneAccessoryInput` and `useDebouncedValue` tests).

- [ ] **Step 3: If failures, fix in-place and commit before closing out**

---

### Task F5: Final documentation

- [ ] **Step 1: Append a short note to the spec**

Add to `docs/superpowers/specs/2026-04-23-mobile-perf-audit-design.md` a final "Implementation" section linking to the plan file and summarizing the delivered commits (via `git log --oneline`).

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-23-mobile-perf-audit-design.md
git commit -m "docs: link implementation results to spec"
```

---

## Appendix — Ready-to-Run Grep Commands

```bash
# Find all TextInput still not using DoneAccessoryInput
grep -rn "<TextInput" --include="*.tsx" app src/components | grep -v "primitives/DoneAccessoryInput.tsx"

# Find all ScrollView missing keyboardShouldPersistTaps
grep -rn "ScrollView" --include="*.tsx" src/components app | xargs -I {} sh -c 'grep -L keyboardShouldPersistTaps "{}" 2>/dev/null'

# Check final line counts
wc -l src/components/AddSubscriptionSheet.tsx src/components/AIWizard.tsx src/components/BulkAddSheet.tsx

# Verify no NumericInput leaks outside the shim
grep -rn "from '../NumericInput'\|from './NumericInput'" --include="*.tsx" src app
```
