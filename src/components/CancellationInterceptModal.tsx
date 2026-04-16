import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Modal,
  Platform,
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

type Step = 'offer' | 'reason';

type Reason = 'too_expensive' | 'not_using' | 'missing_feature' | 'found_alt' | 'temporary_break' | 'other';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirmCancel: (reason?: Reason) => void;
  /** Context drives which retention offer is shown. Defaults to 'monthly'. */
  context?: 'monthly' | 'yearly' | 'trial';
  /** Yearly savings in display currency (absolute dollars). Shown when context='monthly'. */
  yearlySavings?: number;
  /** Currency symbol for displaying savings. Defaults to "$". */
  currencySymbol?: string;
}

const LOSE_ITEMS: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  key: string;
  fallback: string;
}[] = [
  { icon: 'infinite-outline', key: 'retention.lose_unlimited', fallback: 'Unlimited subscriptions' },
  { icon: 'sparkles-outline', key: 'retention.lose_ai', fallback: '200 AI analyses per month' },
  { icon: 'analytics-outline', key: 'retention.lose_analytics', fallback: 'Advanced analytics & forecasts' },
  { icon: 'document-text-outline', key: 'retention.lose_reports', fallback: 'PDF reports & exports' },
];

const REASONS: { key: Reason; icon: React.ComponentProps<typeof Ionicons>['name']; i18n: string; fallback: string }[] = [
  { key: 'too_expensive',   icon: 'pricetag-outline',    i18n: 'retention.reason_too_expensive',   fallback: 'Too expensive' },
  { key: 'not_using',       icon: 'moon-outline',         i18n: 'retention.reason_not_using',       fallback: "Not using it enough" },
  { key: 'missing_feature', icon: 'construct-outline',    i18n: 'retention.reason_missing_feature', fallback: 'Missing a feature' },
  { key: 'found_alt',       icon: 'swap-horizontal-outline', i18n: 'retention.reason_found_alt',    fallback: 'Found alternative' },
  { key: 'temporary_break', icon: 'pause-circle-outline', i18n: 'retention.reason_temporary_break', fallback: 'Just need a break' },
  { key: 'other',           icon: 'help-circle-outline',  i18n: 'retention.reason_other',           fallback: 'Other' },
];

const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

export default function CancellationInterceptModal({
  visible,
  onClose,
  onConfirmCancel,
  context = 'monthly',
  yearlySavings = 0,
  currencySymbol = '$',
}: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState<Step>('offer');

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep('offer');
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, damping: 18, stiffness: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleRetentionOffer = () => {
    onClose();
    if (context === 'monthly') {
      analytics.track('cancellation_retention_tapped', { offer: 'switch_to_yearly' });
      router.push('/paywall?prefill=pro-yearly' as any);
    } else if (context === 'yearly') {
      analytics.track('cancellation_paused_tapped', {});
      Linking.openURL(APPLE_MANAGE_URL).catch(() => {});
    } else {
      analytics.track('cancellation_retention_tapped', { offer: 'finish_trial' });
      // Trial context — just close, they keep trial running
    }
  };

  const handleCancelAnyway = () => {
    analytics.track('cancellation_intercepted', { context });
    setStep('reason');
  };

  const handleReasonSelected = (reason: Reason) => {
    analytics.track('cancellation_reason_selected', { reason });
    if (reason === 'temporary_break') {
      // Redirect to pause instead of full cancel
      analytics.track('cancellation_paused_tapped', { via: 'reason' });
      onClose();
      Linking.openURL(APPLE_MANAGE_URL).catch(() => {});
      return;
    }
    onConfirmCancel(reason);
  };

  const retentionOfferLabel = () => {
    if (context === 'monthly') {
      const savings = yearlySavings > 0
        ? ` — ${t('retention.save', { defaultValue: 'Save' })} ${currencySymbol}${yearlySavings}/${t('paywall.year', { defaultValue: 'yr' })}`
        : '';
      return `${t('retention.switch_yearly', { defaultValue: 'Switch to yearly' })}${savings}`;
    }
    if (context === 'yearly') {
      return t('retention.pause_a_month', { defaultValue: 'Pause subscription' });
    }
    return t('retention.finish_trial', { defaultValue: 'Finish my free trial' });
  };

  const retentionOfferIcon = (): React.ComponentProps<typeof Ionicons>['name'] =>
    context === 'yearly' ? 'pause-circle' : context === 'trial' ? 'time' : 'trending-down';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[
              styles.sheet,
              { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF', transform: [{ scale: scaleAnim }] },
            ]}>
              {step === 'offer' ? (
                <>
                  <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="heart-dislike" size={32} color="#EF4444" />
                  </View>

                  <Text style={[styles.title, { color: colors.text }]}>
                    {t('retention.cancel_title', { defaultValue: 'Before you go' })}
                  </Text>
                  <Text style={[styles.desc, { color: colors.textSecondary }]}>
                    {t('retention.cancel_desc', { defaultValue: "Here's what you'll lose with your Pro plan:" })}
                  </Text>

                  <View style={styles.loseList}>
                    {LOSE_ITEMS.map((item, i) => (
                      <View key={i} style={[styles.loseRow, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2' }]}>
                        <View style={[styles.loseIconCircle, { backgroundColor: '#EF4444' + '20' }]}>
                          <Ionicons name={item.icon} size={18} color="#EF4444" />
                        </View>
                        <Text style={[styles.loseText, { color: colors.text }]}>
                          {t(item.key, { defaultValue: item.fallback })}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.offerBtn, { backgroundColor: colors.primary }]}
                    onPress={handleRetentionOffer}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={retentionOfferIcon()} size={18} color="#FFF" />
                    <Text style={styles.offerBtnText}>{retentionOfferLabel()}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleCancelAnyway} style={styles.cancelBtn}>
                    <Text style={[styles.cancelText, { color: '#EF4444' }]}>
                      {t('retention.cancel_anyway', { defaultValue: 'Cancel anyway' })}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
                  </View>

                  <Text style={[styles.title, { color: colors.text }]}>
                    {t('retention.reason_title', { defaultValue: 'Help us improve' })}
                  </Text>
                  <Text style={[styles.desc, { color: colors.textSecondary }]}>
                    {t('retention.reason_desc', { defaultValue: 'Why are you cancelling? Tap to continue.' })}
                  </Text>

                  <View style={styles.reasonGrid}>
                    {REASONS.map((r) => (
                      <TouchableOpacity
                        key={r.key}
                        style={[styles.reasonCard, { backgroundColor: isDark ? '#22223A' : '#F8F9FF', borderColor: colors.border }]}
                        onPress={() => handleReasonSelected(r.key)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={r.icon} size={20} color={colors.primary} />
                        <Text style={[styles.reasonText, { color: colors.text }]} numberOfLines={2}>
                          {t(r.i18n, { defaultValue: r.fallback })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity onPress={() => setStep('offer')} style={styles.cancelBtn}>
                    <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                      {t('common.back', { defaultValue: 'Back' })}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
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
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3, marginBottom: 6 },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  loseList: { width: '100%', gap: 8, marginBottom: 20 },
  loseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12 },
  loseIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  loseText: { fontSize: 14, fontWeight: '600', flex: 1 },
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
  offerBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  cancelBtn: { paddingVertical: 14 },
  cancelText: { fontSize: 14, fontWeight: '600' },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 12 },
  reasonCard: {
    flexGrow: 1,
    flexBasis: '47%',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  reasonText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
