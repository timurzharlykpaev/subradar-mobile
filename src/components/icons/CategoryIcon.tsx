import React from 'react';
import { CATEGORIES } from '../../constants';
import { StreamingIcon } from './StreamingIcon';
import { AiServicesIcon } from './AiServicesIcon';
import { InfrastructureIcon } from './InfrastructureIcon';
import { MusicIcon } from './MusicIcon';
import { GamingIcon } from './GamingIcon';
import { ProductivityIcon } from './ProductivityIcon';
import { HealthIcon } from './HealthIcon';
import { NewsIcon } from './NewsIcon';
import { OtherIcon } from './OtherIcon';
import { EducationIcon } from './EducationIcon';
import { FinanceIcon } from './FinanceIcon';
import { DesignIcon } from './DesignIcon';
import { SecurityIcon } from './SecurityIcon';
import { DeveloperIcon } from './DeveloperIcon';
import { SportIcon } from './SportIcon';
import { BusinessIcon } from './BusinessIcon';

const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  STREAMING: StreamingIcon,
  AI_SERVICES: AiServicesIcon,
  INFRASTRUCTURE: InfrastructureIcon,
  DEVELOPER: DeveloperIcon,
  PRODUCTIVITY: ProductivityIcon,
  MUSIC: MusicIcon,
  GAMING: GamingIcon,
  EDUCATION: EducationIcon,
  FINANCE: FinanceIcon,
  DESIGN: DesignIcon,
  SECURITY: SecurityIcon,
  HEALTH: HealthIcon,
  SPORT: SportIcon,
  NEWS: NewsIcon,
  BUSINESS: BusinessIcon,
  OTHER: OtherIcon,
};

interface Props {
  category: string;
  size?: number;
}

export const CategoryIcon: React.FC<Props> = ({ category, size = 24 }) => {
  const cat = CATEGORIES.find((c) => c.id === category);
  const Icon = ICON_MAP[category] || OtherIcon;
  return <Icon size={size} color={cat?.color} />;
};
