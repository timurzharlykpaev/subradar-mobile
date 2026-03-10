import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../src/constants';

export default function ReportsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const REPORT_TYPES = [
    { key: 'summary', label: t('reports.summary') },
    { key: 'detailed', label: t('reports.detailed') },
    { key: 'tax', label: t('reports.tax') },
  ];

  const [reportType, setReportType] = useState('summary');
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [generating, setGenerating] = useState(false);

  const reportTypeLabel = REPORT_TYPES.find((rt) => rt.key === reportType)?.label ?? reportType;

  const handleGenerate = async () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      Alert.alert(t('reports.report_ready'), t('reports.report_ready_desc'));
    }, 1500);
  };

  const getDescKey = () => {
    if (reportType === 'summary') return t('reports.summary_desc');
    if (reportType === 'detailed') return t('reports.detailed_desc');
    return t('reports.tax_desc');
  };

  const getPeriodLabel = () => {
    if (dateRange === 'month') return t('reports.period_month');
    if (dateRange === 'quarter') return t('reports.period_quarter');
    return t('reports.period_year');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('reports.title')}</Text>
      </View>

      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.label}>{t('reports.report_type')}</Text>
          <View style={styles.chips}>
            {REPORT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[styles.chip, reportType === type.key && styles.chipActive]}
                onPress={() => setReportType(type.key)}
              >
                <Text style={[styles.chipText, reportType === type.key && styles.chipTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('reports.date_range')}</Text>
          <View style={styles.chips}>
            {(['month', 'quarter', 'year'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[styles.chip, dateRange === range && styles.chipActive]}
                onPress={() => setDateRange(range)}
              >
                <Text style={[styles.chipText, dateRange === range && styles.chipTextActive]}>
                  {range === 'month' ? t('reports.this_month') : range === 'quarter' ? t('reports.this_quarter') : t('reports.this_year')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>📄 {reportTypeLabel} {t('reports.report_suffix')}</Text>
          <Text style={styles.previewDesc}>{getDescKey()}</Text>
          <Text style={styles.previewRange}>
            {t('reports.period_label', { period: getPeriodLabel() })}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          <Text style={styles.generateBtnText}>
            {generating ? t('reports.generating') : t('reports.generate')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 24, color: COLORS.primary },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#FFF' },
  preview: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    gap: 8,
    marginBottom: 24,
  },
  previewTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  previewDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  previewRange: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  generateBtn: {
    marginHorizontal: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});
