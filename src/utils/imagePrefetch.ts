/**
 * imagePrefetch — throttled wrapper around `Image.prefetch`.
 *
 * Unbounded `Image.prefetch` calls (e.g. when rendering a long list or after a
 * bulk AI import) can saturate the native thread and waste memory. This queue
 * keeps at most `PREFETCH_LIMIT` requests in flight, deduplicates repeat URLs,
 * and silently swallows errors so callers don't have to.
 */
import { Image } from 'react-native';

const PREFETCH_LIMIT = 3;

let active = 0;
const queue: string[] = [];
const seen = new Set<string>();

function pump() {
  while (active < PREFETCH_LIMIT && queue.length > 0) {
    const url = queue.shift()!;
    active++;
    Image.prefetch(url)
      .catch(() => {})
      .finally(() => {
        active--;
        pump();
      });
  }
}

export function prefetchImage(url: string | null | undefined) {
  if (!url) return;
  if (seen.has(url)) return;
  seen.add(url);
  queue.push(url);
  pump();
}
