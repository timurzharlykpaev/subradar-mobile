import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface CategoryIconProps { size?: number; color?: string; }
export const NewsIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#00ACC1' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="News">
    <Rect x="2" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M18 7h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M6 7h8M6 11h4M6 15h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);
