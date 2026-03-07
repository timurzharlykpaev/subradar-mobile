import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants';

interface TrialData {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cancelUrl?: string;
  daysUntilTrialEnd: number | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

interface Props {
  trials: TrialData[];
}

export const TrialCountdown: React.FC<Props> = ({ trials }) => {
  const { t } = useTranslation();

  if (trials.length === 0) return null;

  const sorted = [...trials].sort(
    (a, b) => (a.daysUntilTrialEnd ?? 99) - (b.daysUntilTrialEnd ?? 99),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('trials.title')}</Text>
      {sorted.map((trial) => {
        const days = trial.daysUntilTrialEnd;
        const isUrgent = trial.isExpiringSoon;
        const isExpired = trial.isExpired;

        const badgeColor = isExpired
          ? COLORS.error
          : isUrgent
          ? COLORS.warning
          : '#3B82F6';

        const daysText = isExpired
          ? t('trials.expired')
          : days === 0
          ? t('trials.ends_today')
          : days === 1
          ? t('trials.ends_tomorrow')
          : t('trials.days_left', { count: days });

        return (
          <View key={trial.id} style={styles.card}>
            <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>{daysText}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{trial.name}</Text>
              <Text style={styles.price}>
                {t('trials.then')} {trial.currency} {trial.amount.toFixed(2)}
              </Text>
            </View>
            {trial.cancelUrl && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => Linking.openURL(trial.cancelUrl!)}
              >
                <Text style={styles.cancelText}>{t('trials.cancel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 0 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  price: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.error + '15',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error,
  },
});
