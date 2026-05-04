import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useUIStore } from '../../stores/uiStore';
import { emailImportTelemetry } from '../../utils/emailImportTelemetry';

/**
 * Sticky banner shown on the dashboard when an opportunistic re-scan
 * (>14 days since last scan) finds new candidates. State lives in
 * `appStore.opportunisticGmailFindings` — set by `_layout.tsx` after a
 * successful silent scan.
 */
export function OpportunisticBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const findings = useUIStore((s) => s.opportunisticGmailFindings);
  const dismiss = useUIStore((s) => s.dismissOpportunisticGmail);

  useEffect(() => {
    if (findings && findings.length > 0) {
      emailImportTelemetry.bannerShown(findings.length);
    }
  }, [findings?.length]);

  if (!findings || findings.length === 0) return null;

  const handleReview = () => {
    emailImportTelemetry.bannerReviewClick();
    router.push({
      pathname: '/email-import/review' as any,
      params: {
        result: JSON.stringify({
          candidates: findings,
          scannedCount: findings.length,
          durationMs: 0,
        }),
      },
    });
    dismiss();
  };

  const handleDismiss = () => {
    emailImportTelemetry.bannerDismissed();
    dismiss();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: '#EA433522' }]}>
        <Ionicons name="mail" size={18} color="#EA4335" />
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {t('emailImport.banner.title', { count: findings.length })}
      </Text>
      <TouchableOpacity onPress={handleReview} style={[styles.action, { backgroundColor: colors.primary }]}>
        <Text style={styles.actionText}>{t('emailImport.banner.review')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDismiss} style={styles.dismiss}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 18 },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  dismiss: { padding: 4, marginLeft: -4 },
});
