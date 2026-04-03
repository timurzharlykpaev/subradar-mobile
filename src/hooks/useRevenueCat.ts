import { useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';

let Purchases: any = null;
let PURCHASES_ERROR_CODE: any = {};
let LOG_LEVEL: any = {};

try {
  const rc = require('react-native-purchases');
  const mod = rc.default || rc;
  // Verify the native module is actually available (not just JS wrapper)
  if (mod && typeof mod.configure === 'function') {
    Purchases = mod;
    PURCHASES_ERROR_CODE = rc.PURCHASES_ERROR_CODE || {};
    LOG_LEVEL = rc.LOG_LEVEL || {};
  }
} catch {
  // Native module not linked (Expo Go, simulator without dev build)
}

// RevenueCat public API keys are designed to be in client code (not a secret).
// Production key set via EXPO_PUBLIC_REVENUECAT_KEY in eas.json (production profile).
// Dev/TestFlight use test key (set via eas.json preview profiles or .env.local).
import { Platform } from 'react-native';
const RC_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_KEY_IOS || process.env.EXPO_PUBLIC_REVENUECAT_KEY || 'test_KCkKkTcGjgMgysTZtGukFRBZBBh';
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_KEY_ANDROID || process.env.EXPO_PUBLIC_REVENUECAT_KEY || 'test_KCkKkTcGjgMgysTZtGukFRBZBBh';
const API_KEY = Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID;

let configured = false;

const isAvailable = () => Purchases != null;

export function configureRevenueCat() {
  if (configured || !isAvailable()) return;
  try {
    if (__DEV__ && LOG_LEVEL?.DEBUG) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: API_KEY, appUserID: null });
    configured = true;
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat configure failed:', e);
  }
}

export async function loginRevenueCat(userId: string) {
  if (!isAvailable() || !configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat logIn failed:', e);
  }
}

export async function logoutRevenueCat() {
  if (!isAvailable() || !configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    if (__DEV__) console.warn('RevenueCat logOut failed:', e);
  }
}

export function useRevenueCat() {
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [offerings, setOfferings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured || !isAvailable()) { setLoading(false); return; }
    let mounted = true;
    let listenerAdded = false;

    const load = async () => {
      try {
        const [info, off] = await Promise.all([
          Purchases.getCustomerInfo().catch(() => null),
          Purchases.getOfferings().catch(() => null),
        ]);
        if (mounted) {
          if (info) setCustomerInfo(info);
          if (off) setOfferings(off);
        }
      } catch (e) {
        console.warn('RevenueCat load failed:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const listener = (info: any) => {
      try {
        if (mounted && info) setCustomerInfo(info);
      } catch {}
    };
    try {
      Purchases.addCustomerInfoUpdateListener(listener);
      listenerAdded = true;
    } catch (e) {
      console.warn('RevenueCat listener failed:', e);
    }

    return () => {
      mounted = false;
      if (listenerAdded) {
        try { Purchases.removeCustomerInfoUpdateListener(listener); } catch {}
      }
    };
  }, []);

  // Check entitlements case-insensitively (RC dashboard may use Pro/pro/PRO)
  const activeEntitlements = customerInfo?.entitlements?.active ?? {};
  const activeKeys = Object.keys(activeEntitlements);
  const isPro = activeKeys.some((k: string) => /^(pro|team)$/i.test(k)) || activeKeys.length > 0;

  if (__DEV__ && customerInfo) {
    console.log('[RevenueCat] Active entitlements:', activeKeys, 'isPro:', isPro);
  }

  const isTeam = !!customerInfo?.entitlements?.active?.['team'];

  const purchasePackage = useCallback(async (pkg: any): Promise<boolean> => {
    if (!isAvailable()) return false;
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      const activeEntitlements = info?.entitlements?.active ?? {};
      const entitlementKeys = Object.keys(activeEntitlements);
      console.log('[RevenueCat] Purchase done, active entitlements:', entitlementKeys);
      // Check for any active entitlement (pro, team, Pro, Team, etc.)
      const hasProOrTeam = entitlementKeys.some(
        (k: string) => /^(pro|team)$/i.test(k)
      );
      // If product was purchased but entitlement not recognized, still treat as success
      // since the transaction went through (receipt was posted successfully)
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
      const success = !!(info.entitlements.active['pro'] || info.entitlements.active['team']);
      return { success, customerInfo: info };
    } catch (error: any) {
      Alert.alert('Restore Error', error?.message || 'Unknown error');
      return { success: false, customerInfo: null };
    }
  }, []);

  return { customerInfo, offerings, isPro, isTeam, purchasePackage, restorePurchases, loading };
}
