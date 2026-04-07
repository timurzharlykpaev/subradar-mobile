import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface Props {
  currentPeriodEnd: string;
  /** 'compact' for analytics, 'full' for dashboard/settings */
  variant?: 'compact' | 'full';
  onDismiss?: () => void;
}

export default function ExpirationBanner({ currentPeriodEnd, variant = 'full', onDismiss }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const endDate = new Date(currentPeriodEnd);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000));

  const formattedDate = endDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const isUrgent = daysLeft <= 3;
  const bgColor = isUrgent ? '#FEE2E2' : '#FFF7ED';
  const borderColor = isUrgent ? '#FECACA' : '#FED7AA';
  const textColor = isUrgent ? '#DC2626' : '#EA580C';
  const iconColor = isUrgent ? '#EF4444' : '#F97316';

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        onPress={() => router.push('/paywall' as any)}
        activeOpacity={0.7}
        style={[styles.compactContainer, { backgroundColor: bgColor, borderColor }]}
      >
        <Ionicons name="warning" size={16} color={iconColor} />
        <Text style={[styles.compactText, { color: textColor }]} numberOfLines={1}>
          {t('retention.pro_ends_in', { count: daysLeft, defaultValue: `Pro ends in ${daysLeft} days` })}
        </Text>
        <Text style={[styles.compactCta, { color: textColor }]}>
          {t('retention.reactivate', 'Reactivate')}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name="warning" size={20} color={iconColor} />
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={18} color={textColor + '80'} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.title, { color: textColor }]}>
        {t('retention.pro_ends_in', { count: daysLeft, defaultValue: `Pro ends in ${daysLeft} days` })}
      </Text>
      <Text style={[styles.subtitle, { color: textColor + 'CC' }]}>
        {t('retention.expires_on', { date: formattedDate, defaultValue: `Your Pro plan expires on ${formattedDate}` })}
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/paywall' as any)}
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
  // Compact
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  compactText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  compactCta: {
    fontSize: 13,
    fontWeight: '700',
  },
});
