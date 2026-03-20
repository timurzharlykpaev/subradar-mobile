import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const GlobeIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Globe">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
    <Path d="M2 12h20M12 2a16 16 0 0 1 4 10 16 16 0 0 1-4 10 16 16 0 0 1-4-10A16 16 0 0 1 12 2z" stroke={color} strokeWidth="1.8" />
  </Svg>
);
