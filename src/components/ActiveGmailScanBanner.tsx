import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeLinearGradient as LinearGradient } from './SafeLinearGradient';
import { useTheme } from '../theme';
import { useActiveGmailScan } from '../hooks/useActiveGmailScan';
import type { GmailScanProgressStage } from '../api/gmail';

const STAGE_LABEL_KEYS: Record<GmailScanProgressStage, string> = {
  listing: 'gmail.scan.stage.linking',
  fetching: 'gmail.scan.stage.sifting',
  parsing: 'gmail.scan.stage.ai',
  enriching: 'gmail.scan.stage.crossref',
  filtering: 'gmail.scan.stage.finishing',
};

/**
 * Dashboard banner that mirrors the in-flight Gmail scan state without
 * requiring the user to be on the gmail-import screen.
 *
 *   running   → indigo gradient, pulsing orb, live "X / Y emails" line,
 *               tap to open the full scan screen
 *   completed → green/success card with checkmark + "Found N — open"
 *   failed    → amber/red error card with retry CTA (routes the user
 *               back to gmail-import so they can hit "Scan again")
 *
 * The banner hides itself entirely when there is no active scan jobId in
 * AsyncStorage. Dismissing the completed/failed banner clears the active
 * pointer so the next visit to gmail-import starts fresh — same semantics
 * as the in-screen Back button.
 */
export function ActiveGmailScanBanner() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const scan = useActiveGmailScan();
  const pulse = useRef(new Animated.Value(0)).current;

  // Subtle breathing pulse on the running-state orb. Native driver, single
  // loop, capture handle for explicit teardown to avoid stranding the
  // Animated.Value listener across unmounts (same pattern as ScanLoader).
  useEffect(() => {
    if (scan.status !== 'pending' && scan.status !== 'running') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scan.status, pulse]);

  const counter = useMemo(() => {
    const p = scan.progress;
    if (!p || typeof p.current !== 'number' || typeof p.total !== 'number') {
      return null;
    }
    if (p.total <= 0) return null;
    return t('gmail.scan.stage.count', '{{current}} / {{total}} emails', {
      current: p.current,
      total: p.total,
    });
  }, [scan.progress, t]);

  if (!scan.isVisible) return null;

  const open = () => router.push('/gmail-import');

  // ── Failed ────────────────────────────────────────────────────────────
  if (scan.status === 'failed') {
    return (
      <View style={styles.outerWrap}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={open}
          style={[
            styles.failedCard,
            { backgroundColor: colors.error + '15', borderColor: colors.error + '40' },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.error + '20' }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {t('gmail.banner.failed_title', 'Gmail scan failed')}
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {t('gmail.banner.failed_sub', 'Tap to retry')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={scan.dismiss}
            hitSlop={10}
            accessibilityLabel={t('common.dismiss', 'Dismiss')}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────
  if (scan.status === 'completed') {
    const hasResults = scan.candidateCount > 0;
    return (
      <View style={styles.outerWrap}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={open}
          style={[
            styles.completedCard,
            {
              backgroundColor: hasResults ? colors.success + '12' : colors.card,
              borderColor: hasResults ? colors.success + '40' : colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: hasResults ? colors.success + '22' : colors.textMuted + '20' },
            ]}
          >
            <Ionicons
              name={hasResults ? 'checkmark-circle' : 'mail-open-outline'}
              size={20}
              color={hasResults ? colors.success : colors.textSecondary}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {t('gmail.banner.completed_title', 'Gmail scan ready')}
            </Text>
            <Text
              style={[styles.subtitle, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {hasResults
                ? t('gmail.banner.completed_sub', 'Found {{count}} — tap to review', {
                    count: scan.candidateCount,
                  })
                : t('gmail.banner.completed_empty', 'No new subscriptions found')}
            </Text>
          </View>
          {hasResults ? (
            <View
              style={[
                styles.openPill,
                { backgroundColor: colors.success + '20' },
              ]}
            >
              <Text style={[styles.openPillText, { color: colors.success }]}>
                {t('gmail.banner.open', 'Open')}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={colors.success} />
            </View>
          ) : (
            <TouchableOpacity
              onPress={scan.dismiss}
              hitSlop={10}
              accessibilityLabel={t('common.dismiss', 'Dismiss')}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Pending / Running ─────────────────────────────────────────────────
  const stageKey = scan.progress?.stage
    ? STAGE_LABEL_KEYS[scan.progress.stage]
    : 'gmail.scan.stage.sifting';
  const stageLabel = t(stageKey, 'Scanning inbox');

  // Two animated values derived from the same loop so the orb glows in
  // sync with a fainter ring outside it. interpolate() is fine on the
  // native driver because both are pure opacity/transform.
  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const orbOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  return (
    <View style={styles.outerWrap}>
      <TouchableOpacity activeOpacity={0.9} onPress={open}>
        <LinearGradient
          colors={['#6C47FF', '#4A2FB0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.runningCard}
        >
          <View style={styles.runningOrb}>
            <Animated.View
              style={[
                styles.orbRing,
                { transform: [{ scale: ringScale }], opacity: ringOpacity },
              ]}
            />
            <Animated.View
              style={[
                styles.orbCore,
                {
                  transform: [{ scale: orbScale }],
                  opacity: orbOpacity,
                },
              ]}
            >
              <Ionicons name="mail" size={16} color="#FFF" />
            </Animated.View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.runningTitle} numberOfLines={1}>
              {t('gmail.banner.running_title', 'Scanning your inbox')}
            </Text>
            <Text style={styles.runningSubtitle} numberOfLines={1}>
              {counter ?? stageLabel}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.85)" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: { marginHorizontal: 20, marginTop: 8 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },

  // Running
  runningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    shadowColor: '#6C47FF',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: 'hidden',
  },
  runningOrb: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbCore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  orbRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  runningTitle: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  runningSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  // Completed
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  openPillText: { fontSize: 12, fontWeight: '800' },

  // Failed
  failedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
});
