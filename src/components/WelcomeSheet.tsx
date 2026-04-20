import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onAddWithAI: () => void;
  onSkip: () => void;
}

export function WelcomeSheet({ visible, onAddWithAI, onSkip }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onSkip());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onSkip} />
      </Animated.View>
      <Animated.View
        testID="welcome-sheet"
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={{ paddingVertical: 12, alignItems: 'center' }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </View>
        <Text style={[styles.emoji]}>👋</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('onboarding.welcome_title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('onboarding.welcome_subtitle')}
        </Text>

        <TouchableOpacity
          testID="welcome-add-ai"
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onAddWithAI}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {t('onboarding.welcome_add_ai')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity testID="welcome-skip" onPress={onSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: colors.textMuted }]}>
            {t('onboarding.skip_for_now')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
  },
});
