import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../api/client';

// Derive the base (strip /api/v1 suffix if present) and re-append health path
const HEALTH_URL = `${API_URL.replace(/\/api\/v1\/?$/, '')}/api/v1/health`;

type Reachability = 'ok' | 'service_down' | 'no_network';

export function OfflineBanner() {
  const { t } = useTranslation();
  const [reach, setReach] = useState<Reachability>('ok');
  const isOffline = reach !== 'ok';
  const retryRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;

    const checkConnection = async () => {
      // Always clear any previously scheduled retry before a new attempt.
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = undefined;
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(HEALTH_URL, {
            method: 'HEAD',
            signal: controller.signal,
          });
          // 5xx (typical during a blue-green redeploy window or backend
          // crash-loop) means the SERVICE is unreachable even though the
          // network is up. Differentiate from a real offline so we can show
          // the right copy ("Service temporarily unavailable" vs "No
          // internet connection").
          const next: Reachability = res.status >= 500 ? 'service_down' : 'ok';
          if (!cancelled) setReach(next);
          if (next !== 'ok' && !cancelled) {
            retryRef.current = setTimeout(checkConnection, 5000);
          }
        } finally {
          clearTimeout(timeout);
        }
      } catch {
        if (!cancelled) {
          setReach('no_network');
          // Retry after 5 seconds when offline
          retryRef.current = setTimeout(checkConnection, 5000);
        }
      }
    };

    checkConnection();
    // Re-check when app comes back to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkConnection();
    });
    // Also re-check periodically while banner is shown
    const interval = setInterval(() => {
      if (isOffline) checkConnection();
    }, 10000);
    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(interval);
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = undefined;
      }
    };
  }, [isOffline]);

  if (!isOffline) return null;

  const isServiceDown = reach === 'service_down';
  return (
    <View
      style={[styles.container, isServiceDown && styles.containerWarning]}
      accessibilityRole="alert"
      accessibilityLabel={t('a11y.offline_banner', 'Offline banner')}
    >
      <Ionicons
        name={isServiceDown ? 'alert-circle-outline' : 'cloud-offline-outline'}
        size={16}
        color="#fff"
      />
      <Text style={styles.text}>
        {isServiceDown
          ? t('common.service_unavailable', 'Service temporarily unavailable — retrying…')
          : t('common.offline', 'No internet connection')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  containerWarning: { backgroundColor: '#f59e0b' },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
