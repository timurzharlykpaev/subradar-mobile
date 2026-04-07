import { Platform } from 'react-native';
import Constants from 'expo-constants';
import axios from 'axios';
import { API_URL } from '../api/client';

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

    // Cleanup stale entries
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

/**
 * Install global console.warn / console.error interceptors.
 * Call once on app startup (e.g. in _layout.tsx).
 * Warnings that contain "WARN" or known crash-indicating keywords are forwarded
 * to the monitoring endpoint so they appear in Telegram alerts.
 */
export function installConsoleInterceptors(): void {
  const SKIP_PATTERNS = [
    /VirtualizedList/,       // React Native perf noise
    /Each child in a list/,  // React key warning
    /^Warning: React.forwardRef/,
    /^Warning: Unknown prop/,
    /deprecated/i,           // deprecation warnings are ok
    /RevenueCat/,            // RC SDK warnings are informational, not errors
    /appUserID passed to logIn is the same/,
    /Using a Test Store API key/,
    /SecureStore/,           // SecureStore fails in Expo Go, works in dev builds
    /getRegistrationInfoAsync/,  // Push notifications fail in Expo Go
    /setValueWithKeyAsync/,
    /Calling the '.*Async' function has failed/,  // Native module not available in Expo Go
  ];

  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    const msg = args.map(String).join(' ');
    const skip = SKIP_PATTERNS.some((p) => p.test(msg));
    if (!skip && msg.length > 10) {
      reportError(`[WARN] ${msg.slice(0, 500)}`).catch(() => {});
    }
  };

  console.error = (...args: unknown[]) => {
    originalError(...args);
    const msg = args.map(String).join(' ');
    // Skip React render-phase logs that are noisy
    const skip = SKIP_PATTERNS.some((p) => p.test(msg));
    if (!skip && msg.length > 10) {
      reportError(`[ERROR] ${msg.slice(0, 500)}`).catch(() => {});
    }
  };
}
