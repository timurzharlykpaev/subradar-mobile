/**
 * Detect a stale-JWT 404 from any user-keyed endpoint (typically `/billing/me`)
 * so the axios interceptor can force-logout. Backend now returns the stable
 * `'User not found'` form, but older deploys included the user UUID
 * (`User <uuid> not found`) — accept both, otherwise deleted-account JWTs
 * loop 404s indefinitely.
 *
 * Lives in its own module so unit tests don't pull in the RN-only polyfills
 * (`react-native-get-random-values`, axios, i18n) wired into `./client`.
 */
export function isUserNotFoundError(err: unknown): boolean {
  const e = err as { response?: { status?: number; data?: { message?: unknown } } };
  if (e?.response?.status !== 404) return false;
  const msg = e.response?.data?.message;
  return typeof msg === 'string' && /^User(?:\s+\S+)?\s+not found$/.test(msg);
}
