import React, { memo, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Avoiding `expo-linear-gradient` — see comment in IdleView for the
// "ExpoLinearGradient view config missing" bug on dev clients that
// haven't been rebuilt. A flat-colour bubble + overlay highlight gives
// the same look without a native dependency.
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

  // Pick a contextual icon for the central bubble — voice gets a mic,
  // screenshot gets a scan glyph, the rest fall back to a sparkle (AI).
  const centralIcon: React.ComponentProps<typeof Ionicons>['name'] =
    stage === 'transcribing'
      ? 'mic'
      : stage === 'analyzing'
      ? 'scan'
      : stage === 'saving'
      ? 'checkmark'
      : 'sparkles';

  // Pulsing bubble — replaces the basic ActivityIndicator with a more
  // intentional "AI is working on it" visual. Same loop pattern as the
  // voice hero in IdleView for consistency.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Active progress dot — slides between the rendered stage rows so the
  // user sees forward movement even when a single step takes a while.
  const dotProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(dotProgress, {
      toValue: currentIdx,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentIdx, dotProgress]);

  return (
    <View style={styles.container}>
      {/* Central pulsing bubble — flat primary colour + glossy highlight. */}
      <Animated.View style={[styles.bubble, { transform: [{ scale: pulse }] }]}>
        <View style={[styles.bubbleGradient, { backgroundColor: colors.primary }]}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '60%',
              backgroundColor: 'rgba(0,0,0,0.18)',
            }}
          />
          <View pointerEvents="none" style={styles.bubbleHighlight} />
          <Ionicons name={centralIcon} size={42} color="#FFF" style={{ opacity: 0.97 }} />
        </View>
      </Animated.View>

      <Text style={[styles.title, { color: colors.text }]}>
        {stageLabel(stage)}
      </Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('add.loading_hint_v2', 'A few seconds — we\'re reading the details and adding your subscription.')}
      </Text>

      {/* Progressive steps */}
      <View style={styles.steps}>
        {stageOrder.map((s, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const pending = idx > currentIdx;
          return (
            <View key={s} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  done
                    ? { backgroundColor: '#22C55E', borderColor: '#22C55E' }
                    : active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: 'transparent', borderColor: colors.border },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                ) : active ? (
                  <Animated.View
                    style={[
                      styles.activeDotInner,
                      { transform: [{ scale: pulse.interpolate({ inputRange: [1, 1.08], outputRange: [0.6, 1] }) }] },
                    ]}
                  />
                ) : null}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: active ? colors.text : pending ? colors.textMuted : colors.textSecondary,
                    fontWeight: active ? '700' : '500',
                  },
                ]}
              >
                {stageLabel(s)}
              </Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity onPress={onCancel} style={[styles.cancelBtn, { backgroundColor: colors.surface2 }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
          {t('common.cancel', 'Cancel')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const LoadingView = memo(LoadingViewImpl);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  bubble: {
    // Lighter, softer shadow — the previous opacity 0.45 + radius 20
    // produced a heavy fuzzy halo behind the bubble that read as a
    // visual artefact, especially in light theme. A subtle drop-shadow
    // is enough to anchor the bubble without that "smudge" effect.
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    marginBottom: 24,
  },
  bubbleGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleHighlight: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 24,
    height: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform: [{ rotate: '-25deg' }],
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4, letterSpacing: -0.2 },
  hint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 36, marginBottom: 28, lineHeight: 18 },
  steps: { gap: 12, alignSelf: 'stretch', paddingHorizontal: 40 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  activeDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  stepLabel: { fontSize: 14 },
  cancelBtn: { marginTop: 32, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
});
