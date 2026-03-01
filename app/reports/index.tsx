import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants';

const REPORT_TYPES = ['Summary', 'Detailed', 'Tax'];

export default function ReportsScreen() {
  const router = useRouter();
  const [reportType, setReportType] = useState('Summary');
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      Alert.alert('Report Ready', 'Your report has been generated (demo). Connect API to download PDF.');
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reports</Text>
      </View>

      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.label}>Report Type</Text>
          <View style={styles.chips}>
            {REPORT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, reportType === type && styles.chipActive]}
                onPress={() => setReportType(type)}
              >
                <Text style={[styles.chipText, reportType === type && styles.chipTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Date Range</Text>
          <View style={styles.chips}>
            {(['month', 'quarter', 'year'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[styles.chip, dateRange === range && styles.chipActive]}
                onPress={() => setDateRange(range)}
              >
                <Text style={[styles.chipText, dateRange === range && styles.chipTextActive]}>
                  {range === 'month' ? 'This Month' : range === 'quarter' ? 'This Quarter' : 'This Year'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>📄 {reportType} Report</Text>
          <Text style={styles.previewDesc}>
            {reportType === 'Summary'
              ? 'Overview of all subscriptions with total costs'
              : reportType === 'Detailed'
              ? 'Full breakdown including payment history and categories'
              : 'Tax-ready expense report for deductions'}
          </Text>
          <Text style={styles.previewRange}>
            Period: {dateRange === 'month' ? 'Current month' : dateRange === 'quarter' ? 'Last 3 months' : 'This year'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          <Text style={styles.generateBtnText}>
            {generating ? '⏳ Generating...' : '📥 Generate PDF Report'}
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
