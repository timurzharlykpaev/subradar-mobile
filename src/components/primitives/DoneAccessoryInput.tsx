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
