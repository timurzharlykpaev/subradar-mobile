/**
 * SyncRetryModal
 *
 * Shown when a paywall purchase completed on Apple's side but the /billing/sync
 * call failed 3 times in a row. Lets the user re-trigger the sync manually
 * without losing the purchase — the Apple receipt is already valid, we just
 * need the server to catch up.
 *
 * All copy is routed through i18n — keys live under `paywall.sync_retry_*`.
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
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme';

interface Props {
  visible: boolean;
  loading?: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function SyncRetryModal({ visible, loading = false, onRetry, onDismiss }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const title = t('paywall.sync_retry_title', 'Sync delayed');
  const message = t(
    'paywall.sync_retry_message',
    "Your purchase went through on Apple's side, but the server hasn't confirmed the activation yet. Try again?",
  );
  const retryCta = t('paywall.sync_retry_cta', 'Try again');
  const laterCta = t('paywall.sync_retry_later', 'Later');

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
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

          <TouchableOpacity
            onPress={onRetry}
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={retryCta}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>{retryCta}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDismiss}
            disabled={loading}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel={laterCta}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>{laterCta}</Text>
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
