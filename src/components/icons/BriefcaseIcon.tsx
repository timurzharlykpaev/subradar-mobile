import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const BriefcaseIcon: React.FC<IconProps> = ({ size = 20, color = '#0A66C2' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Briefcase">
    <Rect x="2" y="7" width="20" height="14" rx="2" stroke={color} strokeWidth="1.8" />
    <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);
