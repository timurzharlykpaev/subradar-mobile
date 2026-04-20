/**
 * catalogLookup — free client-side service catalog + AI fallback.
 *
 * lookupService(name): checks local QUICK_CATALOG first (0 network, 0 AI credits),
 * then falls back to the backend /ai/service-catalog/:name endpoint (also free).
 *
 * lookupServiceWithAI(name, locale): uses 1 AI credit via /ai/wizard.
 */

import { aiApi } from '../api/ai';

export interface CatalogEntry {
  name: string;
  category: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  iconUrl?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  plans?: Array<{ name: string; amount: number; currency: string; billingPeriod: string }>;
}

// ── Local catalog (instant, no network) ─────────────────────────────────────

const QUICK_CATALOG: Record<string, CatalogEntry> = {
  netflix: {
    name: 'Netflix', category: 'STREAMING', amount: 15.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/netflix.com', serviceUrl: 'https://netflix.com',
    cancelUrl: 'https://www.netflix.com/cancelplan',
    plans: [
      { name: 'Standard with Ads', amount: 6.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Standard', amount: 15.49, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Premium', amount: 22.99, currency: 'USD', billingPeriod: 'MONTHLY' },
    ],
  },
  spotify: {
    name: 'Spotify', category: 'MUSIC', amount: 9.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/spotify.com', serviceUrl: 'https://spotify.com',
    cancelUrl: 'https://www.spotify.com/account/subscription/cancel',
    plans: [
      { name: 'Individual', amount: 9.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Duo', amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Family', amount: 16.99, currency: 'USD', billingPeriod: 'MONTHLY' },
    ],
  },
  chatgpt: {
    name: 'ChatGPT', category: 'AI_SERVICES', amount: 20, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/openai.com', serviceUrl: 'https://chat.openai.com',
    cancelUrl: 'https://help.openai.com/en/articles/7232013',
    plans: [
      { name: 'Plus', amount: 20, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Pro', amount: 200, currency: 'USD', billingPeriod: 'MONTHLY' },
    ],
  },
  icloud: {
    name: 'iCloud+', category: 'INFRASTRUCTURE', amount: 0.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/apple.com', serviceUrl: 'https://icloud.com',
    cancelUrl: 'https://support.apple.com/billing',
    plans: [
      { name: '50 GB', amount: 0.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: '200 GB', amount: 2.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: '2 TB', amount: 9.99, currency: 'USD', billingPeriod: 'MONTHLY' },
    ],
  },
  youtube: {
    name: 'YouTube Premium', category: 'STREAMING', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/youtube.com', serviceUrl: 'https://youtube.com',
    cancelUrl: 'https://youtube.com/paid_memberships',
    plans: [
      { name: 'Individual', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Family', amount: 22.99, currency: 'USD', billingPeriod: 'MONTHLY' },
    ],
  },
  'youtube premium': {
    name: 'YouTube Premium', category: 'STREAMING', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/youtube.com', serviceUrl: 'https://youtube.com',
    cancelUrl: 'https://youtube.com/paid_memberships',
    plans: [
      { name: 'Individual', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Family', amount: 22.99, currency: 'USD', billingPeriod: 'MONTHLY' },
    ],
  },
  'disney+': {
    name: 'Disney+', category: 'STREAMING', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/disneyplus.com', serviceUrl: 'https://disneyplus.com',
    cancelUrl: 'https://www.disneyplus.com/account/subscription',
    plans: [
      { name: 'Basic', amount: 7.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Premium', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Premium Annual', amount: 139.99, currency: 'USD', billingPeriod: 'YEARLY' },
    ],
  },
  disney: {
    name: 'Disney+', category: 'STREAMING', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/disneyplus.com', serviceUrl: 'https://disneyplus.com',
    cancelUrl: 'https://www.disneyplus.com/account/subscription',
  },
  'apple music': {
    name: 'Apple Music', category: 'MUSIC', amount: 10.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/music.apple.com', serviceUrl: 'https://music.apple.com',
    cancelUrl: 'https://support.apple.com/billing',
    plans: [
      { name: 'Individual', amount: 10.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Family', amount: 16.99, currency: 'USD', billingPeriod: 'MONTHLY' },
    ],
  },
  'amazon prime': {
    name: 'Amazon Prime', category: 'STREAMING', amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/amazon.com', serviceUrl: 'https://amazon.com',
    cancelUrl: 'https://www.amazon.com/mc/cancel',
    plans: [
      { name: 'Monthly', amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY' },
      { name: 'Annual', amount: 139, currency: 'USD', billingPeriod: 'YEARLY' },
    ],
  },
  amazon: {
    name: 'Amazon Prime', category: 'STREAMING', amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY',
    iconUrl: 'https://icon.horse/icon/amazon.com', serviceUrl: 'https://amazon.com',
    cancelUrl: 'https://www.amazon.com/mc/cancel',
  },
};

// ── In-memory cache ─────────────────────────────────────────────────────────

const lookupCache = new Map<string, CatalogEntry | null>();

/** Free lookup: local catalog → backend service catalog. Returns null if unknown. */
export async function lookupService(name: string): Promise<CatalogEntry | null> {
  const key = name.toLowerCase().trim();
  if (lookupCache.has(key)) return lookupCache.get(key) ?? null;

  // 1. Check local catalog
  const local = QUICK_CATALOG[key];
  if (local) {
    lookupCache.set(key, local);
    return local;
  }

  // 2. Try backend service catalog (free endpoint)
  try {
    const data = await aiApi.serviceCatalogLookup(name);
    if (data && data.name) {
      const entry: CatalogEntry = {
        name: data.name,
        category: data.category || 'OTHER',
        amount: data.plans?.[0]?.priceMonthly ?? 0,
        currency: data.plans?.[0]?.currency ?? 'USD',
        billingPeriod: 'MONTHLY',
        iconUrl: data.iconUrl,
        serviceUrl: data.serviceUrl,
        cancelUrl: data.cancelUrl,
        plans: data.plans?.map(p => ({
          name: p.name,
          amount: p.priceMonthly,
          currency: p.currency,
          billingPeriod: 'MONTHLY',
        })),
      };
      lookupCache.set(key, entry);
      return entry;
    }
  } catch {
    // Not found or network error — fall through
  }

  lookupCache.set(key, null);
  return null;
}

/** AI-powered lookup — costs 1 AI credit. */
export async function lookupServiceWithAI(
  name: string,
  locale: string,
  currency?: string,
  country?: string,
): Promise<{ found: boolean; entry?: CatalogEntry; question?: string; field?: string }> {
  try {
    const res = await aiApi.wizard(
      name,
      {
        preferredCurrency: (currency || 'USD').toUpperCase(),
        userCountry: (country || 'US').toUpperCase(),
      },
      locale,
    );
    const data = res.data;

    if (data.done && data.subscription) {
      const sub = data.subscription;
      const entry: CatalogEntry = {
        name: sub.name || name,
        category: (sub.category || 'OTHER').toUpperCase(),
        amount: sub.amount || 0,
        currency: sub.currency || 'USD',
        billingPeriod: (sub.billingPeriod || 'MONTHLY').toUpperCase(),
        iconUrl: sub.iconUrl,
        serviceUrl: sub.serviceUrl,
        cancelUrl: sub.cancelUrl,
      };
      lookupCache.set(name.toLowerCase().trim(), entry);
      return { found: true, entry };
    }

    if (data.done && data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
      const entry: CatalogEntry = {
        name: data.serviceName || name,
        category: (data.category || 'OTHER').toUpperCase(),
        amount: data.plans[0].amount || data.plans[0].price || 0,
        currency: data.plans[0].currency || 'USD',
        billingPeriod: (data.plans[0].billingPeriod || 'MONTHLY').toUpperCase(),
        iconUrl: data.iconUrl,
        serviceUrl: data.serviceUrl,
        cancelUrl: data.cancelUrl,
        plans: data.plans.map((p: any) => ({
          name: p.name,
          amount: p.amount || p.price || 0,
          currency: p.currency || 'USD',
          billingPeriod: (p.billingPeriod || 'MONTHLY').toUpperCase(),
        })),
      };
      lookupCache.set(name.toLowerCase().trim(), entry);
      return { found: true, entry };
    }

    if (!data.done && data.question) {
      return { found: false, question: data.question, field: data.field };
    }

    return { found: false };
  } catch {
    return { found: false };
  }
}

export { lookupCache };
