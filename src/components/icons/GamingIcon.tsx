import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
interface CategoryIconProps { size?: number; color?: string; }
export const GamingIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#43A047' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Gaming">
    <Path d="M2 12a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v0a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6v0z" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M6 11h4M8 9v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="15" cy="10" r="1" fill={color} />
    <Circle cx="18" cy="12" r="1" fill={color} />
  </Svg>
);
