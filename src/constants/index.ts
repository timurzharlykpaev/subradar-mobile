import { BillingPeriod, CardBrand } from '../types';

export const COLORS = {
  primary: '#7C5CFF',
  primaryLight: '#2D2060',
  secondary: '#FF6B6B',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  background: '#0A0A14',
  surface: '#12121F',
  surface2: '#1A1A2E',
  text: '#F1F0FF',
  textSecondary: '#A89FD0',
  textMuted: '#6B6690',
  border: '#2A2A40',
  card: '#16162A',
};

export const CATEGORIES = [
  { id: 'STREAMING', label: 'Streaming', color: '#FF4757' },
  { id: 'AI_SERVICES', label: 'AI Services', color: '#A855F7' },
  { id: 'INFRASTRUCTURE', label: 'Infrastructure', color: '#06B6D4' },
  { id: 'DEVELOPER', label: 'Developer', color: '#3B82F6' },
  { id: 'PRODUCTIVITY', label: 'Productivity', color: '#10B981' },
  { id: 'MUSIC', label: 'Music', color: '#FF6B6B' },
  { id: 'GAMING', label: 'Gaming', color: '#8B5CF6' },
  { id: 'EDUCATION', label: 'Education', color: '#F59E0B' },
  { id: 'FINANCE', label: 'Finance', color: '#22C55E' },
  { id: 'DESIGN', label: 'Design', color: '#F472B6' },
  { id: 'SECURITY', label: 'Security', color: '#EF4444' },
  { id: 'HEALTH', label: 'Health', color: '#EC4899' },
  { id: 'SPORT', label: 'Sport', color: '#F97316' },
  { id: 'NEWS', label: 'News', color: '#0EA5E9' },
  { id: 'BUSINESS', label: 'Business', color: '#1D4ED8' },
  { id: 'OTHER', label: 'Other', color: '#A78BFA' },
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'UAH', 'TRY'];

export const BILLING_PERIODS: BillingPeriod[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'ONE_TIME'];

export const CARD_BRANDS: CardBrand[] = ['VISA', 'MC', 'AMEX', 'MIR', 'OTHER'];

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'kk', label: 'Қазақша', flag: '🇰🇿' },
];

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#4CAF50',
  TRIAL: '#FF9800',
  PAUSED: '#9E9E9E',
  CANCELLED: '#F44336',
};

// Re-export themes for convenience
export { DarkTheme, LightTheme } from '../theme/colors';
