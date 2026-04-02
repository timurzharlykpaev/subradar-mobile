import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { COLORS } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.subradar.ai/api/v1';

export default function ReportsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useAuthStore();

  const REPORT_TYPES = [
    { key: 'summary',  label: t('reports.summary') },
    { key: 'detailed', label: t('reports.detailed') },
    { key: 'tax',      label: t('reports.tax') },
  ];

  const [reportType, setReportType] = useState('summary');
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [generating, setGenerating] = useState(false);

  const getPeriodDates = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const year = now.getFullYear();
    const month = now.getMonth();
    const capToday = (d: string) => (d > today ? today : d);
    if (dateRange === 'month') {
      return {
        from: new Date(year, month, 1).toISOString().split('T')[0],
        to:   capToday(new Date(year, month + 1, 0).toISOString().split('T')[0]),
      };
    }
    if (dateRange === 'quarter') {
      const q = Math.floor(month / 3);
      return {
        from: new Date(year, q * 3, 1).toISOString().split('T')[0],
        to:   capToday(new Date(year, q * 3 + 3, 0).toISOString().split('T')[0]),
      };
    }
    return {
      from: `${year}-01-01`,
      to:   capToday(`${year}-12-31`),
    };
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { from, to } = getPeriodDates();

      // 1. Создаём отчёт на сервере
      const res = await fetch(`${API_URL}/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: reportType.toUpperCase(), from, to }),
      });

      if (!res.ok) {
        const httpErr: any = new Error(`Server error: ${res.status}`);
        httpErr.status = res.status;
        throw httpErr;
      }
      const report = await res.json();

      // 2. Скачиваем PDF
      const reportId = report?.data?.id || report?.id;
      if (!reportId) throw new Error('No report ID returned');

      const filename = `subradar-${reportType}-${from}.pdf`;
      const localPath = `${FileSystem.documentDirectory ?? ''}${filename}`;

      const download = await FileSystem.downloadAsync(
        `${API_URL}/reports/${reportId}/download`,
        localPath,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (download.status !== 200) {
        const dlErr: any = new Error(`Download failed: ${download.status}`);
        dlErr.status = download.status;
        throw dlErr;
      }

      // 3. Открываем шаринг
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localPath, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(t('common.success', 'Report saved'), `Saved to: ${localPath}`);
      }
    } catch (err: any) {
      console.error('Report error:', err);

      let errorMessage: string;
      const status = err?.status ?? err?.response?.status;
      const msgLower = (err?.message ?? '').toLowerCase();

      if (status === 401 || msgLower.includes('401')) {
        errorMessage = t('reports.error_401', 'Session expired, please log in again');
      } else if (status === 404 || msgLower.includes('404')) {
        errorMessage = t('reports.error_404', 'Report not found');
      } else if (
        msgLower.includes('network') ||
        msgLower.includes('failed to fetch') ||
        msgLower.includes('networkrequest') ||
        msgLower.includes('network request failed')
      ) {
        errorMessage = t('reports.error_network', 'Network error, check your connection');
      } else {
        errorMessage = err?.response?.data?.message || err?.message || t('reports.error_generic', 'Could not generate report');
      }

      Alert.alert(
        t('common.error', 'Error'),
        errorMessage,
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('reports.retry', 'Retry'), onPress: () => handleGenerate() },
        ]
      );
    } finally {
      setGenerating(false);
    }
  };

  const getDesc = () => {
    if (reportType === 'summary')  return t('reports.summary_desc');
    if (reportType === 'detailed') return t('reports.detailed_desc');
    return t('reports.tax_desc');
  };

  const getPeriodLabel = () => {
    if (dateRange === 'month')   return t('reports.period_month');
    if (dateRange === 'quarter') return t('reports.period_quarter');
    return t('reports.period_year');
  };

  const reportTypeLabel = REPORT_TYPES.find(r => r.key === reportType)?.label ?? reportType;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('reports.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Type */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('reports.report_type')}</Text>
          <View style={styles.chips}>
            {REPORT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.border },
                  reportType === type.key && styles.chipActive]}
                onPress={() => setReportType(type.key)}
              >
                <Text style={[styles.chipText, { color: colors.textSecondary },
                  reportType === type.key && styles.chipTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Period */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('reports.date_range')}</Text>
          <View style={styles.chips}>
            {(['month', 'quarter', 'year'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.border },
                  dateRange === range && styles.chipActive]}
                onPress={() => setDateRange(range)}
              >
                <Text style={[styles.chipText, { color: colors.textSecondary },
                  dateRange === range && styles.chipTextActive]}>
                  {range === 'month' ? t('reports.this_month') :
                   range === 'quarter' ? t('reports.this_quarter') : t('reports.this_year')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview */}
        <View style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>
            {reportTypeLabel} {t('reports.report_suffix')}
          </Text>
          <Text style={[styles.previewDesc, { color: colors.textSecondary }]}>{getDesc()}</Text>
          <Text style={[styles.previewRange, { color: colors.primary }]}>
            {t('reports.period_label', { period: getPeriodLabel() })}
          </Text>
        </View>

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: colors.primary }, generating && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.generateBtnText}>
              {t('reports.generate')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 24, color: COLORS.primary },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  section: { paddingHorizontal: 20, marginBottom: 20, gap: 10 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  preview: { marginHorizontal: 20, borderRadius: 16, padding: 18, gap: 8, marginBottom: 24, borderWidth: 1 },
  previewTitle: { fontSize: 18, fontWeight: '800' },
  previewDesc: { fontSize: 14, lineHeight: 20 },
  previewRange: { fontSize: 13, fontWeight: '600' },
  generateBtn: { marginHorizontal: 20, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});
