import React from 'react';
import Svg, { Rect } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const ChartBarIcon: React.FC<IconProps> = ({ size = 20, color = '#D83B01' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Chart">
    <Rect x="3" y="12" width="4" height="9" rx="1" stroke={color} strokeWidth="1.8" />
    <Rect x="10" y="6" width="4" height="15" rx="1" stroke={color} strokeWidth="1.8" />
    <Rect x="17" y="3" width="4" height="18" rx="1" stroke={color} strokeWidth="1.8" />
  </Svg>
);
