/**
 * VoiceMode — the `mode === 'voice'` branch of BulkAddSheet.
 *
 * The pulsing mic button and recorder hook live entirely in this component.
 * The orchestrator just provides the `onVoice(uri)` handler to fire the
 * parse pipeline once recording stops.
 */
import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

// ── Voice button (self-contained pulsing mic) ────────────────────────────────

function VoiceBtn({ onVoice, loading, colors }: { onVoice: (uri: string) => void; loading: boolean; colors: any }) {
  const { t } = useTranslation();
  const { isRecording, durationFmt, start, stop } = useVoiceRecorder(onVoice);
  const pulse = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Make sure any in-flight loop is stopped when component unmounts
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Stop any previous loop before starting a new one
    if (loopRef.current) {
      loopRef.current.stop();
      loopRef.current = null;
    }
    if (!mountedRef.current) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: isRecording ? 1.4 : 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loopRef.current = loop;
    loop.start();
    return () => {
      // Guard against race on unmount — only stop if this loop is still the active one
      if (loopRef.current === loop) {
        loop.stop();
        loopRef.current = null;
      }
    };
  }, [isRecording, pulse]);

  const bg = isRecording ? '#EF4444' : colors.primary;

  return (
    <View style={vStyles.wrap}>
      <Animated.View style={[vStyles.ring, { backgroundColor: bg + '22', transform: [{ scale: pulse }] }]} />
      <TouchableOpacity
        onPress={() => (isRecording ? stop() : start())}
        style={[vStyles.btn, { backgroundColor: bg, shadowColor: bg }]}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : isRecording ? (
          <Ionicons name="stop" size={32} color="#fff" />
        ) : (
          <Ionicons name="mic" size={36} color="#fff" />
        )}
      </TouchableOpacity>
      <Text style={[vStyles.label, { color: isRecording ? '#EF4444' : colors.textSecondary }]}>
        {loading ? t('common.loading') : isRecording ? durationFmt : t('add.tap_to_record')}
      </Text>
    </View>
  );
}

const vStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', height: 160, marginVertical: 8 },
  ring: { position: 'absolute', width: 130, height: 130, borderRadius: 65, top: 15, alignSelf: 'center' },
  btn: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 10 },
  label: { position: 'absolute', bottom: -2, fontSize: 13, fontWeight: '500' },
});

// ── VoiceMode shell ───────────────────────────────────────────────────────────

interface Props {
  loading: boolean;
  /** Called with the recorded audio file URI when user stops recording. */
  onVoice: (uri: string) => void;
  /** Called when user taps "← Назад". */
  onBack: () => void;
}

function VoiceModeImpl({ loading, onVoice, onBack }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[styles.modeTitle, { color: colors.text }]}>
        {t('add.bulk_voice_hint', 'Перечисли подписки голосом')}
      </Text>
      <Text style={[styles.modeExample, { color: colors.textMuted }]}>
        {t('add.bulk_voice_example', 'Например: "Netflix 15 долларов в месяц, Spotify 10, ChatGPT 20"')}
      </Text>
      <VoiceBtn onVoice={onVoice} loading={loading} colors={colors} />
      <TouchableOpacity onPress={onBack} style={{ marginTop: 8 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          ← {t('common.back', 'Назад')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const VoiceMode = memo(VoiceModeImpl);

const styles = StyleSheet.create({
  modeTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  modeExample: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20, paddingHorizontal: 16 },
});
