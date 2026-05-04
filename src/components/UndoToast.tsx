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
  // Track mount status so the timing callback doesn't fire onDismiss after
  // the parent has already swapped to a new toast (otherwise: a back-to-back
  // delete would fire onDismiss for the OLD subscription, which the parent
  // misinterprets as "commit current pending delete" and silently deletes
  // the wrong row — race documented in code review C1).
  const mountedRef = useRef(true);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (!mountedRef.current) return;
      // Only commit-on-timeout when the animation actually ran to completion;
      // a `.stop()` call from cleanup yields finished=false and we let the
      // unmount path own the cleanup.
      if (finished) {
        setVisible(false);
        onDismiss();
      }
    });
    return () => {
      mountedRef.current = false;
      animation.stop();
    };
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
