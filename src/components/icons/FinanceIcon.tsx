import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const FinanceIcon: React.FC<IconProps> = ({ size = 20, color = '#22C55E' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Finance">
    <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M2 10h20M6 15h4M14 15h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
