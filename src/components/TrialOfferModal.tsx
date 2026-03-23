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

interface Props {
  visible: boolean;
  onStartTrial: () => void;
  onSkip: () => void;
  isPending: boolean;
}

export function TrialOfferModal({ visible, onStartTrial, onSkip, isPending }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
      <Animated.View style={[styles.backdrop, { opacity }]}>
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

            <TouchableOpacity
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

            <TouchableOpacity onPress={onSkip} activeOpacity={0.7} disabled={isPending}>
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
