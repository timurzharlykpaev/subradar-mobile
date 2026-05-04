import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { API_URL } from '../../src/api/client';
import { exportSubscriptionsCsv } from '../../src/services/csvExport';
import { analytics } from '../../src/services/analytics';
import { useEffectiveAccess } from '../../src/hooks/useEffectiveAccess';
import { workspaceApi } from '../../src/api/workspace';

type ExportFormat = 'pdf' | 'csv';

export default function ReportsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { token } = useAuthStore();
  const { currency, displayCurrency } = useSettingsStore();
  // The user's chosen unit (KZT, USD, …) — passed to both team and
  // personal report endpoints so the PDF renders totals in the same
  // currency the app is showing, regardless of what the backend has
  // persisted on `users.displayCurrency`.
  const reportCurrency = (displayCurrency || currency || 'USD').toUpperCase();
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
  const access = useEffectiveAccess();
  const isPro = access?.isPro ?? false;

  const REPORT_TYPES = [
    { key: 'summary',  icon: 'bar-chart-outline' as const,      label: t('reports.summary', 'Summary'),  desc: t('reports.summary_desc', 'Overview of your spending by category and status') },
    { key: 'detailed', icon: 'list-outline' as const,            label: t('reports.detailed', 'Detailed'), desc: t('reports.detailed_desc', 'Full list of all subscriptions with details') },
    { key: 'tax',      icon: 'receipt-outline' as const,         label: t('reports.tax', 'Tax'),           desc: t('reports.tax_desc', 'Subscriptions tagged #business are listed separately from personal ones.') },
  ];

  const PERIODS = [
    { key: 'month' as const,   label: t('reports.this_month', 'This month') },
    { key: 'quarter' as const, label: t('reports.this_quarter', 'This quarter') },
    { key: 'year' as const,    label: t('reports.this_year', 'This year') },
  ];

  const [reportType, setReportType] = useState('summary');
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  // Scope: personal report (default) vs team-wide. Only the workspace
  // owner sees the toggle — members can only export their own data.
  const [scope, setScope] = useState<'personal' | 'team'>('personal');
  const isTeamOwner = (access?.isTeamOwner ?? false) && (access?.plan === 'organization');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const getPeriodDates = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const year = now.getFullYear();
    const month = now.getMonth();
    const cap = (d: string) => (d > today ? today : d);
    if (dateRange === 'month') {
      return { from: new Date(year, month, 1).toISOString().split('T')[0], to: cap(new Date(year, month + 1, 0).toISOString().split('T')[0]) };
    }
    if (dateRange === 'quarter') {
      const q = Math.floor(month / 3);
      return { from: new Date(year, q * 3, 1).toISOString().split('T')[0], to: cap(new Date(year, q * 3 + 3, 0).toISOString().split('T')[0]) };
    }
    return { from: `${year}-01-01`, to: cap(`${year}-12-31`) };
  };

  // ── CSV export (local, instant) ──────────────────────────────
  const handleCsvExport = async () => {
    setGenerating(true);
    setProgress(t('reports.exporting_csv', 'Exporting CSV...'));
    try {
      await exportSubscriptionsCsv(subscriptions);
      analytics.track('report_generated', { type: reportType, format: 'csv', period: dateRange });
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('reports.error_generic', 'Export failed'));
    } finally {
      setGenerating(false);
      setProgress('');
    }
  };

  // ── PDF export (server-side, async with polling) ─────────────
  const handlePdfExport = async () => {
    setGenerating(true);
    setProgress(
      scope === 'team'
        ? t('reports.generating_team_pdf', 'Generating team report…')
        : t('reports.generating_pdf', 'Generating PDF...'),
    );
    try {
      const { from, to } = getPeriodDates();

      // 1. Create report on server. Team-scope reports go through the
      // workspace endpoint which only owners can hit; the response shape
      // is identical to /reports/generate so the polling + download
      // path below stays unified.
      let reportId: string | null = null;
      if (scope === 'team') {
        const teamReport = await workspaceApi.generateTeamReport(
          reportType.toUpperCase() as 'SUMMARY' | 'DETAILED' | 'TAX',
          { from, to, locale: i18n.language || 'en', displayCurrency: reportCurrency },
        );
        reportId = teamReport.id;
      } else {
        const res = await fetch(`${API_URL}/reports/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: reportType.toUpperCase(),
            from,
            to,
            locale: i18n.language || 'en',
            displayCurrency: reportCurrency,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw Object.assign(new Error(body?.message || `Server error: ${res.status}`), { status: res.status });
        }
        const report = await res.json();
        reportId = report?.data?.id || report?.id;
      }
      if (!reportId) throw new Error('No report ID returned');

      // 2. Poll for READY status (max 30s)
      setProgress(t('reports.processing', 'Processing report...'));
      let ready = false;
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`${API_URL}/reports/${reportId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!statusRes.ok) continue;
        const statusData = await statusRes.json();
        const st = statusData?.status || statusData?.data?.status;
        if (st === 'READY') { ready = true; break; }
        if (st === 'FAILED') throw new Error(statusData?.error || 'Report generation failed');
      }
      if (!ready) throw new Error('Report generation timed out');

      // 3. Download PDF
      setProgress(t('reports.downloading', 'Downloading PDF...'));
      const filename = `subradar-${reportType}-${from}.pdf`;
      const localPath = `${FileSystem.documentDirectory ?? ''}${filename}`;
      const dl = await FileSystem.downloadAsync(
        `${API_URL}/reports/${reportId}/download`,
        localPath,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (dl.status !== 200) throw Object.assign(new Error(`Download failed: ${dl.status}`), { status: dl.status });

      // 4. Share
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localPath, { mimeType: 'application/pdf', dialogTitle: t('reports.share_title', 'Save or Share Report'), UTI: 'com.adobe.pdf' });
      }
      analytics.track('report_generated', { type: reportType, format: 'pdf', period: dateRange, scope });
    } catch (err: any) {
      console.error('Report error:', err);
      const status = err?.status;
      let msg: string;
      if (status === 401) msg = t('reports.error_401', 'Session expired, please log in again');
      else if (status === 403) msg = t('reports.error_403', 'Free plan: 1 report/month. Upgrade to Pro for unlimited.');
      else if (status === 404) msg = t('reports.error_404', 'Report not found');
      else msg = err?.message || t('reports.error_generic', 'Could not generate report');
      Alert.alert(t('common.error'), msg, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('reports.retry', 'Retry'), onPress: () => handlePdfExport() },
      ]);
    } finally {
      setGenerating(false);
      setProgress('');
    }
  };

  const handleGenerate = () => (format === 'csv' ? handleCsvExport() : handlePdfExport());
  const selectedType = REPORT_TYPES.find((r) => r.key === reportType)!;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface2 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('reports.title', 'Reports')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Personal / Team scope toggle — visible only to workspace owners.
            Members and personal accounts continue to see the legacy single-
            scope flow so we don't add a confusing UI affordance for users
            who can't use it. */}
        {isTeamOwner && (
          <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 12, padding: 4 }}>
              {(['personal', 'team'] as const).map((opt) => {
                const active = scope === opt;
                const label = opt === 'personal'
                  ? t('reports.scope_personal', 'Personal')
                  : t('reports.scope_team', 'Team');
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setScope(opt)}
                    activeOpacity={0.85}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: active ? colors.surface : 'transparent' }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: active ? colors.primary : colors.textSecondary }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {scope === 'team' && (
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, paddingHorizontal: 4, lineHeight: 16 }}>
                {t('reports.scope_team_hint', 'Aggregates subscriptions across every active team member. Includes per-member breakdown and overlap savings.')}
              </Text>
            )}
          </View>
        )}

        {/* Report Type */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('reports.report_type', 'Report Type')}</Text>
        <View style={styles.typeCards}>
          {REPORT_TYPES.map((type) => {
            const active = reportType === type.key;
            return (
              <TouchableOpacity
                key={type.key}
                style={[styles.typeCard, { backgroundColor: active ? colors.primary + '12' : colors.card, borderColor: active ? colors.primary : colors.border }]}
                onPress={() => setReportType(type.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.typeIconCircle, { backgroundColor: active ? colors.primary : colors.surface2 }]}>
                  <Ionicons name={type.icon} size={20} color={active ? '#FFF' : colors.textSecondary} />
                </View>
                <Text style={[styles.typeLabel, { color: active ? colors.primary : colors.text }]}>{type.label}</Text>
                <Text style={[styles.typeDesc, { color: colors.textMuted }]} numberOfLines={2}>{type.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Period */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('reports.date_range', 'Period')}</Text>
        <View style={styles.chips}>
          {PERIODS.map((p) => {
            const active = dateRange === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface2, borderColor: active ? colors.primary : colors.border }]}
                onPress={() => setDateRange(p.key)}
              >
                <Text style={[styles.chipText, { color: active ? '#FFF' : colors.textSecondary }]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Format */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('reports.format', 'Format')}</Text>
        <View style={styles.chips}>
          <TouchableOpacity
            style={[styles.formatChip, { backgroundColor: format === 'pdf' ? colors.primary : colors.surface2, borderColor: format === 'pdf' ? colors.primary : colors.border }]}
            onPress={() => setFormat('pdf')}
          >
            <Ionicons name="document-text-outline" size={16} color={format === 'pdf' ? '#FFF' : colors.textSecondary} />
            <Text style={[styles.chipText, { color: format === 'pdf' ? '#FFF' : colors.textSecondary }]}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formatChip, { backgroundColor: format === 'csv' ? colors.primary : colors.surface2, borderColor: format === 'csv' ? colors.primary : colors.border }]}
            onPress={() => setFormat('csv')}
          >
            <Ionicons name="grid-outline" size={16} color={format === 'csv' ? '#FFF' : colors.textSecondary} />
            <Text style={[styles.chipText, { color: format === 'csv' ? '#FFF' : colors.textSecondary }]}>CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Preview Card */}
        <View style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.previewIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name={selectedType.icon} size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewTitle, { color: colors.text }]}>
                {selectedType.label} {t('reports.report_suffix', 'Report')}
              </Text>
              <Text style={[styles.previewMeta, { color: colors.textMuted }]}>
                {PERIODS.find((p) => p.key === dateRange)?.label} · {format.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Free-plan limit hint surfaced *before* the user clicks Generate.
              Without this, free users only learned about the 1/month cap by
              tapping the button and getting a 403 error — confusing and slow. */}
          {!isPro && format === 'pdf' && (
            <View
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary }}>
                {t('reports.free_limit_hint', 'Free plan: 1 PDF report per month. CSV export is unlimited.')}
              </Text>
              <TouchableOpacity onPress={() => router.push('/paywall' as any)}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                  {t('common.upgrade', 'Upgrade')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: colors.primary }, generating && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={styles.generateBtnText}>{progress}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={format === 'pdf' ? 'document-text' : 'download-outline'} size={18} color="#FFF" />
              <Text style={styles.generateBtnText}>
                {format === 'csv' ? t('reports.export_csv', 'Export CSV') : t('reports.generate', 'Generate Report')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },

  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },

  // Type cards
  typeCards: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  typeCard: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1.5, gap: 8 },
  typeIconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 14, fontWeight: '800' },
  typeDesc: { fontSize: 11, lineHeight: 15 },

  // Chips
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  formatChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },

  // Preview
  preview: { marginHorizontal: 20, marginTop: 20, borderRadius: 16, padding: 16, borderWidth: 1 },
  previewIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: 17, fontWeight: '800' },
  previewMeta: { fontSize: 13, marginTop: 2 },

  // Generate
  generateBtn: { marginHorizontal: 20, marginTop: 20, borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  generateBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});
