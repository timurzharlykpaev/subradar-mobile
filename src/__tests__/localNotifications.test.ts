/**
 * Tests for localNotifications reminder day selection logic.
 */

describe('Notification reminder days logic', () => {
  function getReminderDays(sub: { reminderDaysBefore?: number[] | null; reminderEnabled?: boolean }): number[] | null {
    if (sub.reminderEnabled === false) return null;
    return (sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0)
      ? sub.reminderDaysBefore
      : [1, 3]; // default fallback
  }

  it('uses subscription reminderDaysBefore when set', () => {
    expect(getReminderDays({ reminderDaysBefore: [7] })).toEqual([7]);
    expect(getReminderDays({ reminderDaysBefore: [1, 3, 7] })).toEqual([1, 3, 7]);
  });

  it('falls back to [1, 3] when reminderDaysBefore is empty', () => {
    expect(getReminderDays({ reminderDaysBefore: [] })).toEqual([1, 3]);
    expect(getReminderDays({})).toEqual([1, 3]);
    expect(getReminderDays({ reminderDaysBefore: null })).toEqual([1, 3]);
  });

  it('returns null when reminderEnabled is false', () => {
    expect(getReminderDays({ reminderEnabled: false })).toBeNull();
    expect(getReminderDays({ reminderEnabled: false, reminderDaysBefore: [7] })).toBeNull();
  });

  it('uses default when reminderEnabled is undefined', () => {
    expect(getReminderDays({ reminderEnabled: undefined })).toEqual([1, 3]);
  });
});
