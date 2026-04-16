import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

const STORAGE_KEY = 'subradar:fx-rates';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface FxRatesCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
  cachedAt: number; // Date.now() when cached locally
}

let memoryCache: FxRatesCache | null = null;

/**
 * Initialize FX cache — load from AsyncStorage into memory.
 * Call once at app start (DataLoader).
 */
export async function initFxCache(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: FxRatesCache = JSON.parse(stored);
      if (Date.now() - parsed.cachedAt < TTL_MS) {
        memoryCache = parsed;
        return;
      }
    }
  } catch {}
  // Cache miss or expired — fetch fresh
  await refreshFxRates();
}

/**
 * Fetch fresh FX rates from backend and cache.
 */
export async function refreshFxRates(): Promise<void> {
  try {
    const res = await apiClient.get('/fx/rates');
    const data = res.data;
    const rates = data?.rates;
    const base = data?.base ?? 'USD';
    const fetchedAt = data?.fetchedAt ?? new Date().toISOString();
    if (rates && typeof rates === 'object') {
      memoryCache = { base, rates, fetchedAt, cachedAt: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache)).catch(() => {});
    }
  } catch {
    // Silently fail — convertAmount will return null
  }
}

/**
 * Invalidate cache and refetch. Call when displayCurrency changes.
 */
export async function invalidateFxCache(): Promise<void> {
  memoryCache = null;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  await refreshFxRates();
}

/**
 * Convert amount from one currency to another using cached FX rates.
 * Returns null if conversion is not possible (no rates, unknown currency).
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): number | null {
  if (fromCurrency === toCurrency) return amount;
  if (!memoryCache?.rates) return null;

  const rates = memoryCache.rates;
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // rates are relative to base (USD)
  // For USD-based rates: amount_in_USD = amount / rates[from], amount_in_to = amount_in_USD * rates[to]
  const fromRate = from === memoryCache.base ? 1 : rates[from];
  const toRate = to === memoryCache.base ? 1 : rates[to];

  if (!fromRate || !toRate || fromRate <= 0 || toRate <= 0) return null;

  const result = (amount / fromRate) * toRate;
  // Round to 2 decimal places
  return Math.round(result * 100) / 100;
}

/**
 * Check if FX rates are available in memory.
 */
export function hasFxRates(): boolean {
  return memoryCache !== null && Date.now() - memoryCache.cachedAt < TTL_MS;
}
