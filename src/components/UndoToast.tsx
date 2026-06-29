import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeLinearGradient as LinearGradient } from './SafeLinearGradient';
import { useTheme } from '../theme';

interface Props {
  message: string;
  duration?: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ message, duration = 5000, onUndo, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
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

  // Snackbar palette adapts to the theme: in dark mode an elevated surface
  // (surface2) with a hairline border reads cleaner than pure black against
  // the near-black background; in light mode the brand-dark navy (theme `text`)
  // gives a crisp, on-brand contrast against white. The Undo accent is a bright
  // lavender that stays legible on both backgrounds.
  const toastBg = isDark ? colors.surface2 : colors.text;
  const toastText = isDark ? colors.text : '#FFFFFF';
  const undoAccent = '#A78BFA';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: toastBg, borderWidth: isDark ? 1 : 0, borderColor: colors.border },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.message, { color: toastText }]} numberOfLines={1}>{message}</Text>
        <TouchableOpacity onPress={onUndo}>
          <Text style={[styles.undoText, { color: undoAccent }]}>{t('add_flow.undo', 'Undo')}</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[
          styles.progressBar,
          { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      >
        <LinearGradient
          colors={['#7c3aed', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // bottom must clear the floating tab bar (absolute, height 84, elevation 20
  // in app/(tabs)/_layout.tsx). At the old bottom:40 the toast rendered behind
  // the tab bar — only the top sliver of its near-black bg peeked above the
  // bar (the "black bar after delete" report) and the Undo button was unreachable.
  // 100 matches the list's paddingBottom and floats the toast just above the bar.
  container: { position: 'absolute', bottom: 100, left: 16, right: 16, borderRadius: 12, overflow: 'hidden', elevation: 24, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  content: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  message: { fontSize: 15, flex: 1, marginRight: 12 },
  undoText: { fontSize: 15, fontWeight: '700' },
  progressBar: { height: 3, overflow: 'hidden' },
});
