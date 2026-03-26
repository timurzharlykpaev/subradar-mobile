import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  planName: string;
  onDone: () => void;
}

export function PurchaseSuccessScreen({ visible, planName, onDone }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.6);
      checkScale.setValue(0);
      confettiAnim.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 200, useNativeDriver: true }),
      ]),
      Animated.spring(checkScale, { toValue: 1, damping: 10, stiffness: 260, useNativeDriver: true }),
      Animated.timing(confettiAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  const planColor = planName === 'Team' ? '#06B6D4' : '#8B5CF6';

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, {
        backgroundColor: isDark ? '#12122A' : '#FFFFFF',
        transform: [{ scale }],
      }]}>
        {/* Decorative glow */}
        <View style={[styles.glow, { backgroundColor: planColor + '20' }]} />

        {/* Confetti dots */}
        {[...Array(8)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.confettiDot,
              {
                backgroundColor: ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#22C55E'][i],
                top: [20, 40, 15, 60, 10, 50, 30, 45][i],
                left: [30, 60, 100, 150, 200, 240, 280, 180][i] * (width / 400),
                transform: [
                  {
                    translateY: confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -40 - i * 5],
                    }),
                  },
                  {
                    rotate: confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${(i % 2 === 0 ? 1 : -1) * 180}deg`],
                    }),
                  },
                ],
                opacity: confettiAnim,
              },
            ]}
          />
        ))}

        {/* Checkmark circle */}
        <Animated.View style={[styles.checkCircle, {
          backgroundColor: planColor,
          transform: [{ scale: checkScale }],
          shadowColor: planColor,
        }]}>
          <Ionicons name="checkmark" size={48} color="#FFF" />
        </Animated.View>

        {/* Text */}
        <Text style={[styles.title, { color: colors.text }]}>
          {t('paywall.upgrade_success', 'You\'re all set! 🎉')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('paywall.upgrade_success_msg_plan', { plan: planName, defaultValue: `Welcome to {{plan}}!` })}
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('paywall.upgrade_success_hint', 'All features are now unlocked and ready to use.')}
        </Text>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: planColor }]}
          onPress={onDone}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{t('paywall.upgrade_success_cta', 'Start exploring →')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
  },
  glow: {
    position: 'absolute',
    top: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  confettiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
});
