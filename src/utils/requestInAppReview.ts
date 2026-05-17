import { Platform } from 'react-native';

/**
 * Thin wrapper around `react-native-in-app-review` (SKStoreReviewController on
 * iOS, Google Play In-App Review on Android). The library is loaded lazily
 * via require so Expo Go / unit tests that don't link the native module
 * don't crash on import.
 *
 * Returns true if the platform actually invoked the prompt (best-effort —
 * Apple deliberately gives no signal whether the user rated, dismissed, or
 * silently hit the 3-per-365-day budget).
 */
export async function requestInAppReview(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  let InAppReview: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    InAppReview = require('react-native-in-app-review').default;
  } catch {
    return false;
  }
  if (!InAppReview?.isAvailable?.()) return false;
  try {
    const result = await InAppReview.RequestInAppReview();
    return result === true;
  } catch {
    return false;
  }
}

/**
 * Whether the native flow is even reachable on this device. Use this to
 * hide the "Rate" settings row on devices where it would be a no-op (very
 * old Android, sideloaded builds without Play Services).
 */
export function isInAppReviewAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const InAppReview = require('react-native-in-app-review').default;
    return InAppReview?.isAvailable?.() === true;
  } catch {
    return false;
  }
}
