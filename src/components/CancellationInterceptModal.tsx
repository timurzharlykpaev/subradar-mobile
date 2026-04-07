import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirmCancel: () => void;
}

const LOSE_ITEMS: { icon: React.ComponentProps<typeof Ionicons>['name']; key: string; fallback: string }[] = [
  { icon: 'infinite-outline', key: 'retention.lose_unlimited', fallback: 'Unlimited subscriptions' },
  { icon: 'sparkles-outline', key: 'retention.lose_ai', fallback: '200 AI analyses per month' },
  { icon: 'analytics-outline', key: 'retention.lose_analytics', fallback: 'Advanced analytics & forecasts' },
  { icon: 'document-text-outline', key: 'retention.lose_reports', fallback: 'PDF reports & exports' },
];

export default function CancellationInterceptModal({ visible, onClose, onConfirmCancel }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, damping: 18, stiffness: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleSpecialOffer = () => {
    onClose();
    router.push('/paywall' as any);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[
              styles.sheet,
              { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF', transform: [{ scale: scaleAnim }] },
            ]}>
              {/* Warning icon */}
              <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="heart-dislike" size={32} color="#EF4444" />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.text }]}>
                {t('retention.cancel_title', 'Are you sure?')}
              </Text>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                {t('retention.cancel_desc', "Here's what you'll lose with your Pro plan:")}
              </Text>

              {/* What you'll lose */}
              <View style={styles.loseList}>
                {LOSE_ITEMS.map((item, i) => (
                  <View key={i} style={[styles.loseRow, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2' }]}>
                    <View style={[styles.loseIconCircle, { backgroundColor: '#EF4444' + '20' }]}>
                      <Ionicons name={item.icon} size={18} color="#EF4444" />
                    </View>
                    <Text style={[styles.loseText, { color: colors.text }]}>
                      {t(item.key, item.fallback)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Special offer CTA */}
              <TouchableOpacity
                style={[styles.offerBtn, { backgroundColor: colors.primary }]}
                onPress={handleSpecialOffer}
                activeOpacity={0.8}
              >
                <Ionicons name="gift" size={18} color="#FFF" />
                <Text style={styles.offerBtnText}>
                  {t('retention.special_offer', 'Special offer: 50% off')}
                </Text>
              </TouchableOpacity>

              {/* Cancel anyway */}
              <TouchableOpacity onPress={onConfirmCancel} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: '#EF4444' }]}>
                  {t('retention.cancel_anyway', 'Cancel anyway')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  desc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  loseList: {
    width: '100%',
    gap: 8,
    marginBottom: 24,
  },
  loseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  loseIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loseText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  offerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  offerBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  cancelBtn: {
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
