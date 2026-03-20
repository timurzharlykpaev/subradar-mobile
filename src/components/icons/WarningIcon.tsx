import React from 'react';
import Svg, { Path } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const WarningIcon: React.FC<IconProps> = ({ size = 20, color = '#F59E0B' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Warning">
    <Path d="M12 2L2 20h20L12 2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M12 10v4M12 17v.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);
