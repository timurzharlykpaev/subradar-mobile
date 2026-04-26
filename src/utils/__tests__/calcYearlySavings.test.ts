import { calcYearlySavings } from '../calcYearlySavings';

const pkg = (price: number, currencyCode = 'USD') => ({
  product: { price, currencyCode },
});

describe('calcYearlySavings', () => {
  it('computes monthly*12 - yearly when both prices are valid', () => {
    expect(calcYearlySavings(pkg(9.99), pkg(79.99))).toEqual({
      amount: 9.99 * 12 - 79.99,
      currency: 'USD',
    });
  });

  it('uses the yearly package currency code (not the monthly one)', () => {
    expect(calcYearlySavings(pkg(490, 'KZT'), pkg(3990, 'KZT'))?.currency).toBe('KZT');
  });

  it('returns null if monthly is missing', () => {
    expect(calcYearlySavings(null, pkg(79.99))).toBeNull();
  });

  it('returns null if yearly is missing', () => {
    expect(calcYearlySavings(pkg(9.99), null)).toBeNull();
  });

  it('returns null when yearly is at parity or pricier than monthly*12', () => {
    expect(calcYearlySavings(pkg(9.99), pkg(120))).toBeNull(); // parity → 0 savings
    expect(calcYearlySavings(pkg(9.99), pkg(150))).toBeNull(); // negative
  });

  it('returns null when prices are not finite numbers', () => {
    expect(calcYearlySavings(pkg(NaN), pkg(79.99))).toBeNull();
    expect(calcYearlySavings(pkg(9.99), pkg(Infinity))).toBeNull();
  });

  it('returns null when product is missing', () => {
    expect(calcYearlySavings({}, pkg(79.99))).toBeNull();
  });
});
