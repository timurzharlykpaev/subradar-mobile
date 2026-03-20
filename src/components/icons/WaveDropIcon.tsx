import React from 'react';
import Svg, { Path } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const WaveDropIcon: React.FC<IconProps> = ({ size = 20, color = '#0080FF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="DigitalOcean">
    <Path d="M12 2C7 2 3 7 3 12s4 8 9 8v-5H8v-3h4V9h3v3h3v4h-4v5c5-1 8-5 8-9s-5-10-10-10z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
  </Svg>
);
