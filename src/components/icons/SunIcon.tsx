import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const SunIcon: React.FC<IconProps> = ({ size = 20, color = '#F59E0B' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Light mode">
    <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.8" />
    <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
