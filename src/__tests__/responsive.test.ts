jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));

import {
  scaleWith,
  verticalScaleWith,
  moderateScaleWith,
  moderateVerticalScaleWith,
} from '../utils/responsive';

describe('scaleWith', () => {
  it('returns same size at base width 390', () => {
    expect(scaleWith(390, 14)).toBe(14);
  });

  it('returns same size on wider screens (no scale-up)', () => {
    expect(scaleWith(414, 14)).toBe(14);
    expect(scaleWith(430, 20)).toBe(20);
  });

  it('scales down on smaller screens', () => {
    expect(scaleWith(375, 14)).toBeLessThan(14);
    expect(scaleWith(375, 14)).toBeGreaterThan(11);
  });

  it('clamps floor at 0.85 for very small screens', () => {
    expect(scaleWith(280, 100)).toBe(85);
    expect(scaleWith(100, 100)).toBe(85);
  });
});

describe('verticalScaleWith', () => {
  it('returns same size at base height 844', () => {
    expect(verticalScaleWith(844, 20)).toBe(20);
  });

  it('does not scale up on taller screens', () => {
    expect(verticalScaleWith(932, 20)).toBe(20);
  });

  it('scales down on shorter screens', () => {
    expect(verticalScaleWith(667, 20)).toBeLessThan(20);
  });
});

describe('moderateScaleWith', () => {
  it('returns same size at base 390', () => {
    expect(moderateScaleWith(390, 14)).toBe(14);
  });

  it('returns same size on wider screens', () => {
    expect(moderateScaleWith(414, 14)).toBe(14);
  });

  it('moderately scales down (less aggressive than scale)', () => {
    const aggressive = scaleWith(375, 14);
    const moderate = moderateScaleWith(375, 14);
    expect(moderate).toBeGreaterThanOrEqual(aggressive);
    expect(moderate).toBeLessThanOrEqual(14);
  });

  it('factor=1 equals full scale', () => {
    expect(moderateScaleWith(375, 14, 1)).toBe(scaleWith(375, 14));
  });

  it('factor=0 returns original size unchanged', () => {
    expect(moderateScaleWith(280, 14, 0)).toBe(14);
  });
});

describe('moderateVerticalScaleWith', () => {
  it('returns same size at base 844', () => {
    expect(moderateVerticalScaleWith(844, 20)).toBe(20);
  });

  it('returns same size on taller screens', () => {
    expect(moderateVerticalScaleWith(932, 20)).toBe(20);
  });

  it('moderately scales down on shorter screens', () => {
    const moderate = moderateVerticalScaleWith(667, 20);
    expect(moderate).toBeLessThan(20);
    expect(moderate).toBeGreaterThan(17);
  });
});
