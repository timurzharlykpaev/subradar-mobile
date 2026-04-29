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
 * Compact single-row banner that warns the user their paid plan is
 * winding down. Layout:
 *
 *   [⚠]  Team ends in 1 day · Apr 30        [Reactivate]
 *
 * Earlier version stacked icon → title → subtitle → CTA into a tall
 * 4-row card that ate roughly 1/3 of the screen on small phones; the
 * user reported it as "слишком большой". Now everything sits inline:
 * icon + text on the left, CTA button on the right.
 */
export default function ExpirationBanner({ payload }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const daysLeft =
    typeof payload.daysLeft === 'number'
      ? payload.daysLeft
      : typeof payload.daysLeft === 'string'
      ? Number(payload.daysLeft) || 0
      : 0;
  const endsAt = typeof payload.endsAt === 'string' ? payload.endsAt : null;
  // Backend tags the banner with the actual plan ('pro' | 'organization').
  const planKey = payload.plan === 'organization' ? 'team' : 'pro';
  const planLabel = planKey === 'team' ? 'Team' : 'Pro';

  useEffect(() => {
    analytics.track('banner_shown', { priority: 'expiration', daysLeft, endsAt, plan: planKey });
  }, [daysLeft, endsAt, planKey]);

  const endDate = endsAt ? new Date(endsAt) : null;
  const formattedDate = endDate
    ? endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  const isUrgent = daysLeft <= 3;
  const bgColor = isUrgent ? '#FEE2E2' : '#FFF7ED';
  const borderColor = isUrgent ? '#FECACA' : '#FED7AA';
  const textColor = isUrgent ? '#DC2626' : '#EA580C';
  const iconColor = isUrgent ? '#EF4444' : '#F97316';

  const onReactivate = () => {
    analytics.track('banner_action_tapped', { priority: 'expiration', daysLeft, endsAt });
    router.push('/paywall' as any);
  };

  const titleText = t('retention.plan_ends_in', {
    count: daysLeft,
    plan: planLabel,
    defaultValue: `${planLabel} ends in ${daysLeft} days`,
  });

  return (
    <View
      testID="expiration-banner"
      style={[styles.container, { backgroundColor: bgColor, borderColor }]}
    >
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor + '22' }]}>
          <Ionicons name="warning" size={16} color={iconColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {titleText}
          </Text>
          {formattedDate ? (
            <Text style={[styles.subtitle, { color: textColor + 'CC' }]} numberOfLines={1}>
              {t('retention.expires_short', {
                date: formattedDate,
                defaultValue: `Until ${formattedDate}`,
              })}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={onReactivate}
          style={[styles.ctaBtn, { backgroundColor: iconColor }]}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>
            {t('retention.reactivate', 'Reactivate')}
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  ctaBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});
