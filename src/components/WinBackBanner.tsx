import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';

interface Props {
  downgradedAt: string | null;
}

const DISMISS_KEY = 'subradar:winback-dismissed';

export default function WinBackBanner({ downgradedAt }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((val) => {
      if (val) setDismissed(true);
      setLoaded(true);
    });
  }, []);

  if (!loaded || dismissed || !downgradedAt) return null;

  const downgradedDate = new Date(downgradedAt);
  const daysSince = Math.floor((Date.now() - downgradedDate.getTime()) / 86400000);

  if (daysSince < 0 || daysSince > 30) return null;

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.push('/paywall' as any)}
        activeOpacity={0.8}
        style={styles.inner}
      >
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={20} color="#FFF" />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.title}>
              {t('retention.winback_title', 'Miss unlimited subscriptions?')}
            </Text>
            <Text style={styles.subtitle}>
              {t('retention.winback_cta', 'Upgrade now and get back to Pro')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.closeBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#7C3AED',
    position: 'relative',
  },
  inner: {
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 24,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
});
