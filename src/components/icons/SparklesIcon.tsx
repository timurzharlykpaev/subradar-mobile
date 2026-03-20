import React from 'react';
import Svg, { Path } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const SparklesIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="AI">
    <Path d="M9 2l1.5 5L15 9l-4.5 2L9 16l-1.5-5L3 9l4.5-2L9 2z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity={0.15} strokeLinejoin="round" />
    <Path d="M18 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity={0.15} strokeLinejoin="round" />
  </Svg>
);
