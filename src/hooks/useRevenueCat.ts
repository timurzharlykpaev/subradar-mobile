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

const API_KEY = 'test_KCkKkTcGjgMgysTZtGukFRBZBBh';

let configured = false;

const isAvailable = () => Purchases != null;

export function configureRevenueCat() {
  if (configured || !isAvailable()) return;
  try {
    if (__DEV__ && LOG_LEVEL?.DEBUG) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: API_KEY, appUserID: null });
    configured = true;
  } catch (e) {
    console.warn('RevenueCat configure failed:', e);
  }
}

export async function loginRevenueCat(userId: string) {
  if (!isAvailable() || !configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('RevenueCat logIn failed:', e);
  }
}

export async function logoutRevenueCat() {
  if (!isAvailable() || !configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('RevenueCat logOut failed:', e);
  }
}

export function useRevenueCat() {
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [offerings, setOfferings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured || !isAvailable()) { setLoading(false); return; }
    let mounted = true;

    const load = async () => {
      try {
        const [info, off] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (mounted) {
          setCustomerInfo(info);
          setOfferings(off);
        }
      } catch (e) {
        console.warn('RevenueCat load failed:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const listener = (info: any) => {
      if (mounted) setCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const isPro = !!(
    customerInfo?.entitlements?.active?.['pro'] ||
    customerInfo?.entitlements?.active?.['team']
  );

  const isTeam = !!customerInfo?.entitlements?.active?.['team'];

  const purchasePackage = useCallback(async (pkg: any): Promise<boolean> => {
    if (!isAvailable()) return false;
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return !!(info.entitlements.active['pro'] || info.entitlements.active['team']);
    } catch (error: any) {
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
