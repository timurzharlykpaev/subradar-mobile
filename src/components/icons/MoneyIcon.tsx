import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const MoneyIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Price">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
    <Path d="M12 6v12M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
