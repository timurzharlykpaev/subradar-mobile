import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
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
  const [loading, setLoading] = useState(false);
  const { restorePurchases } = useRevenueCat();
  const queryClient = useQueryClient();

  const handlePress = async () => {
    if (loading) return;

    if (!isRevenueCatAvailable()) {
      Alert.alert(
        'Недоступно',
        'Покупки не настроены на этой сборке. Попробуйте в App Store / Google Play версии приложения.',
      );
      return;
    }

    analytics.restoreInitiated(origin);
    setLoading(true);
    try {
      const { success, customerInfo } = await restorePurchases();
      // RC returns the full CustomerInfo — derive the product identifier from
      // the currently-active entitlement (team preferred over pro if both
      // somehow appear). This is what the backend needs to map Apple's
      // receipt → our Plan/source.
      const activeEntitlement = customerInfo?.entitlements?.active;
      const productId: string | undefined =
        activeEntitlement?.team?.productIdentifier ??
        activeEntitlement?.pro?.productIdentifier;

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
        success ? 'Готово' : 'Не найдено',
        success
          ? 'Покупки восстановлены.'
          : 'Активных подписок на этом Apple ID / Google-аккаунте не найдено.',
      );
    } catch (error: any) {
      analytics.restoreFailed(origin, error?.message);
      Alert.alert('Ошибка', error?.message ?? 'Не удалось восстановить покупки.');
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
        accessibilityLabel="Восстановить покупки"
        style={styles.linkContainer}
      >
        {loading ? (
          <ActivityIndicator color={colors.textMuted} size="small" />
        ) : (
          <Text style={[styles.linkText, { color: colors.textMuted }]}>
            Восстановить покупки
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
      accessibilityLabel="Восстановить покупки"
      style={[styles.buttonContainer, { borderColor: colors.border }]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          Восстановить покупки
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
