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
import { useBillingStatus, useStartTrial } from '../hooks/useBilling';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  visible: boolean;
  onClose: () => void;
  feature: string; // e.g. 'forecast', 'savings', 'ai_text', 'ai_photo', 'unlimited_subs'
}

const FEATURE_INFO: Record<string, { icon: string; gradient: [string, string] }> = {
  forecast:       { icon: 'trending-up',     gradient: ['#7C5CFF', '#4F46E5'] },
  savings:        { icon: 'cash-outline',     gradient: ['#059669', '#047857'] },
  ai_text:        { icon: 'chatbubble-ellipses-outline', gradient: ['#8B5CF6', '#7C3AED'] },
  ai_photo:       { icon: 'camera-outline',   gradient: ['#F59E0B', '#D97706'] },
  unlimited_subs: { icon: 'infinite-outline',  gradient: ['#EC4899', '#DB2777'] },
  workspace:      { icon: 'people-outline',   gradient: ['#06B6D4', '#0891B2'] },
  reports:        { icon: 'document-text-outline', gradient: ['#3B82F6', '#2563EB'] },
};

export default function ProFeatureModal({ visible, onClose, feature }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: billing } = useBillingStatus();
  const startTrialMutation = useStartTrial();

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const canTrial = billing && !billing.trialUsed && billing.plan === 'free';
  const info = FEATURE_INFO[feature] ?? FEATURE_INFO.forecast;

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

  const handleUpgrade = () => {
    onClose();
    router.push('/paywall' as any);
  };

  const handleTrial = async () => {
    try {
      await startTrialMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      onClose();
    } catch {}
  };

  const proFeatures = [
    t('pro_modal.feat_unlimited', 'Unlimited subscriptions'),
    t('pro_modal.feat_ai', '200 AI requests/month'),
    t('pro_modal.feat_analytics', 'Advanced analytics & forecasts'),
    t('pro_modal.feat_reports', 'PDF reports'),
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View testID="pro-modal" style={[
              styles.sheet,
              { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF', transform: [{ scale: scaleAnim }] },
            ]}>
              {/* Icon circle */}
              <View style={[styles.iconCircle, { backgroundColor: info.gradient[0] + '20' }]}>
                <Ionicons name={info.icon as any} size={32} color={info.gradient[0]} />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.text }]}>
                {t(`pro_modal.title_${feature}`, t('pro_modal.title_default', 'Pro Feature'))}
              </Text>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                {t(`pro_modal.desc_${feature}`, t('pro_modal.desc_default', 'Upgrade to Pro to unlock this feature'))}
              </Text>

              {/* Feature list */}
              <View style={styles.featureList}>
                {proFeatures.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              {canTrial ? (
                <TouchableOpacity
                  testID="btn-upgrade"
                  style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
                  onPress={handleTrial}
                  disabled={startTrialMutation.isPending}
                >
                  <Ionicons name="star" size={18} color="#FFF" />
                  <Text style={styles.ctaBtnText}>
                    {t('pro_modal.start_trial', 'Start 7-day Free Trial')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  testID="btn-upgrade"
                  style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
                  onPress={handleUpgrade}
                >
                  <Ionicons name="arrow-up-circle" size={18} color="#FFF" />
                  <Text style={styles.ctaBtnText}>
                    {t('pro_modal.upgrade_no_price', 'Upgrade to Pro')}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={onClose} style={styles.laterBtn}>
                <Text style={[styles.laterText, { color: colors.textMuted }]}>
                  {t('paywall.maybe_later', 'Maybe Later')}
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
  featureList: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ctaBtn: {
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
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  laterBtn: {
    paddingVertical: 12,
  },
  laterText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
