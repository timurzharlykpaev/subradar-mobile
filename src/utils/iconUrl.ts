/**
 * Build a favicon URL for a domain via Google's S2 service. We switched off
 * `icon.horse` here because it 200s with a generated grey-letter avatar for
 * domains it can't crawl (e.g. openai.com → grey "O"), which masks both the
 * real logo and our own first-letter fallback. Google S2 reliably returns the
 * real brand logo as a clean PNG for mainstream services and is RN-friendly.
 */
export function domainIconUrl(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
}

// Domains icon.horse can't crawl — it serves a grey-letter placeholder (HTTP
// 200) instead of the real logo or a 404. Any iconUrl we receive (incl. from
// the AI backend) pointing at one of these gets rewritten to a reliable source.
const ICON_HORSE_BAD_DOMAINS = ['openai.com'];

function normalizeIconUrl(url: string): string {
  if (url.includes('icon.horse')) {
    const bad = ICON_HORSE_BAD_DOMAINS.find((d) => url.includes(d));
    if (bad) return domainIconUrl(bad);
  }
  return url;
}

/**
 * Resolve an icon URL for a subscription before persisting/displaying it.
 *
 * Only derives a favicon URL when we have a real `serviceUrl` whose hostname
 * we can extract. When there's no URL, return `undefined` so
 * SubIcon/SubscriptionCard render the initial.
 */
export function resolveIconUrl(input: {
  iconUrl?: string | null;
  serviceUrl?: string | null;
}): string | undefined {
  if (input.iconUrl) return normalizeIconUrl(input.iconUrl);
  if (input.serviceUrl) {
    try {
      const host = new URL(input.serviceUrl).hostname;
      if (host) return domainIconUrl(host);
    } catch {}
  }
  return undefined;
}
