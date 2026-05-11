import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { analytics } from '../services/analytics';

interface Props {
  payload: Record<string, unknown>;
}

/**
 * Banner shown for 7 days after Apple/Google reverses a charge
 * (RC_REFUND webhook on the backend → `dates.refundedAt` populated
 * and `banner.priority === 'refund'`).
 *
 * Without this banner the user loses Pro access silently and the
 * downgrade reads as a bug — they often open support tickets that
 * are really refund confusion. The copy explains what happened and
 * routes to the paywall so they can re-subscribe if the refund was
 * accidental.
 *
 * Visual style mirrors ExpirationBanner: compact inline row,
 * amber-warning tint (not red — refund isn't an error from the user's
 * side, it's an Apple-driven event).
 */
export default function RefundBanner({ payload }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const daysSinceRefund =
    typeof payload.daysSinceRefund === 'number' ? payload.daysSinceRefund : 0;

  useEffect(() => {
    analytics.track('banner_shown', {
      priority: 'refund',
      daysSinceRefund,
    });
  }, [daysSinceRefund]);

  const bgColor = '#FFF7ED';
  const borderColor = '#FED7AA';
  const textColor = '#9A3412';
  const iconColor = '#EA580C';

  const onSubscribe = () => {
    analytics.track('banner_action_tapped', {
      priority: 'refund',
      daysSinceRefund,
    });
    router.push('/paywall' as any);
  };

  return (
    <View
      testID="refund-banner"
      style={[styles.container, { backgroundColor: bgColor, borderColor }]}
    >
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor + '22' }]}>
          <Ionicons name="receipt-outline" size={16} color={iconColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {t('refund.title', 'Refund processed')}
          </Text>
          <Text
            style={[styles.subtitle, { color: textColor + 'CC' }]}
            numberOfLines={2}
          >
            {t(
              'refund.subtitle',
              'Your subscription was refunded and access removed',
            )}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onSubscribe}
          activeOpacity={0.8}
          style={[styles.cta, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.ctaText}>
            {t('refund.cta', 'Subscribe')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 2, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 12 },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ctaText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
});
