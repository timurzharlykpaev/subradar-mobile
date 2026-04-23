import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { useSettingsStore } from '../stores/settingsStore';

interface Props {
  visible: boolean;
  onStartTrial: () => void;
  onSkip: () => void;
  isPending: boolean;
}

export function TrialOfferModal({ visible, onStartTrial, onSkip, isPending }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
  const currency = useSettingsStore((s) => s.currency || 'USD');
  const symbol = currency === 'RUB' ? '₽' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  // Personalised monthly spend from active subs — shown as loss-framing hook
  const monthlySpend = React.useMemo(() => {
    return subscriptions
      .filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL')
      .reduce((sum, s) => {
        const mult =
          s.billingPeriod === 'WEEKLY' ? 4 :
          s.billingPeriod === 'QUARTERLY' ? 1 / 3 :
          s.billingPeriod === 'YEARLY' ? 1 / 12 : 1;
        return sum + (Number(s.amount) || 0) * mult;
      }, 0);
  }, [subscriptions]);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 18,
          stiffness: 160,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.9);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View testID="trial-offer-modal" style={[styles.backdrop, { opacity }]}>
        <View style={styles.center}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                transform: [{ scale }],
              },
            ]}
          >
            <Text style={styles.emoji}>🎉</Text>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('onboarding.trial_title')}
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {t('onboarding.trial_description')}
            </Text>
            {monthlySpend > 0 && (
              <View style={{ backgroundColor: colors.surface2, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                  {t('onboarding.trial_spend_hook', {
                    defaultValue: "You're tracking {{amount}}/mo — unlock the full picture",
                    amount: `${symbol}${monthlySpend.toFixed(2)}`,
                  })}
                </Text>
              </View>
            )}

            <TouchableOpacity
              testID="trial-offer-start"
              style={[styles.trialButton, { backgroundColor: colors.success }]}
              onPress={onStartTrial}
              activeOpacity={0.85}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.trialButtonText}>
                  {t('onboarding.trial_start')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity testID="trial-offer-skip" onPress={onSkip} activeOpacity={0.7} disabled={isPending}>
              <Text style={[styles.skipText, { color: colors.textMuted }]}>
                {t('onboarding.trial_skip')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  trialButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  trialButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
});
