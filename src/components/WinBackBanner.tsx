import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import { analytics } from '../services/analytics';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';

interface Props {
  payload: Record<string, unknown>;
}

type Bucket = 'd0_2' | 'd3_7' | 'd8_30';

const DISMISS_KEY_PREFIX = 'subradar:winback-dismissed:';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h — banner re-shows after a day

function bucketFor(days: number | null): Bucket {
  if (days === null || days < 0) return 'd3_7';
  if (days <= 2) return 'd0_2';
  if (days <= 7) return 'd3_7';
  return 'd8_30';
}

export default function WinBackBanner({ payload }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);

  const daysSince =
    typeof payload.daysSince === 'number'
      ? payload.daysSince
      : typeof payload.daysSince === 'string'
      ? Number(payload.daysSince)
      : null;
  const bucket: Bucket = bucketFor(daysSince);

  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const key = DISMISS_KEY_PREFIX + bucket;
    AsyncStorage.getItem(key).then((val) => {
      if (val) {
        const ts = Number(val);
        if (!Number.isNaN(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          setDismissed(true);
        }
      }
      setLoaded(true);
    });
  }, [bucket]);

  useEffect(() => {
    if (loaded && !dismissed) {
      analytics.track('banner_shown', { priority: 'win_back', bucket });
      analytics.track('winback_banner_shown', { bucket });
    }
  }, [loaded, dismissed, bucket]);

  if (!loaded || dismissed) return null;

  const trackedCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;

  const content = (() => {
    if (bucket === 'd0_2') {
      return {
        title: t('retention.winback_d02_title', { defaultValue: 'Miss unlimited tracking?' }),
        subtitle: t('retention.winback_d02_cta', { defaultValue: 'Come back to Pro anytime' }),
        icon: 'sparkles' as const,
        bg: '#7C3AED',
      };
    }
    if (bucket === 'd3_7') {
      return {
        title: t('retention.winback_d37_title', { count: trackedCount, defaultValue: `${trackedCount} subscriptions waiting to be tracked` }),
        subtitle: t('retention.winback_d37_cta', { defaultValue: 'Unlock unlimited + AI renewal alerts' }),
        icon: 'eye-outline' as const,
        bg: '#EC4899',
      };
    }
    return {
      title: t('retention.winback_d830_title', { defaultValue: 'Come back — 50% off your first month' }),
      subtitle: t('retention.winback_d830_cta', { defaultValue: 'Best offer for returning users' }),
      icon: 'flame' as const,
      bg: '#EF4444',
    };
  })();

  const handleTap = () => {
    analytics.track('banner_action_tapped', { priority: 'win_back', bucket });
    analytics.track('winback_banner_tapped', { bucket });
    router.push('/paywall?prefill=pro-yearly' as any);
  };

  const handleDismiss = () => {
    setDismissed(true);
    analytics.track('winback_banner_dismissed', { bucket });
    AsyncStorage.setItem(DISMISS_KEY_PREFIX + bucket, Date.now().toString());
  };

  return (
    <View testID="win_back-banner" style={[styles.container, { backgroundColor: content.bg }]}>
      <TouchableOpacity
        onPress={handleTap}
        activeOpacity={0.8}
        style={styles.inner}
      >
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name={content.icon} size={20} color="#FFF" />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.subtitle}>{content.subtitle}</Text>
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
    position: 'relative',
  },
  inner: { padding: 16 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 24 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: '#FFF', marginBottom: 2 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  closeBtn: { position: 'absolute', top: 12, right: 12 },
});
