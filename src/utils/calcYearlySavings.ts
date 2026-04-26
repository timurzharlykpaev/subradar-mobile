/**
 * Real "switch to yearly" savings for a paywall plan, derived from the actual
 * RevenueCat package prices in the user's local currency.
 *
 * formula: monthlyPrice * 12 - yearlyPrice
 *
 * Returns null when:
 *   - either package is missing (offerings still loading)
 *   - savings are zero or negative (yearly priced at parity, A/B test, etc.)
 *
 * The previous paywall logic computed `userMonthlySpend * 12 * 0.75` —
 * unrelated to the plan price and shown with a hardcoded `$` symbol even for
 * KZT/RUB/EUR users. This helper replaces that with prices the App Store /
 * Play Store actually charge in the user's local currency.
 */
export interface YearlySavings {
  /** Numeric saving in `currency` units (already in the user's local currency). */
  amount: number;
  /** ISO-4217 code from the yearly package — drives Intl.NumberFormat output. */
  currency: string;
}

interface PriceLike {
  product?: {
    price?: number;
    currencyCode?: string;
  };
}

export function calcYearlySavings(
  monthlyPkg: PriceLike | null | undefined,
  yearlyPkg: PriceLike | null | undefined,
): YearlySavings | null {
  const monthly = monthlyPkg?.product?.price;
  const yearly = yearlyPkg?.product?.price;
  const currency = yearlyPkg?.product?.currencyCode;

  if (
    typeof monthly !== 'number' ||
    typeof yearly !== 'number' ||
    !currency ||
    !isFinite(monthly) ||
    !isFinite(yearly) ||
    monthly <= 0 ||
    yearly <= 0
  ) {
    return null;
  }

  const amount = monthly * 12 - yearly;
  if (amount <= 0) return null;

  return { amount, currency };
}
