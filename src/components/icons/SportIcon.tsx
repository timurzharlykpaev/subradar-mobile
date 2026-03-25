import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const SportIcon: React.FC<IconProps> = ({ size = 20, color = '#F97316' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Sport">
    <Circle cx="12" cy="5" r="3" stroke={color} strokeWidth="1.8" />
    <Path d="M6 20l3-7 3 3 3-3 3 7M12 11v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
