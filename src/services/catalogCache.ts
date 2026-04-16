import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

const STORAGE_KEY = 'subradar:catalog-popular';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CatalogPlan {
  name: string;
  price: number;
  currency: string;
  period: string;
}

export interface CatalogService {
  id: string;
  name: string;
  slug: string;
  category: string;
  iconUrl?: string;
  plans: CatalogPlan[];
}

interface CatalogCacheEntry {
  region: string;
  currency: string;
  services: CatalogService[];
  cachedAt: number;
}

let memoryCache: CatalogCacheEntry | null = null;

/**
 * Get popular services for the user's region + currency.
 * Returns cached data if fresh, otherwise fetches from backend.
 */
export async function getPopularServices(
  region: string,
  currency: string,
): Promise<CatalogService[]> {
  // Check memory cache
  if (
    memoryCache &&
    memoryCache.region === region &&
    memoryCache.currency === currency &&
    Date.now() - memoryCache.cachedAt < TTL_MS
  ) {
    return memoryCache.services;
  }

  // Check AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: CatalogCacheEntry = JSON.parse(stored);
      if (
        parsed.region === region &&
        parsed.currency === currency &&
        Date.now() - parsed.cachedAt < TTL_MS
      ) {
        memoryCache = parsed;
        return parsed.services;
      }
    }
  } catch {}

  // Fetch from backend
  try {
    const res = await apiClient.get('/catalog/popular', {
      params: { region, currency, limit: 20 },
    });
    const services: CatalogService[] = res.data ?? [];
    if (services.length > 0) {
      const entry: CatalogCacheEntry = {
        region,
        currency,
        services,
        cachedAt: Date.now(),
      };
      memoryCache = entry;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry)).catch(() => {});
      return services;
    }
  } catch {}

  // Return empty — caller falls back to POPULAR_SERVICES + FX conversion
  return [];
}

/**
 * Invalidate catalog cache. Call when region or currency changes.
 */
export async function invalidateCatalogCache(): Promise<void> {
  memoryCache = null;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
