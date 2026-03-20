import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const GiftIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Gift">
    <Rect x="3" y="11" width="18" height="10" rx="2" stroke={color} strokeWidth="1.8" />
    <Rect x="2" y="7" width="20" height="4" rx="1" stroke={color} strokeWidth="1.8" />
    <Path d="M12 7v14M7.5 7C6 7 5 5.5 5.5 4.5S7.5 3 9 4l3 3M16.5 7c1.5 0 2.5-1.5 2-2.5S14.5 3 15 4l-3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
