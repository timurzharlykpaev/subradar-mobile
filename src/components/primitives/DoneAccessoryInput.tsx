import React, { forwardRef, useRef, useImperativeHandle, useId } from 'react';
import {
  TextInput,
  InputAccessoryView,
  View,
  TouchableOpacity,
  Text,
  Platform,
  StyleSheet,
  Keyboard,
  type TextInputProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';

export interface DoneAccessoryInputProps extends TextInputProps {
  /**
   * Unique accessory ID. Defaults to a per-instance unique value generated
   * via `useId()`. The previous shared-ID default rendered N copies of
   * `<InputAccessoryView nativeID="done-accessory">` on a form with N
   * inputs — iOS' input system collapsed them into a single session and
   * invalidated the cursor session on every focus change ("RTI: perform
   * input operation requires a valid sessionID"). Each input must own
   * its own accessory view.
   */
  accessoryId?: string;
  /** Show the iOS Done toolbar. Defaults to true. */
  showDoneAccessory?: boolean;
}

/**
 * TextInput that always ships a high-contrast iOS "Done" keyboard accessory.
 *
 * NumericInput is a compatibility shim around this component; prefer this
 * primitive directly in new code.
 *
 * NOTE: do NOT wrap this in `React.memo` — the combination
 * `memo(forwardRef(...))` rendered inside another forwardRef shim
 * (NumericInput) breaks React Fabric's `getComponentNameFromFiber` during
 * error logging (`type.render` is read on the wrong fiber and throws
 * "Cannot read property 'displayName' of undefined"), masking the original
 * error and crashing the surface. The keystroke perf win we expected from
 * this memo turned out to be tiny — the real gains come from the parent's
 * stable callbacks + memoized styles + ThemeContext.value memo.
 */
export const DoneAccessoryInput = forwardRef<TextInput, DoneAccessoryInputProps>(function DoneAccessoryInput(
  { accessoryId, showDoneAccessory = true, keyboardAppearance, ...props },
  ref,
) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const innerRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => innerRef.current!, []);

  // useId() gives every instance a stable, render-stable, unique ID — fixes
  // the iOS sessionID invalidation that happened when N inputs shared one
  // nativeID. Caller can still pass an explicit `accessoryId` to opt out.
  const autoId = useId();
  const id = accessoryId ?? autoId;
  const shouldAttach = Platform.OS === 'ios' && showDoneAccessory;

  // Default to a dark keyboard so the system shell matches the app's
  // dark surface. Caller can override per-input.
  const effectiveAppearance =
    keyboardAppearance ?? (isDark ? 'dark' : 'light');

  return (
    <>
      <TextInput
        ref={innerRef}
        inputAccessoryViewID={shouldAttach ? id : undefined}
        keyboardAppearance={effectiveAppearance}
        {...props}
      />
      {shouldAttach && (
        <InputAccessoryView nativeID={id}>
          <View
            style={[
              styles.toolbar,
              {
                // Slightly stronger surface than `colors.background` so the
                // toolbar stands clearly above the keyboard instead of
                // blending in. `surface2` falls back to `surface` for themes
                // that don't define it.
                backgroundColor: (colors as any).surface2 ?? colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={() => Keyboard.dismiss()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.done', 'Done')}
            >
              <Text style={[styles.doneText, { color: '#FFFFFF' }]}>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
