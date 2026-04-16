import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../api/client';

// Derive the base (strip /api/v1 suffix if present) and re-append health path
const HEALTH_URL = `${API_URL.replace(/\/api\/v1\/?$/, '')}/api/v1/health`;

export function OfflineBanner() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(false);
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
          await fetch(HEALTH_URL, {
            method: 'HEAD',
            signal: controller.signal,
          });
          if (!cancelled) setIsOffline(false);
        } finally {
          clearTimeout(timeout);
        }
      } catch {
        if (!cancelled) {
          setIsOffline(true);
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

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel={t('a11y.offline_banner', 'Offline banner')}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>
        {t('common.offline', 'No internet connection')}
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
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
