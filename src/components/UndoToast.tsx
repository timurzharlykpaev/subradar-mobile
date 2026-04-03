import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  message: string;
  duration?: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ message, duration = 5000, onUndo, onDismiss }: Props) {
  const { t } = useTranslation();
  const progress = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start(() => {
      setVisible(false);
      onDismiss();
    });
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.message} numberOfLines={1}>{message}</Text>
        <TouchableOpacity onPress={onUndo}>
          <Text style={styles.undoText}>{t('add_flow.undo', 'Undo')}</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[
          styles.progressBar,
          { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 40, left: 16, right: 16, backgroundColor: '#1a1a1a', borderRadius: 12, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  content: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  message: { color: '#fff', fontSize: 15, flex: 1, marginRight: 12 },
  undoText: { color: '#7c3aed', fontSize: 15, fontWeight: '700' },
  progressBar: { height: 3, backgroundColor: '#7c3aed' },
});
