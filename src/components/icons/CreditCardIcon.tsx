import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const CreditCardIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Credit Card">
    <Rect x="2" y="4" width="20" height="16" rx="3" stroke={color} strokeWidth="1.8" />
    <Path d="M2 10h20M6 15h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
