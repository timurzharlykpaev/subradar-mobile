import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const ClipboardIcon: React.FC<IconProps> = ({ size = 20, color = '#9CA3AF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Clipboard">
    <Rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M9 3V2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M9 10h6M9 14h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
