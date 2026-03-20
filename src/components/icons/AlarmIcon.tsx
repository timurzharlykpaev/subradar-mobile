import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const AlarmIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Alarm">
    <Circle cx="12" cy="13" r="8" stroke={color} strokeWidth="1.8" />
    <Path d="M12 9v4l2.5 2.5M4.5 4.5L7 7M19.5 4.5L17 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
