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

  // Refs survive re-renders and can be read/cleared from unmount cleanup
  // without triggering React warnings or racing with setState.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);
  const mountedRef = useRef(true);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stop = useCallback(async () => {
    if (!isRecording || stoppingRef.current) return;
    stoppingRef.current = true;
    clearTimer();
    try {
      await recorder.stop();
    } catch {
      // recorder might already be stopped/unloaded on cleanup path
    }
    if (!mountedRef.current) {
      stoppingRef.current = false;
      return;
    }
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
      if (!granted || !mountedRef.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      if (!mountedRef.current) {
        // Unmounted while we were preparing — tear down immediately
        try { await recorder.stop(); } catch {}
        return;
      }
      setIsRecording(true);
      setDuration(0);
      intervalRef.current = setInterval(() => {
        if (!mountedRef.current) {
          clearTimer();
          return;
        }
        setDuration(d => d + 1);
      }, 1000);
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

  // Mount/unmount guard + cleanup.
  // Runs once at mount, cleans timer AND force-unloads the recorder on unmount
  // so we don't leak the native audio session when the component disappears
  // mid-recording (e.g. user navigates away).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      try {
        recorderRef.current?.stop?.();
      } catch {
        // already stopped — ignore
      }
    };
  }, []);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return { isRecording, duration, maxDuration: MAX_RECORDING_SECONDS, durationFmt: fmt(duration), start, stop };
}
