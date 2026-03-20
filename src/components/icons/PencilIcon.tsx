import React from 'react';
import Svg, { Path } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const PencilIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Edit">
    <Path d="M17 3l4 4L7 21H3v-4L17 3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M14 6l4 4" stroke={color} strokeWidth="1.8" />
  </Svg>
);
