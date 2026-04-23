import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import type { AddedViaSource, LoadingStage } from './types';

interface Props {
  stage: LoadingStage;
  source: AddedViaSource;
  /**
   * Whether a voice transcription has been produced in this flow. When true
   * (and source is AI_TEXT), the "transcribing" step stays visible with a
   * checkmark even after we've advanced to "thinking" — so users understand
   * their voice was captured.
   */
  hasTranscribedText: boolean;
  onCancel: () => void;
}

function LoadingViewImpl({ stage, source, hasTranscribedText, onCancel }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const { stageOrder, currentIdx } = useMemo(() => {
    const voiceHadTranscribe = source === 'AI_TEXT' && (stage === 'transcribing' || hasTranscribedText);
    const order: LoadingStage[] = voiceHadTranscribe
      ? ['transcribing', 'thinking', 'saving']
      : source === 'AI_SCREENSHOT'
      ? ['analyzing', 'thinking', 'saving']
      : ['thinking', 'saving'];
    return { stageOrder: order, currentIdx: Math.max(order.indexOf(stage), 0) };
  }, [source, stage, hasTranscribedText]);

  const stageLabel = (s: LoadingStage) => ({
    transcribing: t('add.stage_transcribing', 'Transcribing voice'),
    analyzing: t('add.stage_analyzing', 'Analyzing image'),
    thinking: t('add.stage_thinking', 'AI looking up service'),
    saving: t('add.stage_saving', 'Saving subscription'),
  }[s]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
        {stageLabel(stage)}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, marginBottom: 24 }}>
        {t('add.loading_hint', 'AI is processing your request. This usually takes a few seconds.')}
      </Text>

      {/* Progressive steps — shows all stages, ticks off completed ones */}
      <View style={{ gap: 10, alignSelf: 'stretch', paddingHorizontal: 32 }}>
        {stageOrder.map((s, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const pending = idx > currentIdx;
          const iconName = done ? 'checkmark-circle' : active ? 'ellipsis-horizontal-circle' : 'ellipse-outline';
          const iconColor = done ? '#22C55E' : active ? colors.primary : colors.textMuted;
          return (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={iconName as any} size={20} color={iconColor} />
              <Text style={{
                color: active ? colors.text : pending ? colors.textMuted : colors.textSecondary,
                fontSize: 14,
                fontWeight: active ? '700' : '500',
              }}>
                {stageLabel(s)}
              </Text>
              {active && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />}
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={onCancel}
        style={{ marginTop: 28, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.surface2 }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
          {t('common.cancel', 'Cancel')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const LoadingView = memo(LoadingViewImpl);
