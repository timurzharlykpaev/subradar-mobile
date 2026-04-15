/**
 * Format a monetary amount in the target currency using Intl.NumberFormat.
 * Accepts string or number amount (string preserves decimal precision).
 * Falls back to `N.NN CCC` if the locale/currency combination is invalid.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string,
  locale?: string,
): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!isFinite(n)) return '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}
