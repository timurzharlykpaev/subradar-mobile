// Mirrors `computeNextPaymentDate` in subradar-backend
// (src/subscriptions/subscriptions.service.ts).
//
// Why mirrored: the backend stores `nextPaymentDate` at create/update time
// and refreshes it via a daily cron that only advances dates already in the
// past. Subscriptions created before a formula fix keep their stale value
// until the next billing cycle passes. Rendering locally from startDate +
// billingPeriod + billingDay is self-correcting and removes the dependency
// on cron timing, stale cache, and deploy cadence.

export type BillingPeriod =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'
  | 'LIFETIME'
  | 'ONE_TIME';

interface Input {
  startDate?: string | Date | null;
  billingPeriod?: BillingPeriod | string | null;
  billingDay?: number | null;
  /** Server-side stored value — used only as last-resort fallback. */
  nextPaymentDate?: string | Date | null;
}

const MS_PER_DAY = 86_400_000;

function lastDayOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function clampBillingDay(d: Date, billingDay: number | null | undefined, period: BillingPeriod): Date {
  if (!billingDay || period !== 'MONTHLY') return d;
  const out = new Date(d);
  out.setDate(Math.min(billingDay, lastDayOfMonth(out)));
  return out;
}

// Adds `months` to `d` while clamping the day-of-month to the target month's
// last valid day — matches date-fns `addMonths` semantics. Native JS
// `setMonth` overflows invalid dates (Jan 31 + 1mo → Mar 3), which would
// desync us from the backend's formula.
function addMonthsClamped(d: Date, months: number): Date {
  const year = d.getFullYear();
  const month = d.getMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastOfTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(d.getDate(), lastOfTarget);
  const out = new Date(d);
  out.setFullYear(targetYear, targetMonth, day);
  return out;
}

function advance(d: Date, period: BillingPeriod): Date {
  const out = new Date(d);
  switch (period) {
    case 'WEEKLY':
      out.setDate(out.getDate() + 7);
      return out;
    case 'QUARTERLY':
      return addMonthsClamped(d, 3);
    case 'YEARLY':
      return addMonthsClamped(d, 12);
    case 'MONTHLY':
    default:
      return addMonthsClamped(d, 1);
  }
}

/**
 * Compute the next payment date for a subscription.
 * Returns `null` for LIFETIME / ONE_TIME or when inputs are missing.
 */
export function computeNextPaymentDate(input: Input): Date | null {
  const period = (input.billingPeriod ?? '').toString().toUpperCase() as BillingPeriod;
  if (!period || period === 'LIFETIME' || period === 'ONE_TIME') return null;
  if (!input.startDate) return null;

  const startRaw = new Date(input.startDate);
  if (Number.isNaN(startRaw.getTime())) return null;

  const now = new Date();
  let next = clampBillingDay(startRaw, input.billingDay, period);

  // Walk forward until strictly in the future. Re-clamp after each step —
  // addMonths can land on a 28/30/31 edge and drift the billingDay.
  let guard = 0;
  while (next.getTime() <= now.getTime()) {
    next = clampBillingDay(advance(next, period), input.billingDay, period);
    if (++guard > 2000) return null; // defensive: 2000 iters = ~38 years of weekly
  }

  return next;
}

/**
 * Resolve the most accurate next payment date for rendering:
 * locally computed when inputs allow it, otherwise the server-stored value.
 */
export function resolveNextPaymentDate(input: Input): Date | null {
  const local = computeNextPaymentDate(input);
  if (local) return local;
  if (input.nextPaymentDate) {
    const d = new Date(input.nextPaymentDate);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Integer days from now to `date`. Negative = past. */
export function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}
