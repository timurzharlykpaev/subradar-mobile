import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import { analytics } from '../services/analytics';
import { useRevenueCat } from '../hooks/useRevenueCat';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { calcYearlySavings } from '../utils/calcYearlySavings';
import { formatMoney } from '../utils/formatMoney';

const DISMISS_KEY = 'subradar:annual-nudge-dismissed-at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface Props {
  payload: Record<string, unknown>;
}

export default function AnnualUpgradeBanner({ payload }: Props) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { offerings } = useRevenueCat();
  const access = useEffectiveAccess();

  const plan = typeof payload.plan === 'string' ? payload.plan : 'pro';

  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((raw) => {
      const ts = raw ? Number(raw) : 0;
      if (!Number.isNaN(ts) && ts > 0 && Date.now() - ts < DISMISS_TTL_MS) {
        setDismissedUntil(ts + DISMISS_TTL_MS);
      }
      setLoaded(true);
    });
  }, []);

  // Compute the actual savings from RC offerings in the user's local
  // currency. Previously this was hardcoded as $11/yr — wrong for every
  // non-USD market (KZT, RUB, EUR…) and even wrong for USD if RC prices
  // shift. Falls back to the previous USD $11 hint when offerings
  // haven't loaded yet, so the banner doesn't flash with no number.
  const savingsLabel = useMemo(() => {
    const monthlyId =
      plan === 'organization'
        ? access?.products?.team?.monthly
        : access?.products?.pro?.monthly;
    const yearlyId =
      plan === 'organization'
        ? access?.products?.team?.yearly
        : access?.products?.pro?.yearly;
    const pkgs = offerings?.current?.availablePackages ?? [];
    const monthlyPkg = monthlyId
      ? pkgs.find((p: any) => p.product?.identifier === monthlyId)
      : undefined;
    const yearlyPkg = yearlyId
      ? pkgs.find((p: any) => p.product?.identifier === yearlyId)
      : undefined;
    const real = calcYearlySavings(monthlyPkg, yearlyPkg);
    if (real) {
      return formatMoney(real.amount, real.currency, i18n.language);
    }
    // Sensible fallback — Pro USD monthly $4.99 × 12 − yearly $29.99 ≈ $30
    return formatMoney(30, 'USD', i18n.language);
  }, [plan, access?.products, offerings, i18n.language]);

  useEffect(() => {
    if (loaded && !dismissedUntil) {
      analytics.track('banner_shown', { priority: 'annual_upgrade', plan });
      analytics.track('annual_nudge_shown', { location: 'dashboard' });
    }
  }, [loaded, dismissedUntil, plan]);

  if (!loaded || dismissedUntil) return null;

  const handleTap = () => {
    analytics.track('banner_action_tapped', { priority: 'annual_upgrade', plan });
    analytics.track('annual_nudge_tapped', { location: 'dashboard' });
    router.push('/paywall?prefill=pro-yearly' as any);
  };

  const handleDismiss = () => {
    analytics.track('annual_nudge_dismissed', { location: 'dashboard' });
    AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissedUntil(Date.now() + DISMISS_TTL_MS);
  };

  return (
    <View
      testID="annual_upgrade-banner"
      style={[styles.container, { backgroundColor: isDark ? '#1F2937' : '#F0FDF4', borderColor: '#10B981' }]}
    >
      <TouchableOpacity onPress={handleTap} activeOpacity={0.85} style={styles.inner}>
        <View style={[styles.iconCircle, { backgroundColor: '#10B981' + '20' }]}>
          <Ionicons name="trending-up" size={20} color="#10B981" />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('annual_nudge.title', 'Switch to yearly — save {{savings}}/yr', {
              savings: savingsLabel,
            })}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('annual_nudge.subtitle', 'Same Pro features. Pay once, not every month.')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.closeBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingRight: 32 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 12 },
  closeBtn: { position: 'absolute', top: 8, right: 8, padding: 4 },
});
