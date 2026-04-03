import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'subradar:lookup-cache';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedEntry {
  data: {
    name: string;
    category?: string;
    iconUrl?: string;
    serviceUrl?: string;
    cancelUrl?: string;
    plans?: { name: string; priceMonthly: number; currency: string }[];
  };
  cachedAt: number;
}

type CacheStore = Record<string, CachedEntry>;

let memoryCache: CacheStore | null = null;

async function loadCache(): Promise<CacheStore> {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    memoryCache = raw ? JSON.parse(raw) : {};
  } catch {
    memoryCache = {};
  }
  return memoryCache!;
}

async function saveCache(cache: CacheStore): Promise<void> {
  memoryCache = cache;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+(premium|basic|standard|pro|plus|family|team|enterprise|business|starter|individual|duo|student)\b/gi, '')
    .replace(/\s+(monthly|yearly|annual|lifetime)\b/gi, '')
    .replace(/\s+(plan|subscription|tier|membership)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_|_$/g, '');
}

export const lookupCache = {
  normalize,

  async get(serviceName: string): Promise<CachedEntry['data'] | null> {
    const cache = await loadCache();
    const key = normalize(serviceName);
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > TTL_MS) {
      delete cache[key];
      await saveCache(cache);
      return null;
    }
    return entry.data;
  },

  async set(serviceName: string, data: CachedEntry['data']): Promise<void> {
    const cache = await loadCache();
    const key = normalize(serviceName);
    cache[key] = { data, cachedAt: Date.now() };
    await saveCache(cache);
  },

  async clear(): Promise<void> {
    memoryCache = {};
    await AsyncStorage.removeItem(CACHE_KEY);
  },
};
