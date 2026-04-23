/**
 * @deprecated Use DoneAccessoryInput directly.
 *
 * Kept as a compatibility shim during migration. Defaults to the decimal-pad
 * keyboard so existing call sites do not need to pass keyboardType.
 */
import React from 'react';
import type { TextInput } from 'react-native';
import { DoneAccessoryInput, type DoneAccessoryInputProps } from './primitives/DoneAccessoryInput';

export const NumericInput = React.forwardRef<TextInput, DoneAccessoryInputProps>(function NumericInput(
  props,
  ref,
) {
  return (
    <DoneAccessoryInput
      ref={ref}
      keyboardType={props.keyboardType ?? 'decimal-pad'}
      {...props}
    />
  );
});
