import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const MovieIcon: React.FC<IconProps> = ({ size = 20, color = '#E53935' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Movie">
    <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M2 8l4-4M8 4l-4 4M22 8l-4-4M18 4l4 4M2 16l4 4M8 20l-4-4M22 16l-4 4M18 20l4-4" stroke={color} strokeWidth="1.2" />
    <Path d="M10 9l5 3-5 3V9z" fill={color} />
  </Svg>
);
