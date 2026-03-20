import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface CategoryIconProps { size?: number; color?: string; }
export const OtherIcon: React.FC<CategoryIconProps> = ({ size = 24, color = '#757575' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Other">
    <Path d="M12 2l10 5v4H2V7l10-5z" stroke={color} strokeWidth="1.8" fill={color + '20'} strokeLinejoin="round" />
    <Rect x="2" y="11" width="20" height="11" rx="1" stroke={color} strokeWidth="1.8" fill={color + '20'} />
    <Path d="M12 2v9M2 7l10 4 10-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);
