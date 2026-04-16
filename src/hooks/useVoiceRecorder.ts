import { useState, useRef, useCallback, useEffect } from 'react';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';

export const MAX_RECORDING_SECONDS = 30;

// Swallow promise rejection without letting it bubble up as "Uncaught (in promise)".
// Some expo-audio methods synchronously return a promise that rejects asynchronously
// (e.g. when the native SharedObject has already been released on unmount).
const swallow = (p: unknown) => {
  if (p && typeof (p as any).then === 'function') {
    (p as Promise<unknown>).catch(() => {});
  }
};

// Read `recorder.uri` defensively: after a crashed stop() or on unmount the
// native shared object may be gone, and *any* property access throws
// "Unable to find the native shared object associated with given JavaScript object".
const safeUri = (recorder: any): string | null => {
  try {
    return recorder?.uri ?? null;
  } catch {
    return null;
  }
};

export function useVoiceRecorder(
  onDone: (uri: string) => void,
  onError?: (reason: 'no_uri' | 'start_failed' | 'stop_failed') => void,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

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

  const forceIdle = useCallback(() => {
    clearTimer();
    stoppingRef.current = false;
    if (mountedRef.current) {
      setIsRecording(false);
      setDuration(0);
    }
  }, []);

  const stop = useCallback(async () => {
    if (!isRecording || stoppingRef.current) return;
    stoppingRef.current = true;
    clearTimer();
    let uri: string | null = null;
    let stopFailed = false;
    try {
      await recorder.stop();
      uri = safeUri(recorder);
    } catch (e) {
      if (__DEV__) console.warn('[voice] stop error', e);
      stopFailed = true;
      uri = safeUri(recorder);
    }
    if (!mountedRef.current) {
      stoppingRef.current = false;
      return;
    }
    setIsRecording(false);
    setDuration(0);
    stoppingRef.current = false;
    if (uri) {
      try {
        onDone(uri);
      } catch (e) {
        if (__DEV__) console.warn('[voice] onDone threw', e);
      }
    } else {
      onError?.(stopFailed ? 'stop_failed' : 'no_uri');
    }
  }, [isRecording, recorder, onDone, onError]);

  const start = useCallback(async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted || !mountedRef.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      // `record()` may return a Promise that rejects asynchronously.
      swallow(recorder.record() as unknown);
      if (!mountedRef.current) {
        swallow(recorder.stop() as unknown);
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
      if (__DEV__) console.warn('[voice] start error', e);
      forceIdle();
      onError?.('start_failed');
    }
  }, [recorder, forceIdle, onError]);

  // Auto-stop at max duration
  useEffect(() => {
    if (isRecording && duration >= MAX_RECORDING_SECONDS) {
      stop();
    }
  }, [duration, isRecording, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      try {
        swallow(recorderRef.current?.stop?.() as unknown);
      } catch {
        // already released — ignore
      }
    };
  }, []);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return {
    isRecording,
    duration,
    maxDuration: MAX_RECORDING_SECONDS,
    durationFmt: fmt(duration),
    start,
    stop,
    reset: forceIdle,
  };
}
