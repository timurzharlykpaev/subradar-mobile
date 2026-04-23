import { useEffect, useState } from 'react';

/**
 * Returns `value` debounced by `delayMs`. The first render returns the
 * initial value immediately (no stale default).
 *
 * Non-primitive `value` must be referentially stable across renders —
 * otherwise the effect retriggers every render and never settles.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
