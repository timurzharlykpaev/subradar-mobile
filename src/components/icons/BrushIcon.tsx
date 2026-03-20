import React from 'react';
import Svg, { Path } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const BrushIcon: React.FC<IconProps> = ({ size = 20, color = '#A259FF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Brush">
    <Path d="M18 2l4 4-9.5 9.5a4 4 0 0 1-3 1.2L8 17l.3-1.5a4 4 0 0 1 1.2-3L18 2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M8 17c-2 0-4 1-4 4h4c3 0 4-2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
