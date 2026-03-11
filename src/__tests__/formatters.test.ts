import { formatCurrency, formatDate, formatDateShort, getDaysUntil, periodToMonthlyAmount } from '../utils/formatters';

describe('formatCurrency', () => {
  it('formats USD', () => expect(formatCurrency(9.99, 'USD')).toContain('9.99'));
  it('formats EUR', () => expect(formatCurrency(5, 'EUR')).toContain('5'));
  it('handles zero', () => expect(formatCurrency(0, 'USD')).toContain('0'));
  it('falls back on unknown currency', () => {
    const r = formatCurrency(10, 'XYZ');
    expect(r).toBeTruthy();
  });
});

describe('formatDate', () => {
  it('formats valid date', () => {
    const r = formatDate('2024-03-15');
    expect(r).toBeTruthy();
    expect(typeof r).toBe('string');
  });
  it('handles invalid date gracefully', () => {
    const r = formatDate('not-a-date');
    expect(typeof r).toBe('string');
  });
});

describe('formatDateShort', () => {
  it('returns string for valid date', () => {
    expect(typeof formatDateShort('2024-03-15')).toBe('string');
  });
});

describe('getDaysUntil', () => {
  it('returns positive for future date', () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    expect(getDaysUntil(future)).toBeGreaterThan(0);
  });
  it('returns negative for past date', () => {
    const past = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(getDaysUntil(past)).toBeLessThan(0);
  });
});

describe('periodToMonthlyAmount', () => {
  it('MONTHLY → same amount', () => expect(periodToMonthlyAmount(10, 'MONTHLY')).toBe(10));
  it('YEARLY → ~monthly', () => expect(periodToMonthlyAmount(120, 'YEARLY')).toBeCloseTo(10));
  it('WEEKLY → ~monthly', () => expect(periodToMonthlyAmount(10, 'WEEKLY')).toBeCloseTo(43.3, 0));
});
