import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useGmailScan, GmailScanError } from '../../hooks/useGmailScan';

export function ScanProgressView() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { scan, progress, cancel } = useGmailScan();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    scan({ mode: 'shallow' })
      .then((result) => {
        router.replace({
          pathname: '/email-import/review' as any,
          params: { result: JSON.stringify(result) },
        });
      })
      .catch((e: any) => {
        if (e instanceof GmailScanError && e.code === 'aborted') {
          router.back();
          return;
        }
        if (e instanceof GmailScanError && e.code === 'pro_required') {
          router.replace('/paywall' as any);
          return;
        }
        // Generic error → review screen with error param
        router.replace({
          pathname: '/email-import/review' as any,
          params: { error: e?.message ?? 'unknown' },
        });
      });
    // scan() identity is stable per-mount per useGmailScan; deps intentionally [].
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageLabel =
    progress?.stage === 'parsing'
      ? t('emailImport.scan.parsing')
      : t('emailImport.scan.fetching');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.stage, { color: colors.text }]}>{stageLabel}</Text>
        {progress && progress.total > 0 && (
          <Text style={[styles.progress, { color: colors.textSecondary }]}>
            {t('emailImport.scan.progress', {
              current: progress.current,
              total: progress.total,
            })}
          </Text>
        )}
        <TouchableOpacity onPress={cancel} style={styles.cancel}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>
            {t('emailImport.scan.cancel')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  stage: { fontSize: 18, fontWeight: '600', marginTop: 24, textAlign: 'center' },
  progress: { fontSize: 14, marginTop: 8 },
  cancel: { marginTop: 32, padding: 12 },
});
