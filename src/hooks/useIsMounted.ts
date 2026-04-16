import { useEffect, useRef } from 'react';

/**
 * Returns a ref whose `.current` is `true` while the component is mounted
 * and flips to `false` on unmount. Use it to guard `setState` calls in async
 * callbacks to prevent "state update on unmounted component" warnings and
 * subtle memory leaks.
 *
 * Usage:
 *   const isMounted = useIsMounted();
 *   fetchSomething().then((data) => {
 *     if (!isMounted.current) return;
 *     setData(data);
 *   });
 */
export function useIsMounted() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}
