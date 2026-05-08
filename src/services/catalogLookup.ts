import { lookupCache } from './lookupCache';
import { aiApi } from '../api/ai';

export interface LookupResult {
  name: string;
  category?: string;
  iconUrl?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  plans?: { name: string; priceMonthly: number; currency: string }[];
  source: 'cache' | 'catalog' | 'ai';
}

// Real service names are short ("Adobe Creative Cloud All Apps" = 29
// chars / 5 tokens, "Microsoft 365 Family Subscription" = 4 tokens).
// When the user types a sentence the smart-input pipeline previously
// forwarded the whole string to /ai/service-catalog/<text> — those
// 404s surfaced in the prod alert channel. Skip the network call for
// anything that obviously isn't a service name and let the AI wizard
// handle natural-language input instead. Caps at 40 chars / 6 tokens so
// legitimate multi-word brand names still hit the catalog.
function looksLikeServiceName(key: string): boolean {
  const trimmed = key.trim();
  if (trimmed.length === 0 || trimmed.length > 40) return false;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 6) return false;
  return true;
}

export async function lookupService(serviceName: string): Promise<LookupResult | null> {
  // Level 1: Local cache
  const cached = await lookupCache.get(serviceName);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  // Level 2: ServiceCatalog endpoint (no AI cost) — only for inputs that
  // actually look like service names; sentences and paragraphs go straight
  // to the AI wizard via the caller.
  if (!looksLikeServiceName(serviceName)) {
    return null;
  }

  try {
    const catalogData = await aiApi.serviceCatalogLookup(serviceName);
    if (catalogData?.name) {
      await lookupCache.set(serviceName, catalogData);
      return { ...catalogData, source: 'catalog' };
    }
  } catch (err: any) {
    if (err?.response?.status !== 404) {
      console.warn('Catalog lookup error:', err?.message);
    }
  }

  // Level 3: AI wizard — not called here, let the caller decide
  // This keeps the lookup cost-free; caller can fallback to AI wizard if needed
  return null;
}

export async function lookupServiceWithAI(
  serviceName: string,
  locale: string,
): Promise<LookupResult | null> {
  // Try free lookup first
  const free = await lookupService(serviceName);
  if (free) return free;

  // Fallback to AI wizard
  try {
    const res = await aiApi.wizard(serviceName, undefined, locale);
    const data = res.data;
    if (data?.done && data?.subscription) {
      const result = {
        name: data.subscription.name || serviceName,
        category: data.subscription.category,
        iconUrl: data.subscription.iconUrl,
        serviceUrl: data.subscription.serviceUrl,
        cancelUrl: data.subscription.cancelUrl,
        plans: data.plans || undefined,
      };
      await lookupCache.set(serviceName, result);
      return { ...result, source: 'ai' as const };
    }
    // AI needs more info — return partial
    return null;
  } catch {
    return null;
  }
}
