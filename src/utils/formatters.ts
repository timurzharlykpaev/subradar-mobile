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

const MS_PER_DAY = 86_400_000;

/**
 * Parse a backend-provided ISO date string into a `Date`, or `null` if
 * missing/invalid. Single source of truth for `subscription.nextPaymentDate`
 * rendering across the app — backend computes + stores it, client just reads.
 */
export function parseBackendDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Integer days from today (local midnight) to `date`. Negative = past. */
export function daysUntilDate(date: Date | null): number | null {
  if (!date) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
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
