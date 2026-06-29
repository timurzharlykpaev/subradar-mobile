/**
 * Build a favicon URL for a domain via Google's S2 service. We switched off
 * `icon.horse` here because it 200s with a generated grey-letter avatar for
 * domains it can't crawl (e.g. openai.com → grey "O"), which masks both the
 * real logo and our own first-letter fallback. Google S2 reliably returns the
 * real brand logo as a clean PNG for mainstream services and is RN-friendly.
 */
export function domainIconUrl(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${host.replace(/^www\./, '')}&sz=128`;
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

// Known service name → real domain. Covers brands whose domain isn't a clean
// slug of the name (claude → claude.ai, notion → notion.so, hbo → hbomax.com)
// and multi-word names the single-token heuristic below can't infer. Keys are
// lowercased; tier qualifiers ("plus", "premium") are handled by the
// progressive right-trim in guessServiceDomain so we don't list every variant.
const DOMAIN_MAP: Record<string, string> = {
  chatgpt: 'openai.com', openai: 'openai.com',
  youtube: 'youtube.com', 'youtube music': 'music.youtube.com',
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  'playstation plus': 'playstation.com', playstation: 'playstation.com', 'ps plus': 'playstation.com',
  'xbox game pass': 'xbox.com', xbox: 'xbox.com',
  'apple tv+': 'tv.apple.com', 'apple tv': 'tv.apple.com',
  'apple music': 'music.apple.com', 'apple arcade': 'apple.com', 'apple one': 'apple.com',
  icloud: 'icloud.com', 'icloud+': 'icloud.com', 'icloud plus': 'icloud.com',
  'disney+': 'disneyplus.com', 'disney plus': 'disneyplus.com', disney: 'disneyplus.com',
  'hbo max': 'hbomax.com', hbo: 'hbomax.com', max: 'max.com',
  'amazon prime': 'amazon.com', 'prime video': 'amazon.com', amazon: 'amazon.com',
  github: 'github.com', 'github copilot': 'github.com',
  figma: 'figma.com', notion: 'notion.so', slack: 'slack.com',
  adobe: 'adobe.com', 'adobe creative cloud': 'adobe.com', 'adobe cc': 'adobe.com',
  midjourney: 'midjourney.com', claude: 'claude.ai', anthropic: 'claude.ai',
  nordvpn: 'nordvpn.com', '1password': '1password.com',
  strava: 'strava.com', duolingo: 'duolingo.com',
  'google one': 'one.google.com', 'google fitbit': 'fitbit.com',
  'google fitbit air': 'fitbit.com', fitbit: 'fitbit.com',
  'google play': 'play.google.com', 'google cloud': 'cloud.google.com',
  leetcode: 'leetcode.com', clickup: 'clickup.com', expo: 'expo.dev',
  dropbox: 'dropbox.com', 'microsoft 365': 'microsoft.com', office365: 'microsoft.com',
  subradar: 'subradar.ai',
};

/**
 * Best-effort domain for a free-typed / AI-scanned service name, so we can show
 * a real logo even when the parser returned no serviceUrl/iconUrl.
 *
 * 1. Exact (then right-trimmed, e.g. "ChatGPT Plus" → "chatgpt") DOMAIN_MAP hit.
 * 2. Single clean token → `<brand>.com` — covers the long tail of SaaS that own
 *    their .com (leetcode.com, clickup.com, spaceship.com…).
 * Multi-word unknowns return '' so we fall back to the initial/placeholder
 * rather than guessing a wrong domain (which would render a generic globe).
 */
export function guessServiceDomain(name?: string | null): string {
  const key = (name || '').toLowerCase().trim();
  if (!key) return '';
  const tokens = key.split(/\s+/).filter(Boolean);
  for (let cut = tokens.length; cut >= 1; cut--) {
    const stem = tokens.slice(0, cut).join(' ');
    if (DOMAIN_MAP[stem]) return DOMAIN_MAP[stem];
  }
  if (tokens.length === 1) {
    const slug = key.replace(/\+/g, 'plus').replace(/[^a-z0-9]/g, '');
    if (slug.length >= 2) return `${slug}.com`;
  }
  return '';
}

/**
 * Resolve an icon URL for a subscription before persisting/displaying it.
 * Priority: explicit iconUrl → serviceUrl host → name-guessed domain. Returns
 * `undefined` when nothing resolves so SubIcon/SubscriptionCard render the
 * initial instead of a broken/globe image.
 */
export function resolveIconUrl(input: {
  iconUrl?: string | null;
  serviceUrl?: string | null;
  name?: string | null;
}): string | undefined {
  if (input.iconUrl) return normalizeIconUrl(input.iconUrl);
  if (input.serviceUrl) {
    try {
      const host = new URL(input.serviceUrl).hostname;
      if (host) return domainIconUrl(host);
    } catch {}
  }
  const guessed = guessServiceDomain(input.name);
  if (guessed) return domainIconUrl(guessed);
  return undefined;
}
