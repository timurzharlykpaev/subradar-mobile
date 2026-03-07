import { BillingPeriod } from '../types';

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function getDaysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function periodToMonthlyAmount(amount: number, period: BillingPeriod): number {
  switch (period) {
    case 'WEEKLY': return amount * 4.33;
    case 'MONTHLY': return amount;
    case 'QUARTERLY': return amount / 3;
    case 'YEARLY': return amount / 12;
    case 'LIFETIME': return 0;
    case 'ONE_TIME': return 0;
    default: return amount;
  }
}

export function periodLabel(period: BillingPeriod): string {
  const labels: Record<BillingPeriod, string> = {
    WEEKLY: 'week',
    MONTHLY: 'month',
    QUARTERLY: 'quarter',
    YEARLY: 'year',
    LIFETIME: 'lifetime',
    ONE_TIME: 'one-time',
  };
  return labels[period] || period;
}
