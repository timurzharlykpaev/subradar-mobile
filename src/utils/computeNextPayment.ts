/**
 * Mirror of `subradar-backend/src/subscriptions/subscriptions.service.ts`
 * `computeNextPaymentDate`. Used by the edit form to render a live
 * preview of when the user will be charged next, so we can hide the
 * explicit "next payment date" picker behind an "override" toggle and
 * stop two adjacent fields from contradicting each other.
 *
 * Keep this in lockstep with the backend implementation — the backend
 * authoritative recompute on update is what actually persists, but
 * showing a different number locally is worse than showing none.
 */

export type BillingPeriod =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'
  | 'LIFETIME'
  | 'ONE_TIME';

function lastDayOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function clampToBillingDay(d: Date, billingDay: number | null | undefined, period: BillingPeriod): Date {
  if (!billingDay || period !== 'MONTHLY') return d;
  const last = lastDayOfMonth(d);
  const day = Math.min(billingDay, last);
  return new Date(d.getFullYear(), d.getMonth(), day, d.getHours(), d.getMinutes(), d.getSeconds());
}

function advance(d: Date, period: BillingPeriod): Date {
  const c = new Date(d);
  switch (period) {
    case 'WEEKLY':
      c.setDate(c.getDate() + 7);
      return c;
    case 'MONTHLY':
      c.setMonth(c.getMonth() + 1);
      return c;
    case 'QUARTERLY':
      c.setMonth(c.getMonth() + 3);
      return c;
    case 'YEARLY':
      c.setFullYear(c.getFullYear() + 1);
      return c;
    default:
      c.setMonth(c.getMonth() + 1);
      return c;
  }
}

export function computeNextPaymentDate(
  startDate: Date | string | null | undefined,
  billingPeriod: BillingPeriod,
  billingDay: number | null | undefined,
): Date | null {
  if (billingPeriod === 'LIFETIME' || billingPeriod === 'ONE_TIME') return null;
  if (!startDate) return null;

  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  if (isNaN(start.getTime())) return null;

  const now = new Date();
  let next = clampToBillingDay(new Date(start), billingDay, billingPeriod);

  // Walk forward until strictly in the future. Re-clamp after each step
  // to handle 28/30/31-day month-edge cases (e.g. billingDay=31 in Feb).
  let safety = 600; // ~50 years monthly worst case
  while (next.getTime() <= now.getTime() && safety-- > 0) {
    next = clampToBillingDay(advance(next, billingPeriod), billingDay, billingPeriod);
  }
  return safety > 0 ? next : null;
}
