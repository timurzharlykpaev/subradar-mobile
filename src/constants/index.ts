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
  { id: 'STREAMING', label: 'Streaming', color: '#E53935' },
  { id: 'AI_SERVICES', label: 'AI Services', color: '#8E24AA' },
  { id: 'INFRASTRUCTURE', label: 'Infrastructure', color: '#039BE5' },
  { id: 'MUSIC', label: 'Music', color: '#8E24AA' },
  { id: 'GAMING', label: 'Gaming', color: '#43A047' },
  { id: 'PRODUCTIVITY', label: 'Productivity', color: '#1E88E5' },
  { id: 'HEALTH', label: 'Health', color: '#FB8C00' },
  { id: 'NEWS', label: 'News', color: '#00ACC1' },
  { id: 'OTHER', label: 'Other', color: '#757575' },
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
];

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#4CAF50',
  TRIAL: '#FF9800',
  PAUSED: '#9E9E9E',
  CANCELLED: '#F44336',
};

// Re-export themes for convenience
export { DarkTheme, LightTheme } from '../theme/colors';
