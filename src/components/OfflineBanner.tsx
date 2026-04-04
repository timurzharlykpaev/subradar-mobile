import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        await fetch('https://api.subradar.ai/api/v1/health', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        setIsOffline(false);
      } catch {
        setIsOffline(true);
      }
    };

    checkConnection();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkConnection();
    });
    return () => sub.remove();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.container}>
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
