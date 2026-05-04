/**
 * Resolve an icon URL for a subscription before persisting/displaying it.
 *
 * Only generates an `icon.horse` URL when we have a real `serviceUrl` whose
 * hostname we can extract — for arbitrary user-typed names (e.g. "My Gym")
 * `icon.horse/icon/mygym.com` 200s with a default placeholder, which masks
 * the SubIcon first-letter fallback (onError never fires). When there's no
 * URL, return `undefined` so SubIcon/SubscriptionCard render the initial.
 */
export function resolveIconUrl(input: {
  iconUrl?: string | null;
  serviceUrl?: string | null;
}): string | undefined {
  if (input.iconUrl) return input.iconUrl;
  if (input.serviceUrl) {
    try {
      const host = new URL(input.serviceUrl).hostname;
      if (host) return `https://icon.horse/icon/${host}`;
    } catch {}
  }
  return undefined;
}
