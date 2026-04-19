/**
 * SyncRetryModal
 *
 * Shown when a paywall purchase completed on Apple's side but the /billing/sync
 * call failed 3 times in a row. Lets the user re-trigger the sync manually
 * without losing the purchase — the Apple receipt is already valid, we just
 * need the server to catch up.
 *
 * i18n: TODO (Phase 10) — strings intentionally hardcoded in Russian for now.
 */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../theme';

interface Props {
  visible: boolean;
  loading?: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function SyncRetryModal({ visible, loading = false, onRetry, onDismiss }: Props) {
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF',
              borderColor: isDark ? '#2A2A3E' : '#E5E7EB',
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Синхронизация задерживается
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Покупка прошла на стороне App Store, но сервер пока не подтвердил
            активацию. Попробуем ещё раз?
          </Text>

          <TouchableOpacity
            onPress={onRetry}
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Проверить ещё раз"
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Проверить ещё раз</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDismiss}
            disabled={loading}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Позже"
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>
              Позже
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
