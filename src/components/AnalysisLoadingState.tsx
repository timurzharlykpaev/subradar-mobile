import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import type { AnalysisStatusResponse } from '../types';
import { SafeLinearGradient as LinearGradient } from './SafeLinearGradient';

interface Props {
  status: AnalysisStatusResponse | null;
}

type StageKey = 'collect' | 'normalize' | 'marketLookup' | 'aiAnalyze' | 'store';

export default function AnalysisLoadingState({ status }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const stages: { key: StageKey; label: string }[] = [
    { key: 'collect', label: t('analysis.stage_collect', 'Collecting data') },
    { key: 'normalize', label: t('analysis.stage_normalize', 'Normalizing services') },
    { key: 'marketLookup', label: t('analysis.stage_market', 'Checking market prices') },
    { key: 'aiAnalyze', label: t('analysis.stage_ai', 'AI analysis') },
    { key: 'store', label: t('analysis.stage_store', 'Generating recommendations') },
  ];

  const progress = status?.stageProgress;

  // Determine which stage is active: the first 'pending' after all 'done' stages
  const activeIndex = progress
    ? stages.findIndex((s) => progress[s.key] === 'pending')
    : 0;

  // Show overall completion fraction as a thin gradient bar at the top.
  // The previous pure-spinner loader gave no signal that *forward
  // motion* was happening — users assumed the AI was stuck if a single
  // stage took 8–10 s. A bar that creeps forward as each stage flips
  // to "done" makes a slow run feel intentional instead of frozen.
  const completedCount = progress
    ? stages.filter((s) => progress[s.key] === 'done').length
    : 0;
  const fraction = stages.length > 0 ? completedCount / stages.length : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.headerText, { color: colors.text }]}>
          {t('analysis.analyzing', 'AI is analyzing...')}
        </Text>
      </View>

      <View style={[styles.bar, { backgroundColor: colors.border }]}>
        <View style={{ width: `${Math.max(fraction * 100, 6)}%`, height: '100%', overflow: 'hidden', borderRadius: 2 }}>
          <LinearGradient
            colors={[colors.primary, '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      </View>

      {/* Stages */}
      <View style={styles.stageList}>
        {stages.map((stage, index) => {
          const isDone = progress ? progress[stage.key] === 'done' : false;
          const isActive = !isDone && index === activeIndex;

          return (
            <View key={stage.key} style={styles.stageRow}>
              {isDone ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : isActive ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.stageSpinner} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />
              )}
              <Text
                style={[
                  styles.stageLabel,
                  {
                    color: isDone
                      ? colors.text
                      : isActive
                      ? colors.primary
                      : colors.textMuted,
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
              >
                {stage.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Footer */}
      <Text style={[styles.footer, { color: colors.textMuted }]}>
        {t('analysis.loading_hint', 'Usually takes 15-30 seconds')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  bar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 18,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
  },
  stageList: {
    gap: 14,
    marginBottom: 20,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stageSpinner: {
    width: 20,
    height: 20,
  },
  stageLabel: {
    fontSize: 14,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
  },
});
