import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export type NoticeKind = 'error' | 'warn' | 'success' | 'info';

export interface Notice {
  kind: NoticeKind;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Shared slide-in banner. Replaces ad-hoc `Alert.alert` calls across
 * screens with a visually-consistent in-screen notice — system Alerts
 * yank the user out of context (Android animates the whole frame,
 * iOS dims everything) which is overkill for a "we couldn't reach the
 * server" message. Errors/warnings stick until the user taps ×;
 * success/info should be auto-dismissed by the parent.
 *
 * Originally inlined in `app/gmail-import.tsx`; extracted so the
 * Workspace / Settings screens can reuse the same pattern without
 * duplicating the palette + animation logic.
 */
export function NoticeBanner({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [notice, translateY, opacity]);

  const palette: Record<
    NoticeKind,
    { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap; tint: string }
  > = {
    error: {
      bg: 'rgba(239,68,68,0.10)',
      border: '#EF4444',
      icon: 'alert-circle',
      tint: '#EF4444',
    },
    warn: {
      bg: 'rgba(245,158,11,0.10)',
      border: '#F59E0B',
      icon: 'warning',
      tint: '#F59E0B',
    },
    success: {
      bg: 'rgba(16,185,129,0.10)',
      border: '#10B981',
      icon: 'checkmark-circle',
      tint: '#10B981',
    },
    info: {
      bg: 'rgba(59,130,246,0.10)',
      border: '#3B82F6',
      icon: 'information-circle',
      tint: '#3B82F6',
    },
  };
  const p = palette[notice.kind];

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Ionicons name={p.icon} size={20} color={p.tint} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {notice.title}
        </Text>
        {!!notice.body && (
          <Text
            style={[styles.body, { color: colors.textSecondary }]}
            numberOfLines={4}
          >
            {notice.body}
          </Text>
        )}
        {!!notice.actionLabel && !!notice.onAction && (
          <TouchableOpacity
            onPress={notice.onAction}
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.actionText, { color: p.tint }]}>
              {notice.actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        onPress={onClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Helper for `useState<Notice | null>` + auto-dismiss on success/info.
 * Lets callers do `const [notice, showNotice] = useNotice()` instead
 * of redeclaring the setTimeout cleanup per screen.
 */
export function useNotice(): [Notice | null, (n: Notice | null) => void] {
  const [notice, setNotice] = React.useState<Notice | null>(null);
  useEffect(() => {
    if (!notice) return;
    if (notice.kind !== 'success' && notice.kind !== 'info') return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);
  return [notice, setNotice];
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  actionBtn: { marginTop: 8, alignSelf: 'flex-start' },
  actionText: { fontSize: 13, fontWeight: '700' },
});
