import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
interface IconProps { size?: number; color?: string; }
export const DesignIcon: React.FC<IconProps> = ({ size = 20, color = '#F472B6' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible accessibilityLabel="Design">
    <Path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2v-.5c0-.55.2-1.05.55-1.41.35-.37.85-.59 1.45-.59h1.5a4.5 4.5 0 0 0 4.5-4.5c0-5-4.03-9-9-9z" stroke={color} strokeWidth="1.8" />
    <Circle cx="7.5" cy="11" r="1.5" fill={color} />
    <Circle cx="11" cy="7" r="1.5" fill={color} />
    <Circle cx="15" cy="8" r="1.5" fill={color} />
  </Svg>
);
