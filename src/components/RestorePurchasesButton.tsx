import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { billingApi } from '../api/billing';
import { isRevenueCatAvailable, useRevenueCat } from '../hooks/useRevenueCat';
import { analytics } from '../services/analytics';
import { useTheme } from '../theme';

interface Props {
  /** Where the button is rendered — used for analytics segmentation. */
  origin: 'paywall' | 'settings';
  /** Render as an underlined inline link (used on paywall / settings). */
  styleLink?: boolean;
}

/**
 * Single source of truth for "Restore Purchases" UX.
 *
 * Flow:
 *   1. analytics.restoreInitiated(origin)
 *   2. call RC restorePurchases() → derive productId from active entitlement
 *   3. if productId found → POST /billing/sync-revenuecat to reconcile server-side
 *   4. invalidate the billing cache so UI reflects the new plan immediately
 *   5. analytics.restoreCompleted(origin, success)
 *   6. alert the user (success / nothing-to-restore / error)
 *
 * On RC not being linked (Expo Go / simulator), surfaces a clear explanation
 * instead of a confusing "no subscriptions found" dialog.
 */
export function RestorePurchasesButton({ origin, styleLink = false }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { restorePurchases } = useRevenueCat();
  const queryClient = useQueryClient();

  const buttonLabel = t('billing.restore.button', 'Restore purchases');

  const handlePress = async () => {
    if (loading) return;

    if (!isRevenueCatAvailable()) {
      Alert.alert(
        t('billing.restore.unavailableTitle', 'Unavailable'),
        t(
          'billing.restore.unavailableMessage',
          'Purchases are not configured in this build. Try the App Store / Google Play version of the app.',
        ),
      );
      return;
    }

    analytics.restoreInitiated(origin);
    setLoading(true);
    try {
      const { success, customerInfo } = await restorePurchases();
      // RC returns the full CustomerInfo — derive the product identifier from
      // the currently-active entitlement.
      //
      // Drift hazard: when a user cancels Team and immediately buys Pro (or
      // vice-versa), the cancelled entitlement is STILL active until the
      // period ends, so plain "team ?? pro" picks the stale productId, calls
      // /billing/sync-revenuecat with it, and the backend re-stamps the user
      // back to Team with `cancelAtPeriodEnd=false`. To prevent that we
      // prefer entitlements whose underlying subscription `willRenew=true`
      // (i.e. NOT scheduled for cancellation) and fall back to whatever's
      // active only if neither will renew.
      const activeEntitlement = customerInfo?.entitlements?.active;
      const teamEnt = activeEntitlement?.team;
      const proEnt = activeEntitlement?.pro;
      const subsMap: Record<string, any> =
        (customerInfo as any)?.subscriptionsByProductIdentifier ?? {};
      const willRenew = (productIdentifier?: string) =>
        productIdentifier
          ? subsMap[productIdentifier]?.willRenew !== false
          : false;
      const teamWillRenew = willRenew(teamEnt?.productIdentifier);
      const proWillRenew = willRenew(proEnt?.productIdentifier);
      const productId: string | undefined =
        (teamWillRenew && teamEnt?.productIdentifier) ||
        (proWillRenew && proEnt?.productIdentifier) ||
        teamEnt?.productIdentifier ||
        proEnt?.productIdentifier;

      if (success && productId) {
        try {
          await billingApi.syncRevenueCat(productId);
        } catch (syncError) {
          // Apple receipt is valid — server sync will eventually reconcile
          // via the RC webhook. Don't fail the whole flow.
          if (__DEV__) console.warn('[Restore] backend sync failed:', syncError);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      analytics.restoreCompleted(origin, success, productId);

      Alert.alert(
        success
          ? t('billing.restore.successTitle', 'Done')
          : t('billing.restore.notFoundTitle', 'Not found'),
        success
          ? t('billing.restore.successMessage', 'Purchases restored.')
          : t(
              'billing.restore.notFoundMessage',
              'No active subscriptions found on this Apple ID / Google account.',
            ),
      );
    } catch (error: any) {
      analytics.restoreFailed(origin, error?.message);
      Alert.alert(
        t('billing.restore.errorTitle', 'Error'),
        error?.message ?? t('billing.restore.errorMessage', 'Failed to restore purchases.'),
      );
    } finally {
      setLoading(false);
    }
  };

  if (styleLink) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        style={styles.linkContainer}
      >
        {loading ? (
          <ActivityIndicator color={colors.textMuted} size="small" />
        ) : (
          <Text style={[styles.linkText, { color: colors.textMuted }]}>
            {buttonLabel}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={buttonLabel}
      style={[styles.buttonContainer, { borderColor: colors.border }]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          {buttonLabel}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  linkContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  linkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
