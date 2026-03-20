import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const PlayIcon: React.FC<IconProps> = ({ size = 20, color = '#FF0000' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Play">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
    <Path d="M10 8l6 4-6 4V8z" fill={color} />
  </Svg>
);
