import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { billingApi } from '../api/billing';
import { analytics } from '../services/analytics';

let RevenueCatUI: any = null;
try {
  RevenueCatUI = require('react-native-purchases-ui').default;
} catch {}
let Purchases: any = null;
try {
  const rc = require('react-native-purchases');
  Purchases = rc.default || rc;
} catch {}

const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

type EntitlementCheck = 'pro' | 'team' | null;

interface CancelOpts {
  /**
   * true when the user is on a backend-only trial (no App Store IAP yet).
   * In that case we cancel via `POST /billing/cancel` directly instead of
   * routing through the RC Customer Center (which has nothing to show).
   */
  isTrialing: boolean;
  /** Plan key for analytics (`pro` / `organization` / `free`). */
  planKey?: string;
  /** Cancellation reason captured by the retention modal. */
  reason?: string;
  /** Optional follow-up after a successful cancellation (e.g. router.replace). */
  onAfter?: () => void;
}

interface CancelResult {
  /** true if the cancellation actually went through. */
  cancelled: boolean;
  /** true if the user dismissed the Customer Center without cancelling. */
  dismissed: boolean;
}

const log = (...args: any[]) => console.log('[Cancel]', ...args);

async function checkRcEntitlement(): Promise<EntitlementCheck> {
  if (!Purchases || typeof Purchases.getCustomerInfo !== 'function') return null;
  try {
    const info = await Purchases.getCustomerInfo();
    const active = Object.keys(info?.entitlements?.active ?? {});
    if (active.some((k) => /^team$/i.test(k))) return 'team';
    if (active.some((k) => /^pro$/i.test(k))) return 'pro';
    return null;
  } catch (e: any) {
    log('getCustomerInfo failed:', e?.message);
    return null;
  }
}

export function useCancelSubscription() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useCallback(
    async (opts: CancelOpts): Promise<CancelResult> => {
      const { isTrialing, planKey, reason, onAfter } = opts;
      if (reason) {
        analytics.track('subscription_cancelled', {
          plan: planKey ?? 'unknown',
          reason,
        });
      }

      // ── Trial path: pure backend cancel, no Apple involvement ──────────
      if (isTrialing) {
        log('trial cancel → POST /billing/cancel');
        try {
          const res = await billingApi.cancel();
          log('trial cancel response:', res?.status, res?.data);
          await queryClient.invalidateQueries({ queryKey: ['billing'] });
          Alert.alert(
            t('subscription_plan.cancelled_title', 'Subscription Cancelled'),
            t('subscription_plan.cancelled_msg', 'Your trial has been cancelled.'),
            [{ text: 'OK', onPress: onAfter }],
          );
          return { cancelled: true, dismissed: false };
        } catch (e: any) {
          log('trial cancel failed:', e?.response?.status, e?.response?.data, e?.message);
          Alert.alert(
            t('common.error', 'Error'),
            e?.response?.data?.message || e?.message || t('common.something_went_wrong', 'Something went wrong'),
          );
          return { cancelled: false, dismissed: false };
        }
      }

      // ── IAP path: route through RC Customer Center / Apple Settings ────
      const beforeEntitlement = await checkRcEntitlement();
      log('IAP cancel — entitlement before:', beforeEntitlement);

      try {
        if (RevenueCatUI && typeof RevenueCatUI.presentCustomerCenter === 'function') {
          await RevenueCatUI.presentCustomerCenter();
        } else {
          await Linking.openURL(APPLE_MANAGE_URL);
        }
      } catch (e: any) {
        log('presentCustomerCenter failed, fallback to Apple URL:', e?.message);
        try {
          await Linking.openURL(APPLE_MANAGE_URL);
        } catch (e2: any) {
          Alert.alert(
            t('common.error', 'Error'),
            t(
              'subscription_plan.cancel_open_failed',
              'Could not open subscription settings. Open Settings → Apple ID → Subscriptions.',
            ),
          );
          return { cancelled: false, dismissed: false };
        }
      }

      // After Customer Center / Apple Settings closes: force RC sync, then
      // mirror into backend. RC may return cached info — getCustomerInfo with
      // `fetchPolicy: NETWORK_ONLY` would be ideal but isn't available on all
      // SDK versions, so we just check + reconcile. The backend webhook from
      // RC will eventually flip billingStatus regardless.
      const afterEntitlement = await checkRcEntitlement();
      log('IAP cancel — entitlement after:', afterEntitlement);

      const userCancelled =
        beforeEntitlement !== null && afterEntitlement === null;

      if (userCancelled) {
        try {
          const res = await billingApi.cancel();
          log('backend cancel response:', res?.status, res?.data);
        } catch (e: any) {
          log('backend cancel failed (non-fatal):', e?.response?.status, e?.message);
        }
        await queryClient.invalidateQueries({ queryKey: ['billing'] });
        Alert.alert(
          t('subscription_plan.cancelled_title', 'Subscription Cancelled'),
          t(
            'subscription_plan.cancelled_msg',
            "Your subscription has been cancelled. You'll keep access until the end of the current period.",
          ),
          [{ text: 'OK', onPress: onAfter }],
        );
        return { cancelled: true, dismissed: false };
      }

      // User dismissed the Customer Center without cancelling — stay quiet.
      // Still invalidate so any other RC-side change (renewal, plan switch) shows up.
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      return { cancelled: false, dismissed: true };
    },
    [queryClient, t],
  );
}

