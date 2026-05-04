import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../theme/ThemeContext';
import { Candidate, emailImportApi } from '../../api/emailImport';
import { useCreateSubscription } from '../../hooks/useSubscriptions';
import { useSettingsStore } from '../../stores/settingsStore';
import { scannedMessageStore } from '../../services/scannedMessageStore';
import { reportError } from '../../utils/errorReporter';
import { emailImportTelemetry } from '../../utils/emailImportTelemetry';
import { EmptyResultsView } from './EmptyResultsView';

type ConfidenceLevel = 'high' | 'medium' | 'low';

const confLevel = (c: number): ConfidenceLevel => {
  if (c >= 0.85) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
};

interface ScanResultPayload {
  candidates: Candidate[];
  scannedCount: number;
  durationMs: number;
}

export function ImportResultsView() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ result?: string; error?: string }>();
  const windowDays = useSettingsStore((s) => s.emailImportWindowDays);
  const createMut = useCreateSubscription();

  const initialResult: ScanResultPayload = useMemo(() => {
    if (typeof params.result === 'string') {
      try {
        return JSON.parse(params.result);
      } catch {
        return { candidates: [], scannedCount: 0, durationMs: 0 };
      }
    }
    return { candidates: [], scannedCount: 0, durationMs: 0 };
  }, [params.result]);

  const [candidates] = useState<Candidate[]>(initialResult.candidates);
  const [selected, setSelected] = useState<Set<string>>(() => {
    // Default-select medium+high; low is collapsed and unchecked.
    const init = new Set<string>();
    for (const c of initialResult.candidates) {
      if (c.confidence >= 0.5) init.add(c.sourceMessageId);
    }
    return init;
  });
  const [showLow, setShowLow] = useState(false);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(
    () => ({
      high: candidates.filter((c) => confLevel(c.confidence) === 'high'),
      medium: candidates.filter((c) => confLevel(c.confidence) === 'medium'),
      low: candidates.filter((c) => confLevel(c.confidence) === 'low'),
    }),
    [candidates],
  );

  useEffect(() => {
    emailImportTelemetry.reviewViewed({
      count: candidates.length,
      highConfidence: groups.high.length,
      lowConfidence: groups.low.length,
    });
    if (candidates.length === 0) emailImportTelemetry.zeroResults();
  }, [candidates.length, groups.high.length, groups.low.length]);

  const toggle = (id: string, confidence: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        emailImportTelemetry.itemUnchecked(confidence);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    emailImportTelemetry.saveClicked(selected.size);
    let savedCount = 0;
    let failedCount = 0;
    try {
      const toSave = candidates.filter((c) => selected.has(c.sourceMessageId));
      for (const c of toSave) {
        try {
          const sub: any = await createMut.mutateAsync({
            name: c.name,
            amount: c.amount,
            currency: c.currency,
            billingPeriod: c.billingPeriod,
            category: c.category,
            status: c.status,
            nextPaymentDate: c.nextPaymentDate,
            ...(c.iconUrl ? { iconUrl: c.iconUrl } : {}),
          });
          savedCount++;
          if (sub?.id) {
            for (const mid of c.aggregatedFrom) {
              await scannedMessageStore.linkImportedSubscription(mid, sub.id).catch(() => {});
            }
          }
        } catch (e: any) {
          failedCount++;
          reportError(e?.message ?? String(e), e?.stack);
        }
      }

      // Tell backend how many we actually persisted (for /status display).
      emailImportApi.recordImport(savedCount).catch(() => {});

      if (failedCount > 0) {
        emailImportTelemetry.savePartialFailure({ savedCount, failedCount });
      } else {
        emailImportTelemetry.saveCompleted(savedCount);
      }

      router.replace('/(tabs)' as any);
    } finally {
      setSaving(false);
    }
  };

  if (candidates.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header
          colors={colors}
          title={t('emailImport.empty.title')}
          onBack={() => router.back()}
        />
        <EmptyResultsView
          windowDays={windowDays}
          onManual={() => router.replace('/(tabs)' as any)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        colors={colors}
        title={t('emailImport.results.title', { count: candidates.length })}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {[...groups.high, ...groups.medium].map((c) => (
          <CandidateRow
            key={c.sourceMessageId}
            candidate={c}
            selected={selected.has(c.sourceMessageId)}
            onToggle={() => toggle(c.sourceMessageId, c.confidence)}
            colors={colors}
            isDark={isDark}
            t={t}
          />
        ))}

        {groups.low.length > 0 && (
          <>
            <TouchableOpacity
              onPress={() => setShowLow((s) => !s)}
              style={styles.lowToggle}
            >
              <Ionicons
                name={showLow ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={colors.textSecondary}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 6 }}>
                {t('emailImport.results.notSureSection', { count: groups.low.length })}
              </Text>
            </TouchableOpacity>
            {showLow &&
              groups.low.map((c) => (
                <CandidateRow
                  key={c.sourceMessageId}
                  candidate={c}
                  selected={selected.has(c.sourceMessageId)}
                  onToggle={() => toggle(c.sourceMessageId, c.confidence)}
                  colors={colors}
                  isDark={isDark}
                  t={t}
                />
              ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || selected.size === 0}
          style={[
            styles.cta,
            {
              backgroundColor: selected.size === 0 ? colors.border : colors.primary,
              opacity: saving ? 0.7 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.ctaText}>
              {t('emailImport.results.saveButton', { count: selected.size })}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

interface RowProps {
  candidate: Candidate;
  selected: boolean;
  onToggle: () => void;
  colors: any;
  isDark: boolean;
  t: (key: string, opts?: any) => string;
}

function CandidateRow({ candidate: c, selected, onToggle, colors, isDark, t }: RowProps) {
  const level = confLevel(c.confidence);
  const dot = level === 'high' ? '#10B981' : level === 'medium' ? '#F59E0B' : '#9CA3AF';
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.primary + '12' : isDark ? '#1C1C2E' : '#F5F5F7',
          borderColor: selected ? colors.primary + '60' : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.check,
          {
            borderColor: selected ? colors.primary : colors.border,
            backgroundColor: selected ? colors.primary : 'transparent',
          },
        ]}
      >
        {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {c.name}
          </Text>
          <View style={[styles.confDot, { backgroundColor: dot }]} />
          {c.isTrial && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialText}>{t('emailImport.results.trialBadge')}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.amount, { color: colors.textSecondary }]}>
          {c.amount} {c.currency} · {c.billingPeriod.toLowerCase()}
        </Text>
        {level !== 'high' && (
          <Text style={[styles.confLabel, { color: dot }]}>
            {level === 'medium'
              ? t('emailImport.results.confidenceMid')
              : t('emailImport.results.confidenceLow')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Header({ colors, title, onBack }: { colors: any; title: string; onBack: () => void }) {
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={onBack} style={styles.headerBack}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 120 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  confDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 8 },
  trialBadge: {
    backgroundColor: '#F59E0B22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  trialText: { color: '#F59E0B', fontSize: 11, fontWeight: '600' },
  amount: { fontSize: 13, marginTop: 2 },
  confLabel: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  lowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cta: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
