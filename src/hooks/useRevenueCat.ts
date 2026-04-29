import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';

let Purchases: any = null;
let PURCHASES_ERROR_CODE: any = {};
let LOG_LEVEL: any = {};

try {
  const rc = require('react-native-purchases');
  const mod = rc.default || rc;
  // Verify the native module is actually available (not just JS wrapper)
  if (mod && typeof mod.configure === 'function') {
    Purchases = mod;
    // PURCHASES_ERROR_CODE may be on the named export or on the default export
    PURCHASES_ERROR_CODE = rc.PURCHASES_ERROR_CODE ?? mod.PURCHASES_ERROR_CODE ?? {};
    LOG_LEVEL = rc.LOG_LEVEL ?? mod.LOG_LEVEL ?? {};
  }
} catch {
  // Native module not linked (Expo Go, simulator without dev build)
}

// RevenueCat public API keys are designed to be in client code (not a secret).
// Production key set via EXPO_PUBLIC_REVENUECAT_KEY_IOS in eas.json (production profile).
// Dev/TestFlight use test key (set via eas.json preview/testflight profiles or .env.local).
//
// IMPORTANT: no hardcoded fallback — a missing key in prod must fail fast so we never
// ship a build that silently uses the wrong (or no) billing SDK.
const RC_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS ?? process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? null;
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_KEY_ANDROID ?? process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? null;

/**
 * Resolve the RevenueCat API key for the current platform.
 *
 * Rules:
 * - Dev build + missing key  -> return null, log warning, no-op billing.
 * - Dev build + test key     -> return test key (expected).
 * - Prod build + missing key -> throw (fail fast, Sentry alert).
 * - Prod build + test key    -> throw (fail fast, Sentry alert — prevents shipping
 *                                       a build that runs against RC sandbox).
 */
export function resolveRcKey(): string | null {
  const key = Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID;

  if (!key) {
    if (!__DEV__) {
      Sentry.captureMessage('RevenueCat key missing in production build', 'fatal');
      throw new Error('RevenueCat key missing — billing will not work');
    }
    console.warn('[RC] key missing — billing disabled in dev');
    return null;
  }

  if (!__DEV__ && key.startsWith('test_')) {
    Sentry.captureMessage('RevenueCat TEST key in production build', 'fatal');
    throw new Error('RevenueCat misconfigured: test key in production');
  }

  return key;
}

const isAvailable = () => Purchases != null;

export function isRevenueCatAvailable(): boolean {
  if (!isAvailable()) return false;
  try {
    return !!resolveRcKey();
  } catch {
    return false;
  }
}

// Singleton configure promise. Ensures `configureRevenueCat()` is idempotent and that
// any caller (loginRevenueCat, the hook itself) can `await` a single shared init.
let configurePromise: Promise<void> | null = null;
let configured = false;

/**
 * Configure the RevenueCat SDK. Idempotent — subsequent calls return the same promise.
 * Resolves even when RC is not available (dev without native module) so callers can
 * safely `await` it without branching.
 */
export function configureRevenueCat(): Promise<void> {
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    if (!isAvailable()) return; // native module not linked
    let apiKey: string | null = null;
    try {
      apiKey = resolveRcKey();
    } catch (e) {
      // In prod this rethrows — we want that. Reset promise so a later retry (e.g. after
      // a fixed env) can try again instead of being cached.
      configurePromise = null;
      throw e;
    }
    if (!apiKey) return; // dev fallback — no-op

    try {
      if (__DEV__ && LOG_LEVEL?.DEBUG) await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      console.log('[RevenueCat] Configuring with key:', apiKey.slice(0, 8) + '...', 'platform:', Platform.OS);
      await Purchases.configure({ apiKey, appUserID: null });
      configured = true;
      console.log('[RevenueCat] Configured successfully');
    } catch (e) {
      if (__DEV__) console.warn('RevenueCat configure failed:', e);
      Sentry.captureException(e, { tags: { source: 'rc_configure' } });
      // Reset so a later caller can retry (e.g. network flake at cold start).
      configurePromise = null;
      configured = false;
      throw e;
    }
  })();

  return configurePromise;
}

/**
 * Log in a user to RevenueCat. Always configures first (configure-before-login is
 * required — RC will crash if you call logIn before configure).
 */
export async function loginRevenueCat(userId: string): Promise<void> {
  if (!isAvailable()) return;
  try {
    await configureRevenueCat();
    if (!configured) return; // dev fallback (no key) — skip
    await Purchases.logIn(userId);
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat logIn failed:', e);
    Sentry.captureException(e, { tags: { source: 'rc_login' } });
  }
}

export async function logoutRevenueCat(): Promise<void> {
  if (!isAvailable()) return;
  try {
    await configureRevenueCat();
    if (!configured) return;
    // RC throws code 22 ("LogOut was called but the current user is
    // anonymous") if the user never logIn'd or already logged out. We
    // pre-check and skip — same outcome, but avoids the noisy stack
    // trace in dev / Sentry.
    if (typeof Purchases.isAnonymous === 'function') {
      // fail-safe: if isAnonymous itself throws (SDK in bad state),
      // assume anon and skip — calling logOut() in that situation is
      // exactly what threw the noisy code-22 stack trace originally.
      const anon = await Purchases.isAnonymous().catch(() => true);
      if (anon) return;
    }
    await Purchases.logOut();
  } catch (e: any) {
    // Swallow the "anonymous user" case quietly — not actionable.
    // RC SDK can return the code as either string or number depending
    // on the bridge version, so accept both.
    if (e?.code === 22 || e?.code === '22') return;
    if (__DEV__) console.warn('RevenueCat logOut failed:', e);
  }
}

export function useRevenueCat() {
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [offerings, setOfferings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const prevEntitlementsRef = useRef<string>('');
  const queryClient = useQueryClient();

  const loadOfferings = useCallback(async () => {
    if (!isAvailable()) {
      console.warn('[RevenueCat] Native module not available');
      setLoading(false);
      return;
    }

    try {
      await configureRevenueCat();
    } catch (e) {
      console.warn('[RevenueCat] configure failed:', e);
      if (mountedRef.current) setLoading(false);
      return;
    }

    if (!configured) {
      if (mountedRef.current) setLoading(false);
      return;
    }

    try {
      const [info, off] = await Promise.all([
        Purchases.getCustomerInfo().catch((e: any) => { console.warn('[RevenueCat] getCustomerInfo error:', e?.message); return null; }),
        Purchases.getOfferings().catch((e: any) => { console.warn('[RevenueCat] getOfferings error:', e?.message); return null; }),
      ]);
      if (mountedRef.current) {
        if (info) setCustomerInfo(info);
        if (off) {
          setOfferings(off);
          console.log('[RevenueCat] Offerings loaded:', off?.current?.availablePackages?.length ?? 0, 'packages');
        } else {
          console.warn('[RevenueCat] Offerings are null — check RevenueCat dashboard products/offerings config');
        }
      }
    } catch (e) {
      console.warn('RevenueCat load failed:', e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let removeListener: (() => void) | null = null;

    const setup = async () => {
      await loadOfferings();

      // Add listener after loadOfferings (guaranteed configured at this point)
      if (configured && isAvailable() && mountedRef.current) {
        const listener = (info: any) => {
          try {
            if (!mountedRef.current || !info) return;
            setCustomerInfo(info);
            // Invalidate /billing/me whenever entitlements change so the UI
            // reflects Pro/Team instantly after StoreKit.Transaction.updates
            // fires (e.g. promoted purchase, renewal, restore from another
            // device). Paywall already handles its own sync loop; this
            // covers all OTHER paths that bypass paywall.
            const active = Object.keys(info?.entitlements?.active ?? {}).sort().join('|');
            if (active !== prevEntitlementsRef.current) {
              prevEntitlementsRef.current = active;
              queryClient.invalidateQueries({ queryKey: ['billing'] });
            }
          } catch {}
        };
        try {
          Purchases.addCustomerInfoUpdateListener(listener);
          removeListener = () => {
            try { Purchases.removeCustomerInfoUpdateListener(listener); } catch {}
          };
        } catch (e) {
          console.warn('RevenueCat listener failed:', e);
        }
      }
    };

    setup();

    return () => {
      mountedRef.current = false;
      if (removeListener) removeListener();
    };
  }, [loadOfferings]);

  // Check entitlements by substring (case-insensitive). RC dashboard ships
  // human-readable names like "SubRadar Pro" / "SubRadar Team", so a strict
  // /^(pro|team)$/i check returned false on every real purchase. Substring is
  // safe: entitlement keys are controlled by our RC configuration, no third
  // party writes them. We still ignore trial/etc by only reading the `active`
  // bucket (RC filters inactive for us).
  const activeEntitlements = customerInfo?.entitlements?.active ?? {};
  const activeKeys = Object.keys(activeEntitlements);
  const isTeam = activeKeys.some((k: string) => /team|org/i.test(k));
  const isPro = isTeam || activeKeys.some((k: string) => /pro|premium/i.test(k));

  if (__DEV__ && customerInfo) {
    console.log('[RevenueCat] Active entitlements:', activeKeys, 'isPro:', isPro);
  }

  // Check if a specific package has a free trial introductory offer
  const packageHasTrial = (pkg: any): boolean => {
    return !!(pkg?.product?.introPrice?.price === 0 || pkg?.product?.introPrice?.periodUnit != null);
  };

  // Check if any package has a free trial introductory offer
  const trialEligiblePackages = (offerings?.current?.availablePackages ?? []).filter(packageHasTrial);
  const hasTrialOffer = trialEligiblePackages.length > 0;

  // Get trial duration in days from first trial-eligible package (for UI display).
  //
  // Use UTC dates + Math.floor to avoid DST boundaries and local-time rollover
  // shifting the displayed number by ±1 day (e.g. user in UTC-8 seeing "6 days"
  // for a 7-day trial because local midnight lands before UTC midnight).
  const trialDurationDays = (() => {
    const pkg = trialEligiblePackages[0];
    if (!pkg) return null;
    const intro = pkg.product?.introPrice;
    if (!intro) return null;
    const cycles = intro.cycles ?? 1;
    const unit = intro.periodUnit?.toUpperCase?.();
    const num = intro.periodNumberOfUnits ?? 1;

    // Compute end date by stepping the UTC calendar forward, then diff in
    // whole UTC days. This treats 1 MONTH as "add 1 to UTC month" rather than
    // a naive 30-day approximation, avoiding the ~5 day drift on yearly trials.
    const start = new Date();
    const end = new Date(start.getTime());
    const total = cycles * num;
    if (unit === 'DAY') {
      end.setUTCDate(end.getUTCDate() + total);
    } else if (unit === 'WEEK') {
      end.setUTCDate(end.getUTCDate() + total * 7);
    } else if (unit === 'MONTH') {
      end.setUTCMonth(end.getUTCMonth() + total);
    } else if (unit === 'YEAR') {
      end.setUTCFullYear(end.getUTCFullYear() + total);
    } else {
      // Fallback: assume weeks if unknown unit
      end.setUTCDate(end.getUTCDate() + total * 7);
    }
    const ms = end.getTime() - start.getTime();
    return Math.floor(ms / 86_400_000);
  })();

  const purchasePackage = useCallback(async (pkg: any): Promise<boolean> => {
    if (!isAvailable()) return false;
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      const activeEntitlements = info?.entitlements?.active ?? {};
      const entitlementKeys = Object.keys(activeEntitlements);
      console.log('[RevenueCat] Purchase done, active entitlements:', entitlementKeys);
      // RC dashboard uses human-readable names ("SubRadar Pro"), so match by
      // substring — identical rule to the top-level isPro/isTeam above.
      const hasProOrTeam = entitlementKeys.some(
        (k: string) => /pro|team|premium|org/i.test(k),
      );
      // If the transaction posted but no entitlement key appeared yet, treat
      // it as success — paywall will poll /billing/me to confirm anyway.
      if (!hasProOrTeam && entitlementKeys.length === 0) {
        console.log('[RevenueCat] No entitlements found but purchase succeeded, treating as success');
        return true;
      }
      return hasProOrTeam || entitlementKeys.length > 0;
    } catch (error: any) {
      console.log('[RevenueCat] Purchase error code:', error?.code, 'message:', error?.message);
      if (error?.code === PURCHASES_ERROR_CODE?.PURCHASE_CANCELLED_ERROR) {
        return false;
      }
      if (error?.code === PURCHASES_ERROR_CODE?.PRODUCT_ALREADY_PURCHASED_ERROR) {
        const { success } = await restorePurchases();
        return success;
      }
      Alert.alert('Purchase Error', error?.message || 'Unknown error');
      return false;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<{ success: boolean; customerInfo: any | null }> => {
    if (!isAvailable()) return { success: false, customerInfo: null };
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const restoredKeys = Object.keys(info?.entitlements?.active ?? {});
      // Loose substring match — RC entitlement keys in the dashboard are
      // human-readable ("SubRadar Pro", "SubRadar Team"), not the strict
      // lowercase tokens the previous /^(pro|team)$/i regex required. The
      // strict version returned `success: false` on every legitimate
      // restore, blocking the post-restore sync that mirrors the entitlement
      // into the backend.
      const success = restoredKeys.some((k: string) =>
        /(^|\b)(pro|team|organization|premium|org)(\b|$)/i.test(k),
      );
      return { success, customerInfo: info };
    } catch (error: any) {
      Alert.alert('Restore Error', error?.message || 'Unknown error');
      return { success: false, customerInfo: null };
    }
  }, []);

  return { customerInfo, offerings, isPro, isTeam, hasTrialOffer, packageHasTrial, trialDurationDays, purchasePackage, restorePurchases, loading, loadOfferings };
}

/**
 * TEST-ONLY helper to reset the module-level singletons between tests.
 * Exported under an obvious name so production code doesn't accidentally call it.
 */
export function __resetRevenueCatForTests() {
  configurePromise = null;
  configured = false;
}
