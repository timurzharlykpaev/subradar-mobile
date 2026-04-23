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
  /**
   * Wrap content in a ScrollView. Default true.
   * Set false if your content has its own FlatList/ScrollView — remember to
   * set `keyboardShouldPersistTaps="handled"` on it, otherwise buttons need
   * two taps while the keyboard is up.
   */
  scrollable?: boolean;
  /** Dismiss keyboard on tap outside inputs. Default true. */
  dismissOnTapOutside?: boolean;
  /**
   * keyboardVerticalOffset passed to KeyboardAvoidingView (both platforms).
   * Pass the height of any fixed chrome above the scrollable area (header,
   * drag handle). Wrong value = last input clipped by keyboard. Rule of
   * thumb: pageSheet modal + 56pt header → offset ~56. Fullscreen no
   * header → 0.
   */
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
