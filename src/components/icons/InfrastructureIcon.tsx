import React from 'react';
import Svg, { Path } from 'react-native-svg';
interface CategoryIconProps { size?: number; color?: string; }
export const InfrastructureIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#039BE5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Infrastructure">
    <Path d="M6.5 19a4.5 4.5 0 0 1-.42-8.98A7 7 0 0 1 19.5 11a4.5 4.5 0 0 1-.08 8.96" stroke={color} strokeWidth="1.8" fill={color + '20'} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
