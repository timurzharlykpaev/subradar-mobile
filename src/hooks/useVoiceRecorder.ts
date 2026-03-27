import { useState, useRef, useCallback, useEffect } from 'react';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';

export function useVoiceRecorder(onDone: (uri: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

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

  const stop = useCallback(async () => {
    if (!isRecording) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    await recorder.stop();
    setIsRecording(false);
    setDuration(0);
    if (recorder.uri) onDone(recorder.uri);
  }, [isRecording, recorder, onDone]);

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

  return { isRecording, duration, durationFmt: fmt(duration), start, stop };
}
