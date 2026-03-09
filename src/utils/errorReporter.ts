import { Platform } from 'react-native';
import Constants from 'expo-constants';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.subradar.ai/api/v1';

const DEDUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const recentErrors = new Map<string, number>();

function getPlatformInfo(): string {
  const version = Constants.expoConfig?.version ?? 'unknown';
  return `${Platform.OS} v${version}`;
}

export async function reportError(
  message: string,
  stack?: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const key = message + (stack ?? '');
    const lastSent = recentErrors.get(key);
    const now = Date.now();

    if (lastSent && now - lastSent < DEDUP_INTERVAL_MS) return;

    recentErrors.set(key, now);

    // Cleanup old entries
    for (const [k, t] of recentErrors) {
      if (now - t > DEDUP_INTERVAL_MS) recentErrors.delete(k);
    }

    await axios.post(`${API_URL}/monitoring/client-error`, {
      message,
      stack,
      platform: getPlatformInfo(),
      version: Constants.expoConfig?.version,
      url: context ? JSON.stringify(context) : undefined,
    });
  } catch {
    // Silently ignore — don't cause infinite error loops
  }
}
