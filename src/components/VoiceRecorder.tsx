import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { COLORS } from '../constants';

interface Props {
  onRecordingComplete: (uri: string) => void;
}

export const VoiceRecorder: React.FC<Props> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } catch (e) {
      console.error('Recording error', e);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    clearInterval(timerRef.current!);
    scaleAnim.stopAnimation();
    scaleAnim.setValue(1);

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;
    setIsRecording(false);

    if (uri) onRecordingComplete(uri);
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
        {isRecording ? formatDuration(duration) : 'Hold to record'}
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
