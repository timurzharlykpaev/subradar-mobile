import React, { useRef } from 'react';
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
import { useTheme } from '../theme';

const ACCESSORY_ID = 'numeric-input-done';

interface Props extends TextInputProps {
  /** Unique ID for InputAccessoryView (defaults to shared ID) */
  accessoryId?: string;
}

/**
 * TextInput with "Done" toolbar on iOS for numeric keyboards
 * (decimal-pad, number-pad don't have a return/done key)
 */
export function NumericInput({ accessoryId, style, ...props }: Props) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const id = accessoryId || ACCESSORY_ID;

  return (
    <>
      <TextInput
        ref={inputRef}
        style={style}
        inputAccessoryViewID={Platform.OS === 'ios' ? id : undefined}
        {...props}
      />
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={id}>
          <View style={[styles.toolbar, { backgroundColor: colors.surface2, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => inputRef.current?.blur()}
            >
              <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
}

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
