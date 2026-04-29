/**
 * VoiceInputStage — the initial "idle" screen of the AIWizard. Shows the
 * big mic button, text input fallback, and a horizontal scroller of
 * quick-add service chips. Also renders a full-screen loading indicator
 * while the wizard is transcribing voice / parsing / searching.
 *
 * Why this exists:
 *   The `ui.kind === 'idle'` branch used to render inline inside
 *   `AIWizard.tsx` and re-mounted on every parent re-render, which meant
 *   the mic pulse animation and the `useVoiceRecorder` hook restarted on
 *   any unrelated wizard state change. Extracting + wrapping in
 *   `React.memo` keeps the mic component alive across parent renders as
 *   long as its props (which are stable via `useCallback` in the parent)
 *   don't change.
 *
 * Helpers:
 *   The `LoadingIndicator` and `MicButton` helpers (previously top-level
 *   in `AIWizard.tsx`) live here as file-scope components — they are
 *   used only from the idle branch. Moving them keeps the idle UI
 *   self-contained without dragging dead imports into the orchestrator.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  StyleSheet,
  Pressable,
} from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import type { LoadingStage } from './types';

// ── Loading stage labels (local i18n — wizard-specific strings) ─────────────
const STAGE_LABELS: Record<string, Record<string, string>> = {
  transcribing: { en: 'Transcribing audio...', ru: 'Распознаю речь...' },
  analyzing:    { en: 'Analyzing request...', ru: 'Анализирую запрос...' },
  searching:    { en: 'Searching services...', ru: 'Ищу сервисы...' },
  preparing:    { en: 'Preparing options...', ru: 'Подбираю варианты...' },
};

function LoadingIndicator({
  stage,
  colors,
  lang,
}: {
  stage: LoadingStage;
  colors: any;
  lang: string;
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progressAnim.setValue(0);
    const stages: LoadingStage[] = ['transcribing', 'analyzing', 'searching', 'preparing'];
    const idx = stages.indexOf(stage ?? 'transcribing');
    Animated.timing(progressAnim, {
      toValue: Math.min((idx + 1) / stages.length, 0.95),
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [stage]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dotAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(dotAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const label =
    STAGE_LABELS[stage ?? 'transcribing']?.[lang] ??
    STAGE_LABELS[stage ?? 'transcribing']?.en ??
    '';

  return (
    <View style={loadStyles.wrap}>
      <Animated.View style={{ opacity: dotAnim, marginBottom: 16 }}>
        <View style={[loadStyles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Animated.View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
        {label}
      </Text>
      <View style={[loadStyles.track, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            loadStyles.fill,
            {
              backgroundColor: colors.primary,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const loadStyles = StyleSheet.create({
  wrap:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, flex: 1 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  track:      { width: '60%', height: 4, borderRadius: 2, overflow: 'hidden' },
  fill:       { height: '100%', borderRadius: 2 },
});

// ── MicButton ────────────────────────────────────────────────────────────────
function MicSvg({ size = 28, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="2" width="6" height="11" rx="3" fill={color} />
      <Path d="M5 11a7 7 0 0014 0" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M12 18v4M9 22h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function StopSvg() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Rect x="6" y="6" width="12" height="12" rx="2" fill="white" />
    </Svg>
  );
}

function MicButton({
  onVoice,
  loadingStage,
  colors,
  t,
  lang,
}: {
  onVoice: (uri: string) => void;
  loadingStage: LoadingStage;
  colors: any;
  t: any;
  lang: string;
}) {
  const { isRecording, duration, maxDuration, durationFmt, start, stop } = useVoiceRecorder(onVoice);
  const ring1 = useRef(new Animated.Value(1)).current;
  const loading = !!loadingStage;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ring1, {
        toValue: isRecording ? 1.3 : 1.15,
        duration: isRecording ? 500 : 900,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
      Animated.timing(ring1, {
        toValue: 1,
        duration: isRecording ? 500 : 900,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isRecording]);

  const bg = isRecording ? '#EF4444' : colors.primary;
  const progress = duration / maxDuration;

  const toggle = () => {
    if (loading) return;
    if (isRecording) stop();
    else start();
  };

  if (loading) {
    return <LoadingIndicator stage={loadingStage} colors={colors} lang={lang} />;
  }

  return (
    <View style={micStyles.container}>
      <View style={micStyles.btnArea}>
        <Animated.View
          style={[
            micStyles.ring,
            {
              backgroundColor: bg + (isRecording ? '28' : '20'),
              transform: [{ scale: ring1 }],
            },
          ]}
        />
        <Pressable onPress={toggle} style={micStyles.pressable}>
          <View style={[micStyles.btn, { backgroundColor: bg, shadowColor: bg }]}>
            {isRecording ? <StopSvg /> : <MicSvg size={34} />}
          </View>
        </Pressable>
      </View>

      <View style={micStyles.labelWrap}>
        {isRecording ? (
          <>
            <Text style={[micStyles.timer, { color: '#EF4444' }]}>{durationFmt}</Text>
            <View style={micStyles.progressTrack}>
              <View
                style={[
                  micStyles.progressFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: progress > 0.8 ? '#EF4444' : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={[micStyles.limit, { color: colors.textMuted }]}>
              {t('add.max_recording', { sec: maxDuration, defaultValue: 'max {{sec}}s' })}
            </Text>
          </>
        ) : (
          <Text style={[micStyles.label, { color: colors.textSecondary }]}>
            {t('add.tap_to_record', 'Нажмите для записи')}
          </Text>
        )}
      </View>
    </View>
  );
}

const BTN_SIZE = 84;
const RING_SIZE = 128;

const micStyles = StyleSheet.create({
  container:     { alignItems: 'center', marginVertical: 8, gap: 14 },
  btnArea:       {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring:          {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  pressable:     { zIndex: 2 },
  btn:           {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  labelWrap:     { alignItems: 'center', minHeight: 44 },
  label:         { fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
  timer:         { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  progressTrack: { width: 150, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(128,128,128,0.2)', marginTop: 8, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 1.5 },
  limit:         { fontSize: 11, fontWeight: '500', marginTop: 4, opacity: 0.6 },
});

// ── Props ───────────────────────────────────────────────────────────────────

/**
 * Shape required for each quick-add chip. The parent (`AIWizard`) owns
 * the full `QUICK` constant with narrower literal types (e.g.
 * `billingPeriod: 'MONTHLY'`); this stage only needs the row's name /
 * icon for rendering and forwards the full item back to the parent via
 * `onQuickSelect`. Extra fields on the concrete `QUICK` entries (amount,
 * cancelUrl, etc.) are invisible here but preserved through the `any`
 * widening on `onQuickSelect` below.
 */
export interface QuickServiceRow {
  name: string;
  Icon: React.ComponentType<{ size?: number }>;
}

interface Props {
  /** Current loading phase, or `null` when idle. */
  loadingStage: LoadingStage;
  /** Submitted when a voice recording finishes — gives the audio file URI. */
  onVoice: (uri: string) => void;
  /** Controlled text input value — owned by the orchestrator so other
   *  stages (e.g. voice transcription result) can prefill it. */
  input: string;
  onChangeInput: (value: string) => void;
  /** Fired on Return key / footer Next — parent runs the wizard call. */
  onSubmit: (value: string) => void;
  /** One of the built-in quick services was tapped. The parent receives
   *  the original row object and casts it back to the richer shape it
   *  stored in `QUICK`. */
  onQuickSelect: (service: QuickServiceRow) => void;
  /** List of built-in services rendered as horizontal chips. */
  quickServices: ReadonlyArray<QuickServiceRow>;
}

function VoiceInputStageImpl({
  loadingStage,
  onVoice,
  input,
  onChangeInput,
  onSubmit,
  onQuickSelect,
  quickServices,
}: Props) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();

  const bg = isDark ? '#1C1C2E' : '#F5F5F7';
  const card = isDark ? '#252538' : '#FFFFFF';
  const lang = i18n.language ?? 'en';

  const questionText = t('add.ai_q_name', 'Что за подписка?');
  const hintText = t('add.ai_q_name_hint', 'Скажи или напечатай название сервиса');

  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.question, { color: colors.text }]}>{questionText}</Text>
      {!!hintText && !loadingStage && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{hintText}</Text>
      )}

      {/* Loading stages indicator — shown for both voice and text. */}
      {loadingStage ? (
        <LoadingIndicator stage={loadingStage} colors={colors} lang={lang} />
      ) : (
        <>
          <MicButton
            onVoice={onVoice}
            loadingStage={null}
            colors={colors}
            t={t}
            lang={lang}
          />

          {/* OR divider */}
          <View style={styles.orRow}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text style={[styles.orText, { color: colors.textMuted }]}>{t('common.or')}</Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>
        </>
      )}

      {/* Text input + chips — hidden during loading. */}
      {!loadingStage && (
        <>
          <DoneAccessoryInput
            testID="ai-wizard-input"
            style={[
              styles.textInput,
              {
                backgroundColor: bg,
                color: colors.text,
                borderColor: colors.border,
                minHeight: 56,
                maxHeight: 120,
                textAlignVertical: 'top',
                paddingTop: 14,
              },
            ]}
            value={input}
            onChangeText={onChangeInput}
            placeholder="Netflix, Spotify, ChatGPT..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={2}
            blurOnSubmit
            returnKeyType="send"
            onSubmitEditing={() => {
              const trimmed = input.trim();
              if (!trimmed) return;
              Keyboard.dismiss();
              onSubmit(trimmed);
            }}
          />

          {/* Quick chips — popular services bypass the AI wizard entirely. */}
          <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>
            {t('ai.popular_services')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            contentInsetAdjustmentBehavior="automatic"
          >
            {quickServices.map((svc) => (
              <TouchableOpacity
                key={svc.name}
                style={[styles.chip, { backgroundColor: card, borderColor: colors.border }]}
                onPress={() => onQuickSelect(svc)}
              >
                <svc.Icon size={20} />
                <Text style={[styles.chipText, { color: colors.text }]}>{svc.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

export const VoiceInputStage = React.memo(VoiceInputStageImpl);

const styles = StyleSheet.create({
  question:   { fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 2 },
  hint:       { fontSize: 14, marginBottom: 8 },
  orRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  line:       { flex: 1, height: 1 },
  orText:     { fontSize: 13 },
  textInput:  { borderRadius: 14, padding: 16, fontSize: 17, borderWidth: 1.5, marginBottom: 12 },
  quickLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 30, borderWidth: 1, marginRight: 8 },
  chipText:   { fontSize: 13, fontWeight: '600' },
});
