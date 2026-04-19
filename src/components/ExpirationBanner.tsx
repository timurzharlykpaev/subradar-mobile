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

  useEffect(() => {
    analytics.track('banner_shown', { priority: 'expiration', daysLeft, endsAt });
  }, [daysLeft, endsAt]);

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

  return (
    <View
      testID="expiration-banner"
      style={[styles.container, { backgroundColor: bgColor, borderColor }]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name="warning" size={20} color={iconColor} />
        </View>
      </View>
      <Text style={[styles.title, { color: textColor }]}>
        {t('retention.pro_ends_in', { count: daysLeft, defaultValue: `Pro ends in ${daysLeft} days` })}
      </Text>
      {formattedDate ? (
        <Text style={[styles.subtitle, { color: textColor + 'CC' }]}>
          {t('retention.expires_on', { date: formattedDate, defaultValue: `Your Pro plan expires on ${formattedDate}` })}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={onReactivate}
        style={[styles.ctaBtn, { backgroundColor: iconColor }]}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh" size={16} color="#FFF" />
        <Text style={styles.ctaText}>
          {t('retention.reactivate', 'Reactivate')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
