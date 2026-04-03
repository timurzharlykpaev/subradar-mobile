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

export async function lookupService(serviceName: string): Promise<LookupResult | null> {
  // Level 1: Local cache
  const cached = await lookupCache.get(serviceName);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  // Level 2: ServiceCatalog endpoint (no AI cost)
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
