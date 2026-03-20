import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
interface CategoryIconProps { size?: number; color?: string; }
export const AiServicesIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#8E24AA' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="AI Services">
    <Path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.2 6H8.2C6.3 13.7 5 11.5 5 9a7 7 0 0 1 7-7z" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M9 22h6M10 19h4M9 15h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="10" cy="9" r="1" fill={color} />
    <Circle cx="14" cy="9" r="1" fill={color} />
  </Svg>
);
