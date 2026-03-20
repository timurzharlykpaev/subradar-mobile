import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
interface CategoryIconProps { size?: number; color?: string; }
export const MusicIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#8E24AA' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Music">
    <Circle cx="7" cy="18" r="3" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Circle cx="17" cy="16" r="3" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M10 18V5l10-2v13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
