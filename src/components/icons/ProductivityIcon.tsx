import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface CategoryIconProps { size?: number; color?: string; }
export const ProductivityIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#1E88E5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Productivity">
    <Rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M8 10l2 2 4-4M8 16h8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
