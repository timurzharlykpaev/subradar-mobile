import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const OctopusIcon: React.FC<IconProps> = ({ size = 20, color = '#333' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="GitHub">
    <Circle cx="12" cy="10" r="7" stroke={color} strokeWidth="1.8" />
    <Path d="M5 14c-1 3 0 5 1 6M8 16c-1 3 0 5 1 5M12 17v4M16 16c1 3 0 5-1 5M19 14c1 3 0 5-1 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Circle cx="9.5" cy="9" r="1.2" fill={color} />
    <Circle cx="14.5" cy="9" r="1.2" fill={color} />
  </Svg>
);
