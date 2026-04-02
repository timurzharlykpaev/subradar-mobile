import { useState, useRef, useCallback, useEffect } from 'react';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';

export const MAX_RECORDING_SECONDS = 30;

export function useVoiceRecorder(onDone: (uri: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const stop = useCallback(async () => {
    if (!isRecording || stoppingRef.current) return;
    stoppingRef.current = true;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    await recorder.stop();
    setIsRecording(false);
    setDuration(0);
    stoppingRef.current = false;
    if (recorder.uri) {
      onDone(recorder.uri);
    }
  }, [isRecording, recorder, onDone]);

  const start = useCallback(async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e) {
      if (__DEV__) console.warn('Voice start error', e);
    }
  }, [recorder]);

  // Auto-stop at max duration
  useEffect(() => {
    if (isRecording && duration >= MAX_RECORDING_SECONDS) {
      stop();
    }
  }, [duration, isRecording, stop]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return { isRecording, duration, maxDuration: MAX_RECORDING_SECONDS, durationFmt: fmt(duration), start, stop };
}
