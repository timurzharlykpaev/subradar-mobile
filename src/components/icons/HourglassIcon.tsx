import React from 'react';
import Svg, { Path } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const HourglassIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Loading">
    <Path d="M5 3h14M5 21h14M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
