import { generateId, clamp, groupBy } from '../utils/utils';

describe('generateId', () => {
  it('returns non-empty string', () => expect(generateId().length).toBeGreaterThan(0));
  it('returns unique ids', () => expect(generateId()).not.toBe(generateId()));
});

describe('clamp', () => {
  it('clamps to min', () => expect(clamp(-5, 0, 10)).toBe(0));
  it('clamps to max', () => expect(clamp(15, 0, 10)).toBe(10));
  it('returns value in range', () => expect(clamp(5, 0, 10)).toBe(5));
});

describe('groupBy', () => {
  it('groups by key', () => {
    const arr = [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }];
    const result = groupBy(arr, 'type');
    expect(result['a']).toHaveLength(2);
    expect(result['b']).toHaveLength(1);
  });
  it('returns empty object for empty array', () => {
    expect(groupBy([], 'id' as any)).toEqual({});
  });
});
