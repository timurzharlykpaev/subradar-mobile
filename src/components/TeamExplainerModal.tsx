import React, { useEffect, useRef, useState } from 'react';
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
import { analytics } from '../services/analytics';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { useSettingsStore } from '../stores/settingsStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Where the modal was opened from — logged for analytics. */
  source: 'workspace_tab' | 'paywall_card' | 'upsell_banner' | 'dashboard_card' | 'onboarding';
}

type StepKey = 'invite' | 'shared' | 'duplicates';

const STEPS: { key: StepKey; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }[] = [
  { key: 'invite',     icon: 'people',                color: '#06B6D4' },
  { key: 'shared',     icon: 'grid',                  color: '#8B5CF6' },
  { key: 'duplicates', icon: 'alert-circle',          color: '#F59E0B' },
];

export default function TeamExplainerModal({ visible, onClose, source }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
  const currency = useSettingsStore((s) => s.currency || 'USD');
  const currencySymbol = currency === 'RUB' ? '₽' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setStepIndex(0);
      analytics.track('team_explainer_viewed', { source });
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, damping: 18, stiffness: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible, source]);

  // Personalised math: monthly_total from user's active subs
  const userMonthly = React.useMemo(() => {
    return subscriptions
      .filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL')
      .reduce((sum, s) => {
        const mult =
          s.billingPeriod === 'WEEKLY' ? 4 :
          s.billingPeriod === 'QUARTERLY' ? 1 / 3 :
          s.billingPeriod === 'YEARLY' ? 1 / 12 :
          1;
        return sum + (Number(s.amount) || 0) * mult;
      }, 0);
  }, [subscriptions]);
  const yearlyTotal = Math.round(userMonthly * 12);
  const teamCost = 9.99 * 12; // $119.88
  const splitPerPerson = Math.round((teamCost / 4) * 100) / 100;
  const savings = Math.max(0, Math.round(yearlyTotal * 0.75));

  const handlePrimaryCta = () => {
    analytics.track('team_explainer_cta_tapped', { source, step: stepIndex });
    onClose();
    router.push('/paywall?prefill=org-yearly' as any);
  };

  const handleDismiss = () => {
    analytics.track('team_explainer_dismissed', { source, step: stepIndex });
    onClose();
  };

  const isLastStep = stepIndex === STEPS.length - 1;
  const currentStep = STEPS[stepIndex];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[
              styles.sheet,
              { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF', transform: [{ scale: scaleAnim }] },
            ]}>
              <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              {/* Step illustration */}
              <View style={[styles.illoWrap, { backgroundColor: currentStep.color + '15' }]}>
                <Ionicons name={currentStep.icon} size={56} color={currentStep.color} />
              </View>

              <Text style={[styles.title, { color: colors.text }]}>
                {t(`team_explainer.step_${currentStep.key}_title`, {
                  defaultValue: currentStep.key === 'invite' ? 'Invite your household' : currentStep.key === 'shared' ? 'Everyone tracks in one place' : 'Spot duplicates instantly',
                })}
              </Text>

              <Text style={[styles.desc, { color: colors.textSecondary }]}>
                {t(`team_explainer.step_${currentStep.key}_desc`, {
                  defaultValue: currentStep.key === 'invite' ? 'Up to 10 people share one subscription library.' : currentStep.key === 'shared' ? 'See all household subscriptions, renewals, and upcoming charges together.' : "Find when 3 people pay for the same Netflix — keep one, save the rest.",
                })}
              </Text>

              {/* Step dots */}
              <View style={styles.dots}>
                {STEPS.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === stepIndex ? { backgroundColor: currentStep.color, width: 18 } : { backgroundColor: colors.border }]}
                  />
                ))}
              </View>

              {/* Personalised math card — only on last step */}
              {isLastStep && userMonthly > 0 && (
                <View style={[styles.mathCard, { backgroundColor: isDark ? '#22223A' : '#F0FDF4', borderColor: '#10B981' }]}>
                  <Text style={[styles.mathLabel, { color: colors.textSecondary }]}>
                    {t('team_explainer.math_label', { defaultValue: 'Your household of 4' })}
                  </Text>
                  <Text style={[styles.mathValue, { color: '#10B981' }]}>
                    {currencySymbol}{splitPerPerson} {t('team_explainer.per_person', { defaultValue: 'per person/mo' })}
                  </Text>
                  {savings > 0 && (
                    <Text style={[styles.mathSavings, { color: colors.text }]}>
                      {t('team_explainer.savings_vs_separate', { defaultValue: 'Save up to' })} {currencySymbol}{savings}/yr
                    </Text>
                  )}
                </View>
              )}

              {/* Primary CTA */}
              <TouchableOpacity
                style={[styles.ctaBtn, { backgroundColor: currentStep.color }]}
                onPress={isLastStep ? handlePrimaryCta : () => setStepIndex(stepIndex + 1)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaBtnText}>
                  {isLastStep
                    ? t('team_explainer.cta_start', { defaultValue: 'Start Team plan' })
                    : t('common.next', { defaultValue: 'Next' })}
                </Text>
                <Ionicons name={isLastStep ? 'arrow-forward' : 'chevron-forward'} size={16} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleDismiss} style={styles.laterBtn}>
                <Text style={[styles.laterText, { color: colors.textMuted }]}>
                  {t('team_explainer.cta_later', { defaultValue: 'Just me, thanks' })}
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: {
    width: '100%', maxWidth: 380, borderRadius: 28, padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, padding: 8, zIndex: 1 },
  illoWrap: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, marginTop: 8,
  },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3, marginBottom: 8 },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16, paddingHorizontal: 4 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  mathCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
    gap: 4,
  },
  mathLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  mathValue: { fontSize: 22, fontWeight: '900' },
  mathSavings: { fontSize: 13, fontWeight: '700' },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  laterBtn: { paddingVertical: 12 },
  laterText: { fontSize: 14, fontWeight: '600' },
});
