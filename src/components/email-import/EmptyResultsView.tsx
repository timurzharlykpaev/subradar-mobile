import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  onManual: () => void;
  windowDays: number;
}

/**
 * Shown when a scan returned 0 recurring candidates.
 *
 * Note: deep scan was deferred from R1 (review M8). When/if it ships, add
 * a `onDeepScan` action and gate it on Pro+.
 */
export function EmptyResultsView({ onManual, windowDays }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <View style={[styles.iconCircle, { backgroundColor: colors.card }]}>
        <Ionicons name="mail-open-outline" size={32} color={colors.textSecondary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('emailImport.empty.title')}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {t('emailImport.empty.body', { days: windowDays })}
      </Text>
      <TouchableOpacity
        onPress={onManual}
        style={[styles.cta, { backgroundColor: colors.primary }]}
      >
        <Text style={styles.ctaText}>{t('emailImport.empty.manual')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 32, alignItems: 'center', flex: 1, justifyContent: 'center' },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  body: { fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  cta: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
