import React from 'react';
import { View, ViewStyle } from 'react-native';

let LG: any = View;
try {
  LG = require('expo-linear-gradient').LinearGradient;
} catch {}

interface Props {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
  testID?: string;
  [key: string]: any;
}

/**
 * LinearGradient with fallback to View (uses first color as backgroundColor).
 * Prevents crash in Expo Go where native module is unavailable.
 */
export function SafeLinearGradient({ colors, start, end, style, children, ...rest }: Props) {
  if (LG === View || !LG) {
    // Fallback: use first gradient color as solid bg
    const fallbackStyle = Array.isArray(style)
      ? [...style, { backgroundColor: colors[0] }]
      : [style, { backgroundColor: colors[0] }];
    return <View style={fallbackStyle} {...rest}>{children}</View>;
  }
  return (
    <LG colors={colors} start={start} end={end} style={style} {...rest}>
      {children}
    </LG>
  );
}
