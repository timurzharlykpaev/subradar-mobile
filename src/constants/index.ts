export const COLORS = {
  primary: '#6C47FF',
  primaryLight: '#EDE9FF',
  secondary: '#FF6B6B',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  background: '#F8F9FE',
  surface: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  card: '#FFFFFF',
};

export const CATEGORIES = [
  { id: 'streaming', label: 'Streaming', emoji: '🎬', color: '#E53935' },
  { id: 'music', label: 'Music', emoji: '🎵', color: '#8E24AA' },
  { id: 'productivity', label: 'Productivity', emoji: '💼', color: '#1E88E5' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮', color: '#43A047' },
  { id: 'fitness', label: 'Fitness', emoji: '💪', color: '#FB8C00' },
  { id: 'news', label: 'News', emoji: '📰', color: '#00ACC1' },
  { id: 'cloud', label: 'Cloud', emoji: '☁️', color: '#039BE5' },
  { id: 'education', label: 'Education', emoji: '📚', color: '#F4511E' },
  { id: 'finance', label: 'Finance', emoji: '💰', color: '#43A047' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#E91E63' },
  { id: 'other', label: 'Other', emoji: '📦', color: '#757575' },
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'UAH', 'TRY'];

export const BILLING_PERIODS = ['weekly', 'monthly', 'quarterly', 'yearly'];

export const CARD_BRANDS = ['Visa', 'Mastercard', 'Amex', 'Mir', 'Other'];

export const STATUS_COLORS: Record<string, string> = {
  active: '#4CAF50',
  trial: '#FF9800',
  paused: '#9E9E9E',
  cancelled: '#F44336',
};
