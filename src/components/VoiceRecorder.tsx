import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import { COLORS } from '../constants';

interface Props {
  onRecordingComplete: (uri: string) => void;
}

export const VoiceRecorder: React.FC<Props> = ({ onRecordingComplete }) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    scaleAnim.stopAnimation();
    scaleAnim.setValue(1);

    await recorder.stop();
    setIsRecording(false);

    if (recorder.uri) {
      onRecordingComplete(recorder.uri);
    }
  }, [isRecording, recorder, scaleAnim, onRecordingComplete]);

  // Stop recording when app goes to background
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState !== 'active' && isRecording) {
        stopRecording();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isRecording, stopRecording]);

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('Recording error', msg);
    }
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Pressable
        onPressIn={startRecording}
        onPressOut={stopRecording}
      >
        <Animated.View
          style={[styles.button, isRecording && styles.recording, { transform: [{ scale: scaleAnim }] }]}
        >
          <Text style={styles.icon}>{isRecording ? '⏹' : '🎙'}</Text>
        </Animated.View>
      </Pressable>
      <Text style={styles.label}>
        {isRecording ? formatDuration(duration) : t('voice.hold_to_record')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recording: { backgroundColor: '#FFE0E0' },
  icon: { fontSize: 28 },
  label: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
});
