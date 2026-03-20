import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface CategoryIconProps { size?: number; color?: string; }
export const StreamingIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#E53935' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Streaming">
    <Rect x="2" y="3" width="20" height="14" rx="2" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M8 21h8M12 17v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M10 8l4 2.5-4 2.5V8z" fill={color} />
  </Svg>
);
