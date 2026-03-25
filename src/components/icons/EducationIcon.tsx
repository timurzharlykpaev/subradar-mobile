import React from 'react';
import Svg, { Path } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const EducationIcon: React.FC<IconProps> = ({ size = 20, color = '#F59E0B' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Education">
    <Path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
  </Svg>
);
