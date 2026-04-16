import {
  computeNextPaymentDate,
  resolveNextPaymentDate,
  daysUntil,
} from '../utils/nextPaymentDate';

describe('computeNextPaymentDate', () => {
  const FIXED_NOW = new Date('2026-04-17T10:00:00Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns null for LIFETIME and ONE_TIME', () => {
    expect(computeNextPaymentDate({ startDate: '2025-01-01', billingPeriod: 'LIFETIME' })).toBeNull();
    expect(computeNextPaymentDate({ startDate: '2025-01-01', billingPeriod: 'ONE_TIME' })).toBeNull();
  });

  it('returns null when startDate or billingPeriod missing', () => {
    expect(computeNextPaymentDate({ billingPeriod: 'MONTHLY' })).toBeNull();
    expect(computeNextPaymentDate({ startDate: '2025-01-01' })).toBeNull();
  });

  it('walks monthly forward from an old startDate to the first future date', () => {
    // start 2025-01-15, monthly → next payment Jan 15 of the current cycle.
    // With now = 2026-04-17, first strictly-future occurrence is 2026-05-15.
    const next = computeNextPaymentDate({ startDate: '2025-01-15', billingPeriod: 'MONTHLY' });
    expect(next?.toISOString().slice(0, 10)).toBe('2026-05-15');
  });

  it('applies billingDay clamp for MONTHLY', () => {
    // start 2026-04-14, billingDay=1 → clamp to 2026-04-01 (past), advance to 2026-05-01.
    const next = computeNextPaymentDate({
      startDate: '2026-04-14',
      billingPeriod: 'MONTHLY',
      billingDay: 1,
    });
    expect(next?.toISOString().slice(0, 10)).toBe('2026-05-01');
  });

  it('clamps billingDay 31 to the last day of short months (matches backend date-fns)', () => {
    // start 2026-01-31, billingDay=31, MONTHLY. With clamped addMonths:
    //   Jan 31 -> Feb 28 (2026 not leap) -> clamp to min(31, 28) = 28 -> Feb 28 (past)
    //   advance -> Mar 28 -> clamp to min(31, 31) = 31 -> Mar 31 (past)
    //   advance -> Apr 30 -> clamp to min(31, 30) = 30 -> Apr 30. Apr 30 > Apr 17 (now) -> return.
    const next = computeNextPaymentDate({
      startDate: '2026-01-31',
      billingPeriod: 'MONTHLY',
      billingDay: 31,
    });
    expect(next?.toISOString().slice(0, 10)).toBe('2026-04-30');
  });

  it('handles YEARLY and WEEKLY and QUARTERLY', () => {
    expect(
      computeNextPaymentDate({ startDate: '2024-04-17', billingPeriod: 'YEARLY' })
        ?.toISOString()
        .slice(0, 10),
    ).toBe('2027-04-17');

    // start 2026-04-10, weekly → next Wed 2026-04-24? Actually:
    // 2026-04-10 -> +7 = 2026-04-17 -> equal to now, not strictly after.
    // So it advances again to 2026-04-24.
    expect(
      computeNextPaymentDate({ startDate: '2026-04-10', billingPeriod: 'WEEKLY' })
        ?.toISOString()
        .slice(0, 10),
    ).toBe('2026-04-24');

    // start 2026-02-01, quarterly → May 1, Aug 1. First future is 2026-05-01.
    expect(
      computeNextPaymentDate({ startDate: '2026-02-01', billingPeriod: 'QUARTERLY' })
        ?.toISOString()
        .slice(0, 10),
    ).toBe('2026-05-01');
  });

  it('accepts Date objects as well as strings', () => {
    const next = computeNextPaymentDate({
      startDate: new Date('2025-06-10'),
      billingPeriod: 'MONTHLY',
    });
    expect(next?.toISOString().slice(0, 10)).toBe('2026-05-10');
  });
});

describe('resolveNextPaymentDate', () => {
  const FIXED_NOW = new Date('2026-04-17T10:00:00Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('prefers the locally-computed value over the server-provided one', () => {
    // Server thinks it's 2026-05-14 (stale from old formula); real computation with
    // billingDay=1 is 2026-05-01.
    const resolved = resolveNextPaymentDate({
      startDate: '2026-04-14',
      billingPeriod: 'MONTHLY',
      billingDay: 1,
      nextPaymentDate: '2026-05-14',
    });
    expect(resolved?.toISOString().slice(0, 10)).toBe('2026-05-01');
  });

  it('falls back to server value when inputs are insufficient', () => {
    const resolved = resolveNextPaymentDate({
      nextPaymentDate: '2026-07-01',
    });
    expect(resolved?.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('returns null when neither source is usable', () => {
    expect(resolveNextPaymentDate({})).toBeNull();
  });
});

describe('daysUntil', () => {
  // `daysUntil` compares local-midnight to local-midnight so the number
  // shown to the user ("in 3 days") tracks their timezone, not UTC. Tests
  // use noon timestamps to stay well clear of midnight-boundary drift in
  // any plausible CI timezone.
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-17T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns whole-day differences from local midnight', () => {
    expect(daysUntil(new Date('2026-04-17T12:00:00Z'))).toBe(0);
    expect(daysUntil(new Date('2026-04-18T12:00:00Z'))).toBe(1);
    expect(daysUntil(new Date('2026-04-20T12:00:00Z'))).toBe(3);
    expect(daysUntil(new Date('2026-04-16T12:00:00Z'))).toBe(-1);
  });

  it('returns null for null input', () => {
    expect(daysUntil(null)).toBeNull();
  });
});
