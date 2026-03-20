import { useEffect, useState, useCallback } from 'react';
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Alert } from 'react-native';

const API_KEY = 'test_KCkKkTcGjgMgysTZtGukFRBZBBh';

let configured = false;

export function configureRevenueCat() {
  if (configured) return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: API_KEY, appUserID: null });
  configured = true;
}

export async function loginRevenueCat(userId: string) {
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('RevenueCat logIn failed:', e);
  }
}

export async function logoutRevenueCat() {
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('RevenueCat logOut failed:', e);
  }
}

export function useRevenueCat() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    const listener = (info: CustomerInfo) => {
      if (mounted) setCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const isPro = !!(
    customerInfo?.entitlements.active['pro'] ||
    customerInfo?.entitlements.active['team']
  );

  const isTeam = !!customerInfo?.entitlements.active['team'];

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return !!(info.entitlements.active['pro'] || info.entitlements.active['team']);
    } catch (error: any) {
      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return false;
      }
      if (error.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
        const restored = await restorePurchases();
        return restored;
      }
      Alert.alert('Purchase Error', error.message);
      return false;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return !!(info.entitlements.active['pro'] || info.entitlements.active['team']);
    } catch (error: any) {
      Alert.alert('Restore Error', error.message);
      return false;
    }
  }, []);

  return { customerInfo, offerings, isPro, isTeam, purchasePackage, restorePurchases, loading };
}
