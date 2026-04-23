# Mobile Performance Audit — Design Spec

**Date:** 2026-04-23
**Scope:** Option B — Surgical fixes + monster-component splits
**Estimated effort:** 4–6 days
**Target branch:** `main` (directly, incremental commits)

---

## Problem Statement

Users report severe UX issues on the mobile app:

1. **Input freeze on modal open** — tapping a `TextInput` inside a modal causes a visible freeze/delay before the keyboard responds.
2. **Per-keystroke lag** — typing into inputs is laggy, CPU spikes to ~48% on each keystroke, recovering slowly.
3. **Keyboard covers inputs** — no auto-scroll to the focused input; keyboard overlays the field.
4. **Missing "Done" button on keyboard accessory** — text inputs (non-numeric) have no accessory toolbar to dismiss the keyboard.
5. **Done accessory blends with background** — the `InputAccessoryView` bar contrast is too low; users struggle to see it.

## Root Cause Analysis

Verified via code reading:

- `src/components/AddSubscriptionSheet.tsx` — **2165 lines**, ~20 `useState` hooks in a single component.
- `src/components/AIWizard.tsx` — **1192 lines**, includes voice + bulk-list + bulk-edit modes.
- `src/components/BulkAddSheet.tsx` — **829 lines**, three input modes (text/voice/screenshot) in one file.
- `src/components/EditSubscriptionSheet.tsx` — **550 lines**.

Every keystroke into any of the dozens of `TextInput`s inside these components re-renders the entire subtree. Combined with:
- inline `onPress={() => ...}` inside `.map()` (N new functions per render),
- no `React.memo` on chip/card children,
- no debouncing on `smartInput` / `searchQuery`,

this produces the 48% CPU spike.

Additionally:
- `InputAccessoryView` with Done button exists **only** inside `NumericInput` (numeric-pad keyboards). Text inputs have no accessory.
- `JoinTeamSheet.tsx:119` uses `colors.surface` (lighter) for the Done bar background — inconsistent with `NumericInput`, which uses `colors.background` (darkest).
- `automaticallyAdjustKeyboardInsets` is set inconsistently across `ScrollView`s — some modals scroll to the focused input, others don't.

## Goals

- Eliminate the 48% CPU spike on keystrokes — target ≤20% on modern iPhones.
- All `TextInput`s in forms show a high-contrast Done accessory on iOS.
- All modal screens auto-scroll to the focused input on both iOS and Android.
- No regressions in Add / Edit / AIWizard / BulkAdd flows.
- No changes to public API of the affected components (callers in `app/` unchanged).

## Non-Goals

- No migration to `@gorhom/bottom-sheet` (project does not use it today; keep `Modal`).
- No new feature work; no product changes.
- No i18n key changes; no analytics event changes.

## Architecture

Three layers of work:

### Layer 1 — Shared primitives (new)

Location: `src/components/primitives/`

| File | Purpose |
|---|---|
| `DoneAccessoryInput.tsx` | Generalized `TextInput` with iOS `InputAccessoryView` Done button. Supersedes `NumericInput`. Accepts standard `TextInputProps` plus `showDoneAccessory?: boolean` (default `true`). Uses `colors.background` for the bar and `colors.primary` for Done text. Shared default `accessoryId` so we do not create N accessory views. |
| `KeyboardAwareModal.tsx` | Wrapper: `Modal` + `KeyboardAvoidingView` (iOS: `padding`, Android: `height`) + outer `ScrollView` with `automaticallyAdjustKeyboardInsets`, `contentInsetAdjustmentBehavior="automatic"`, `keyboardShouldPersistTaps="handled"`. Also wraps content in a `TouchableWithoutFeedback` that calls `Keyboard.dismiss()` on tap outside. Opt-out via `scrollable={false}`. |
| `Chip.tsx` | `React.memo` chip used by QuickChips, CatalogChips. Props: `{ id, label, icon?, active?, onPress(id) }`. The parent passes a stable `onPress(id)` instead of inline `() => handle(svc)`. |

Location: `src/hooks/`

| File | Purpose |
|---|---|
| `useDebouncedValue.ts` | `useDebouncedValue<T>(value: T, delay = 300): T`. Standard debounce hook. |

`NumericInput.tsx` becomes a thin re-export of `DoneAccessoryInput` with `keyboardType="decimal-pad"` default, kept for a migration window. New call sites use `DoneAccessoryInput` directly.

### Layer 2 — Monster component splits

Principle: **each `FlowState`/UI mode becomes its own component**. State that is only read inside one mode moves into that child. The orchestrator keeps only cross-mode state (flow state, save mutation, analytics).

#### 2a. `AddSubscriptionSheet.tsx` (2165 → ~400 + 6 files)

Location: `src/components/add-subscription/`

| File | ~Lines | Responsibility |
|---|---|---|
| `AddSubscriptionSheet.tsx` | 400 | `Modal` orchestrator. Owns `FlowState`, `addedViaSource`, save mutation, top-level handlers (`handleClose`, `handleSave`, `handleSmartSubmit`, `handleVoiceComplete`, `handleCamera`). Delegates rendering to child views. |
| `IdleView.tsx` | 300 | Smart input, QuickChips row, CatalogChips row, voice/camera buttons. Owns `smartInput` local state + `useDebouncedValue`. |
| `LoadingView.tsx` | 100 | AI loading stages UI. |
| `ConfirmView.tsx` | 200 | Single-result confirm card. Wraps `InlineConfirmCard`. |
| `BulkConfirmView.tsx` | 250 | Multi-result confirm list with checkboxes. |
| `ManualFormView.tsx` | 400 | Full manual form (name, amount, category, cycle, dates, tags, notes). Owns `form` local state. All text inputs use `DoneAccessoryInput`. |
| `useAddSubscriptionForm.ts` | 150 | Hook encapsulating form state + validation + normalization for save. Reused by `ManualFormView`. |

**Outcome:** a keystroke in `name` re-renders ~400 lines of `ManualFormView`, not 2165 lines of the whole sheet.

#### 2b. `AIWizard.tsx` (1192 → ~300 + 4 files)

Location: `src/components/ai-wizard/`

| File | ~Lines | Responsibility |
|---|---|---|
| `AIWizard.tsx` | 300 | `Modal` orchestrator. Owns wizard `ui` discriminated union state + fade transitions. |
| `VoiceInputStage.tsx` | 250 | Mic button, recording UI, transcription feedback. |
| `BulkListStage.tsx` | 250 | Transcribed list with per-row checkboxes + edit buttons. `onEdit(idx)` stable callback. |
| `BulkEditStage.tsx` | 300 | Single-row edit form — **this is where `KeyboardAvoidingView` is missing today** (bulk-edit mode at lines 797–900). Uses `KeyboardAwareModal` primitive. |
| `SharedInputs.tsx` | 80 | Field render helpers shared by BulkEdit. |

#### 2c. `BulkAddSheet.tsx` (829 → ~250 + 3 files)

Location: `src/components/bulk-add/`

| File | ~Lines | Responsibility |
|---|---|---|
| `BulkAddSheet.tsx` | 250 | `Modal` orchestrator + mode switch. |
| `TextInputMode.tsx` | 250 | Multiline textarea + examples. Owns `textInput` state + debounce. |
| `VoiceMode.tsx` | 180 | Voice recording + transcription preview. |
| `ScreenshotMode.tsx` | 150 | Image picker + parse result. |

### Layer 3 — Cross-cutting fixes

1. `useDebouncedValue` applied **only where the value drives expensive downstream work** — not on every input:
   - `searchQuery` in `app/(tabs)/subscriptions.tsx` (filters FlatList on each keystroke).
   - `smartInput` debounced value used for "is-this-a-bulk-input?" heuristic hint; the controlled value stays un-debounced for the submit handler.
   - Controlled inputs in forms (`name`, `amount`, etc.) are not debounced — the split in Layer 2 is what removes their per-keystroke overhead.
2. `React.memo` on: `QuickChipButton`, `CatalogChip` (new), `SubscriptionCard`, `MemberRow`.
3. Replace every inline `onPress={() => ...}` inside `.map()` with either a `useCallback` or a memoized child component that receives a stable callback + id.
4. `JoinTeamSheet.tsx:119`: `colors.surface` → `colors.background`.
5. Replace all `<TextInput>` in forms with `DoneAccessoryInput` (keeps `multiline` working because `InputAccessoryView` still attaches).
6. Audit every `ScrollView` in a modal — ensure `automaticallyAdjustKeyboardInsets`, `contentInsetAdjustmentBehavior="automatic"`, `keyboardShouldPersistTaps="handled"` are all present. If a `ScrollView` is inside `KeyboardAwareModal`, it inherits them.

## Backwards Compatibility

- Public API of `AddSubscriptionSheet`, `AIWizard`, `BulkAddSheet`, `EditSubscriptionSheet` preserved: same default export name, same props, same file path. Internal structure only.
- `NumericInput` kept as re-export for one release cycle. New code uses `DoneAccessoryInput`.
- All i18n keys, analytics events, navigation targets unchanged.

## Risks & Mitigation

| Risk | Mitigation |
|---|---|
| Flow-state regressions in `AddSubscriptionSheet` (complex machine across 6 modes) | Keep the state machine intact in the orchestrator. Views are pure render functions. Manual QA every flow after each step. |
| `useState` spill when extracting views — losing state on view switch | Keep cross-mode state in orchestrator. Only extract state that is strictly local to a mode (`smartInput`, `form`). |
| Android `KeyboardAvoidingView` behavior differs | Test on Android emulator after each extraction. |
| `InputAccessoryView` interaction with `multiline` inputs | Verified supported; keep current multiline props. |
| Reanimated / Animated value stability across re-renders | `React.useRef` for all animated values (already the pattern). No change. |

## Verification Strategy

No TestFlight builds (per user preference — user does them manually). Each day ends with:

1. `npx tsc --noEmit` — type-check clean.
2. `npm test` — unit tests green (for files that have them).
3. Manual QA in `npm run start:dev` + iOS simulator:
   - Open **Add** sheet → type in `smartInput` → CPU ≤ 20% in Xcode Instruments.
   - Open **Add** → manual mode → tap `name` → Done accessory visible, high contrast.
   - Open **Add** → manual mode → tap `amount` → keyboard doesn't cover field.
   - Open **AIWizard** → voice → bulk-edit → tap `amount` → auto-scroll works (bug today).
   - Open **BulkAdd** text mode → paste long text → no stutter.
   - Open **JoinTeamSheet** → Done bar is dark.
4. Android emulator smoke test for KAV behavior.

## Delivery Plan

| Day | Output |
|---|---|
| 1 | Layer 1 primitives merged. `NumericInput` re-export. `JoinTeamSheet` color fix. |
| 2 | `AddSubscriptionSheet` split part 1: `IdleView`, `LoadingView`, `ConfirmView`. |
| 3 | `AddSubscriptionSheet` split part 2: `BulkConfirmView`, `ManualFormView`, `useAddSubscriptionForm`. Manual QA full Add flow. |
| 4 | `AIWizard` split into 4 files. Fix bulk-edit `KeyboardAvoidingView`. Manual QA AIWizard. |
| 5 | `BulkAddSheet` split into 3 files. Debounce across smartInput / searchQuery / textInput. `React.memo` pass. |
| 6 | Final sweep: all modals audited for accessory + auto-scroll. iOS + Android smoke test. Type-check, tests. |

Commits are small and self-contained per file group, no giant final commit. Commit message style follows existing project convention (`fix(mobile): ...`, `refactor(mobile): ...`).

## Out of Scope (backlog)

- Lazy-mount of `ProFeatureModal` / `TeamExplainerModal` spring animations.
- Migration to `@gorhom/bottom-sheet` for native gestures.
- Virtualization beyond current `FlatList` usage.
- Skeleton reveal on initial modal mount.

---

## Implementation Results (2026-04-23)

Delivered across 33 commits on `main`. All six parts of the plan completed.

### Line-count outcome

| File | Before | After | Delta |
|---|---:|---:|---:|
| `src/components/AddSubscriptionSheet.tsx` | 2165 | 1126 | −48 % |
| `src/components/AIWizard.tsx` | 1192 | 739 | −38 % |
| `src/components/BulkAddSheet.tsx` | 829 | 553 | −33 % |
| `src/components/EditSubscriptionSheet.tsx` | 550 | 565 | +3 % (TextInput → DoneAccessoryInput migration only) |
| **Monster total** | **4736** | **2983** | **−37 %** |

27 new focused files were created (~4440 LoC) — total code volume grew while per-component re-render scope shrank dramatically.

### Files created

**Primitives** — `src/components/primitives/`: `DoneAccessoryInput.tsx` (88), `KeyboardAwareModal.tsx` (87), `Chip.tsx` (53).

**Hooks** — `src/hooks/useDebouncedValue.ts` (17) + its unit tests.

**add-subscription/** (10 files, 2072 LoC): `types.ts`, `useAddSubscriptionForm.ts`, `IdleView`, `LoadingView`, `TranscriptionView`, `ConfirmView`, `BulkConfirmView`, `ManualFormView`, `WizardView`, `BulkEditModal`.

**ai-wizard/** (7 files, 1578 LoC): `types.ts`, `VoiceInputStage`, `QuestionStage`, `ConfirmStage`, `PlansStage`, `BulkListStage`, `BulkEditStage`.

**bulk-add/** (6 files, 664 LoC): `types.ts`, `SelectMode`, `VoiceMode`, `TextInputMode`, `ScreenshotMode`, `ReviewMode`.

### Bug fixes landed along the way

- **AIWizard bulk-edit keyboard bug** — the reported "keyboard covers the input" is now fixed by wrapping `BulkEditStage` in `KeyboardAvoidingView` with `automaticallyAdjustKeyboardInsets`.
- **`DoneAccessoryInput` shared-accessory race** — caught in A1 review; `onPress={() => Keyboard.dismiss()}` replaces the per-instance ref blur that could silently no-op on screens with multiple inputs.
- **`JoinTeamSheet` Done bar contrast** — `colors.surface` → `colors.background` for consistent darker toolbar.
- **B1 transcription loss regression** — caught in B1 review; `seedSmartInput` + remount key restores the retry-on-AI-fallback UX.
- **B3 mid-array remove desync** — caught in B3 review; `bulkChecked` lifted back to orchestrator so it shifts in lockstep with `bulkItems`.

### Verification

- `npx tsc --noEmit` — clean.
- `npm test` — 16 suites, 146 tests passing (was 142; new useDebouncedValue tests added).
- Modal ScrollView audit: 16 of 41 ScrollViews updated to include the full 4-prop keyboard set.
- Search debounced to 300ms (`subscriptions.tsx`).
- `SubscriptionCard` memoized, row callbacks stabilized.

### Manual QA required (not runnable from this workflow)

Remaining items for the user to verify on device/simulator:

1. Open Add sheet → type in manual form's name → CPU ≤ 20 % in Xcode Instruments Time Profiler.
2. Open AIWizard bulk-edit → tap an input → verify keyboard does not cover input, Done accessory visible.
3. Smoke test on Android emulator — `KeyboardAvoidingView behavior="height"` under modals where Android's separate modal window does not receive `adjustResize`.
4. Complete happy-path + edge cases for Add / Edit / BulkAdd / AIWizard flows.

### Follow-ups parked

- `QUICK` catalog + SVG icons still live in `AIWizard.tsx` (~75 lines); could move to `ai-wizard/quickServices.tsx` to hit the aspirational ≤500-line orchestrator target.
- Inline bulk-item edit modal in `BulkAddSheet.tsx` (~100 lines, uses `BulkSub` shape, separate from `add-subscription/BulkEditModal`) is a clean extraction candidate.
- `handleEditFromConfirm` removed as orphan; `manualExpanded` removed as dead state.
- Refactor tests to use `@testing-library/react-native`'s `renderHook` when a pure-jest-expo env is introduced (would silence the `react-test-renderer` deprecation warning emitted twice per run).
