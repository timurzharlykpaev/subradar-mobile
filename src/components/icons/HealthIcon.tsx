import React from 'react';
import Svg, { Path } from 'react-native-svg';
interface CategoryIconProps { size?: number; color?: string; }
export const HealthIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#FB8C00' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Health">
    <Path d="M12 21s-7-5.5-7-10.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 7 4.5C19 15.5 12 21 12 21z" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M8 13h2l1-2 2 4 1-2h2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
