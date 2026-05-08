import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// Brand-fixed amber accent that ties this screen visually back to the
// Magic Mail tile in AddSubscriptionSheet. The project's theme rule
// reserves StyleSheet hex literals for #FFF / rgba (per CLAUDE.md);
// this constant sits outside StyleSheet.create and is used inline so
// the rule still holds while keeping a single source of truth — if
// the brand tone changes, swap one literal here and the loader, lock
// badge, and tile all follow. Deliberately not themed: amber reads
// fine in both light and dark backgrounds, and the rest of the
// loader uses theme tokens (text, surface, border) so the contrast
// adapts.
const MAGIC_MAIL_AMBER = '#F59E0B';
import { useTheme } from '../src/theme';
import {
  useGmailStatus,
  useGmailConnect,
  useGmailDisconnect,
  useGmailScan,
} from '../src/hooks/useGmail';
import { useCreateSubscription } from '../src/hooks/useSubscriptions';
import type { GmailScanCandidate, GmailScanResult } from '../src/api/gmail';
import { analytics } from '../src/services/analytics';

/**
 * Gmail bulk-import screen — Pro/Team gated end to end:
 *  1. If not connected: "Connect Gmail" CTA. Opens consent URL in
 *     WebBrowser; backend deep-links us back when done.
 *  2. If connected: shows the linked email + "Scan inbox" CTA.
 *  3. After scan: candidates render in a checkbox list with confidence
 *     badges. User picks which to import → batch creates one
 *     subscription per selected row.
 *  4. "Disconnect" always available; revokes the grant on Google's
 *     side and clears stored tokens.
 *
 * The 402 PRO_PLAN_REQUIRED response from /gmail/scan routes to
 * /paywall so a Free user who somehow lands here (deep link from a
 * shared URL?) gets a clear upgrade path.
 */
export default function GmailImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();

  const status = useGmailStatus();
  const connect = useGmailConnect();
  const disconnect = useGmailDisconnect();
  const scan = useGmailScan();
  const createSub = useCreateSubscription();

  const [candidates, setCandidates] = useState<GmailScanCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  // True when the backend's scan result reports it couldn't read the
  // whole inbox in one go. Render a banner inviting the user to
  // re-scan so they don't think the list below is exhaustive.
  const [truncated, setTruncated] = useState(false);
  // Last successful scan's funnel breakdown. Drives the empty-state
  // copy: `0 candidates` is meaningless without context, but
  // `dropped 1 dup` tells the user "we found something, you already
  // had it" which is a real outcome, not a failure.
  const [scanSummary, setScanSummary] = useState<
    GmailScanResult['summary'] | null
  >(null);
  // Increments per scan attempt. The mutation's resolution checks this
  // against the value it captured at start; if the user kicked off a
  // newer scan in the meantime, the stale resolution is ignored. Without
  // this guard, a slow scan that resolves *after* the user toggled
  // checkboxes would call setSelected(auto) and wipe their manual
  // selections.
  const scanIdRef = useRef(0);

  // Refresh status whenever the screen is focused (covers the case
  // where the user just came back from Google's consent screen).
  useEffect(() => {
    const sub = WebBrowser.maybeCompleteAuthSession();
    return () => {
      // no-op cleanup
      void sub;
    };
  }, []);

  // Clear stale candidates + selection when the user navigates AWAY
  // from this screen. Without this, a partial scan + back-button trip
  // leaves yesterday's candidates in state — when the user returns,
  // the list looks live but the data is from a stale session and the
  // user may import outdated rows.
  //
  // We deliberately do NOT call status.refetch() here: useGmailStatus
  // already declares `refetchOnWindowFocus: true` with a 30 s
  // staleTime, so RQ handles "Gmail disconnect from another tab/
  // device" automatically. Calling refetch() on every focus would
  // bypass the staleTime and burn a network request on every back-
  // and-forth tab switch.
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Bump scanIdRef so any in-flight scan resolution that lands
        // after we leave the screen doesn't repopulate state on a
        // fresh entry.
        scanIdRef.current += 1;
        setCandidates([]);
        setSelected(new Set());
      };
    }, []),
  );

  const handleConnect = useCallback(async () => {
    try {
      analytics.track('gmail.connect.tap');
      const authUrl = await connect.mutateAsync();
      // openAuthSessionAsync intercepts the deep-link redirect and
      // returns control to us once the OAuth dance completes (success
      // OR user cancellation). We then refetch status to confirm.
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'subradar://settings/gmail',
      );
      if (result.type === 'success') {
        analytics.track('gmail.connect.success');
        await status.refetch();
      } else if (result.type === 'cancel') {
        analytics.track('gmail.connect.cancel');
      }
    } catch (err: any) {
      Alert.alert(
        t('gmail.errors.connectTitle', 'Connection failed'),
        err?.message ?? String(err),
      );
    }
  }, [connect, status, t]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      t('gmail.disconnect.title', 'Disconnect Gmail?'),
      t(
        'gmail.disconnect.body',
        'SubRadar will stop scanning your inbox. The grant will be revoked on Google’s side immediately. You can reconnect at any time.',
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('gmail.disconnect.confirm', 'Disconnect'),
          style: 'destructive',
          onPress: async () => {
            analytics.track('gmail.disconnect.confirm');
            await disconnect.mutateAsync();
            setCandidates([]);
            setSelected(new Set());
          },
        },
      ],
    );
  }, [disconnect, t]);

  const handleScan = useCallback(async () => {
    const myScanId = ++scanIdRef.current;
    try {
      analytics.track('gmail.scan.tap');
      setCandidates([]);
      setSelected(new Set());
      setTruncated(false);
      setScanSummary(null);
      const result = await scan.mutateAsync();
      // Bail if a newer scan was started after this one. Without this
      // a slow first scan that finishes after the user toggled some
      // checkboxes from a second scan would clobber their selections.
      if (myScanId !== scanIdRef.current) return;
      analytics.track('gmail.scan.success', {
        scanned: result.scanned,
        candidates: result.candidates.length,
      });
      // Auto-select rule: high-confidence recurring rows AND
      // medium-confidence rows that the catalog enriched (iconUrl set
      // → brand was matched in our catalog → it's almost certainly a
      // real subscription even if the AI's signal was muddier).
      // Cancellations and clearly non-recurring stay unchecked.
      const auto = new Set<string>();
      for (const c of result.candidates) {
        if (!c.isRecurring || c.isCancellation) continue;
        // Parens matter: without them `?? 0 > 0` parses as
        // `?? (0 > 0)` (`>` binds tighter than `??`) which evaluates
        // to `?? false`. The truthy/falsy outcome happened to match
        // intent here but the expression read wrong; spell it out.
        const hasPlans = (c.availablePlans?.length ?? 0) > 0;
        const enriched = !!c.iconUrl || hasPlans;
        if (c.confidence >= 0.7 || (c.confidence >= 0.5 && enriched)) {
          auto.add(c.sourceMessageId);
        }
      }
      setCandidates(result.candidates);
      setSelected(auto);
      setTruncated(!!result.truncated);
      setScanSummary(result.summary ?? null);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'PRO_PLAN_REQUIRED' || err?.response?.status === 402) {
        analytics.track('gmail.scan.paywall');
        router.push('/paywall?feature=magic_mail');
        return;
      }
      // Friendly daily-cap message: backend returns 429 with a structured
      // body { code: 'GMAIL_DAILY_LIMIT', nextResetAt: <iso>, cap }. We
      // localize the "later today / tomorrow" hint based on whether the
      // reset is on the same calendar day as now (in the device's TZ).
      //
      // Gate on the explicit `code` only — the controller also has a
      // per-minute @Throttle(2, 60s) that returns 429 with no `code`
      // field. Without this gate, a user double-tapping Scan would see
      // the daily-limit copy after 2 fast taps, which reads as a paid
      // feature regression.
      if (code === 'GMAIL_DAILY_LIMIT') {
        analytics.track('gmail.scan.rate_limited', {
          code,
        });
        const nextIso = err?.response?.data?.nextResetAt as string | undefined;
        let whenLabel = t('gmail.daily_limit_reset_tomorrow', 'tomorrow');
        if (nextIso) {
          const next = new Date(nextIso);
          const now = new Date();
          if (
            next.getFullYear() === now.getFullYear() &&
            next.getMonth() === now.getMonth() &&
            next.getDate() === now.getDate()
          ) {
            whenLabel = t('gmail.daily_limit_reset_today', 'later today');
          }
        }
        Alert.alert(
          t('gmail.daily_limit_title', 'Daily scan limit reached'),
          t('gmail.daily_limit_body', "You've used all of your scans for today. Try again {{when}}.", {
            when: whenLabel,
          }),
        );
        return;
      }
      Alert.alert(
        t('gmail.errors.scanTitle', 'Scan failed'),
        err?.response?.data?.message ?? err?.message ?? String(err),
      );
    }
  }, [scan, router, t]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    const picked = candidates.filter((c) => selected.has(c.sourceMessageId));
    if (picked.length === 0) return;
    setImporting(true);
    let created = 0;
    let failed = 0;
    // Sequential — keeps backend pressure bounded and gives the
    // server-side advisory lock around free-plan limit a chance to
    // serialise legitimately. Parallel `Promise.all` would fight the
    // lock and waste roundtrips.
    for (const c of picked) {
      try {
        await createSub.mutateAsync({
          name: c.name,
          amount: c.amount,
          currency: c.currency,
          billingPeriod: c.billingPeriod,
          category: c.category,
          status: c.status,
          ...(c.nextPaymentDate ? { nextPaymentDate: c.nextPaymentDate } : {}),
          ...(c.trialEndDate ? { trialEndDate: c.trialEndDate } : {}),
        });
        created++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    analytics.track('gmail.import.complete', { created, failed });
    Alert.alert(
      t('gmail.import.doneTitle', 'Imported'),
      t('gmail.import.doneBody', '{{ok}} added, {{fail}} skipped.', {
        ok: created,
        fail: failed,
      }),
      [
        {
          text: t('common.done', 'Done'),
          onPress: () => router.replace('/(tabs)'),
        },
      ],
    );
  }, [candidates, selected, createSub, router, t]);

  const isLoading = status.isLoading;
  const isConnected = !!status.data?.connected;
  const linkedEmail = status.data?.email ?? null;

  const headerSubtitle = useMemo(() => {
    if (isLoading) return t('gmail.subtitle.loading', 'Checking Gmail…');
    if (!isConnected) {
      return t(
        'gmail.subtitle.disconnected',
        'Connect Gmail to scan your inbox for subscription receipts.',
      );
    }
    return t('gmail.subtitle.connected', 'Connected as {{email}}.', {
      email: linkedEmail ?? '',
    });
  }, [isLoading, isConnected, linkedEmail, t]);

  // Root Stack at app/_layout.tsx is configured with `headerShown: false`,
  // which strips the system back chevron from every pushed screen.
  // Gmail-import is reachable from Settings *and* from the Magic Mail tile
  // in the Add sheet — without an explicit close affordance the user can
  // get stranded here. Render our own back button in the header.
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Hard fallback: deep link from /gmail/callback may land us here
      // with no nav stack to pop.
      router.replace('/(tabs)');
    }
  }, [router]);

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <Stack.Screen options={{ title: t('gmail.title', 'Gmail import') }} />
      <View style={styles.topBar}>
        <TouchableOpacity
          testID="gmail-back"
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.topBarBtn}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
          {t('gmail.title', 'Gmail import')}
        </Text>
        <View style={styles.topBarBtn} />
      </View>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="mail-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('gmail.title', 'Gmail import')}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {headerSubtitle}
        </Text>
      </View>

      {!isConnected && !isLoading && (
        <View style={styles.ctaBlock}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleConnect}
            disabled={connect.isPending}
          >
            {connect.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {t('gmail.cta.connect', 'Connect Gmail')}
              </Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.fineprint, { color: colors.textSecondary }]}>
            {t(
              'gmail.fineprint.connect',
              'SubRadar reads only billing receipts (last 90 days). We never store message bodies.',
            )}
          </Text>
        </View>
      )}

      {isConnected && (
        <View style={styles.connectedBlock}>
          <View style={styles.row}>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                styles.flexBtn,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleScan}
              disabled={scan.isPending || importing}
            >
              {scan.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {t('gmail.cta.scan', 'Scan inbox')}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                { borderColor: colors.border },
              ]}
              onPress={handleDisconnect}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                {t('gmail.cta.disconnect', 'Disconnect')}
              </Text>
            </TouchableOpacity>
          </View>

          {candidates.length === 0 && !scan.isPending && !scanSummary && (
            <Text style={[styles.fineprint, { color: colors.textSecondary }]}>
              {t(
                'gmail.fineprint.scan',
                'Tap “Scan inbox” to find subscriptions. The scan looks at receipts from the last 365 days; older mail is ignored.',
              )}
            </Text>
          )}

          {/* Empty-result hint after a scan: explain WHY there are no
              candidates (all already tracked vs nothing recurring vs
              empty inbox) so the user doesn't read empty list as
              "scan failed". */}
          {candidates.length === 0 && !scan.isPending && scanSummary && (
            <View
              style={[
                loaderStyles.banner,
                {
                  backgroundColor: 'rgba(16,185,129,0.10)',
                  borderColor: '#10B981',
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text
                style={[loaderStyles.bannerText, { color: colors.text }]}
                numberOfLines={3}
              >
                {scanSummary.droppedDup > 0
                  ? t(
                      'gmail.empty.all_tracked',
                      'Found {{n}} subscription(s) — already in your list. Nothing new to import.',
                      { n: scanSummary.droppedDup },
                    )
                  : scanSummary.aiReturned === 0
                    ? t(
                        'gmail.empty.no_recurring',
                        'No recurring subscriptions detected in your last 365 days of receipts.',
                      )
                    : t(
                        'gmail.empty.all_filtered',
                        'No new subscriptions to import.',
                      )}
              </Text>
            </View>
          )}

          {scan.isPending && <ScanLoader />}

          {truncated && !scan.isPending && (
            <View
              style={[
                loaderStyles.banner,
                { backgroundColor: 'rgba(245,158,11,0.10)', borderColor: MAGIC_MAIL_AMBER },
              ]}
            >
              <Ionicons
                name="information-circle"
                size={18}
                color={MAGIC_MAIL_AMBER}
              />
              <Text
                style={[loaderStyles.bannerText, { color: colors.text }]}
                numberOfLines={2}
              >
                {t(
                  'gmail.truncated_banner',
                  'Your inbox had more matches than we could read in one scan. Try scanning again to find the rest.',
                )}
              </Text>
            </View>
          )}

          {candidates.length > 0 && (
            <>
              <Text style={[styles.listHeader, { color: colors.text }]}>
                {t('gmail.list.found', 'Found {{n}} subscriptions', {
                  n: candidates.length,
                })}
              </Text>
              <FlatList
                data={candidates}
                keyExtractor={(c) => c.sourceMessageId}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <CandidateRow
                    item={item}
                    selected={selected.has(item.sourceMessageId)}
                    onToggle={() => toggleSelect(item.sourceMessageId)}
                  />
                )}
              />
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.primary, opacity: selected.size === 0 ? 0.4 : 1 },
                ]}
                onPress={handleImport}
                disabled={selected.size === 0 || importing}
              >
                {importing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {t('gmail.cta.import', 'Import {{n}} selected', {
                      n: selected.size,
                    })}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.privacyLink}
        onPress={() => Linking.openURL('https://subradar.ai/privacy')}
      >
        <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
          {t('gmail.privacyLink', 'How we use Gmail data → Privacy Policy')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/**
 * "Cosmic Inbox Sweep" loader for the Gmail bulk-scan in flight.
 *
 * Visual: an amber sphere with a mail glyph at center pulses softly
 * (1.0 → 1.06 over 1.1 s, native driver). Two concentric rings expand
 * outward in offset waves like a radar sweep, evoking "scanning the
 * inbox." Four small mail-icon satellites orbit at radius 86 px,
 * 6-second rotation, suggesting individual messages being inspected.
 *
 * Below the orb, a stage label crossfades through 5 phases on a
 * timeline calibrated to a typical 25-second scan: connect → list →
 * AI parse → catalog enrichment → finishing. Subtitle gives the
 * user a one-line sense of what's happening so a slow scan feels
 * intentional rather than stuck. A thin amber progress bar caps at
 * 95 % so it never reads "100 % yet still loading" — the actual
 * completion takes over the moment results land.
 *
 * Implementation note: stays on RN's Animated.* + native driver
 * across the board; no Reanimated, no extra deps. The Magic Mail
 * tile uses the same #F59E0B amber accent — keeping that consistent
 * here ties the loader visually back to the entry point and reads as
 * a sibling to the voice hero (which uses the primary color).
 */
function ScanLoader() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const startedAtRef = useRef(Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = (now - startedAtRef.current) / 1000;

  // Stage definitions. `at` is the elapsed-time threshold to enter
  // the stage. The final stage stays sticky once entered so a scan
  // that runs longer than expected doesn't bounce text around.
  const stages = useMemo(
    () => [
      {
        key: 'linking',
        label: t('gmail.scan.stage.linking', 'Linking up'),
        subtitle: t(
          'gmail.scan.stage.linking_sub',
          'Securely connecting to your Gmail',
        ),
      },
      {
        key: 'sifting',
        label: t('gmail.scan.stage.sifting', 'Sifting through receipts'),
        subtitle: t(
          'gmail.scan.stage.sifting_sub',
          'Reading the last year of billing emails',
        ),
      },
      {
        key: 'ai',
        label: t('gmail.scan.stage.ai', 'AI on the case'),
        subtitle: t(
          'gmail.scan.stage.ai_sub',
          'Identifying subscriptions and amounts',
        ),
      },
      {
        key: 'crossref',
        label: t('gmail.scan.stage.crossref', 'Cross-referencing'),
        subtitle: t(
          'gmail.scan.stage.crossref_sub',
          'Matching with our service catalog',
        ),
      },
      {
        key: 'finishing',
        label: t('gmail.scan.stage.finishing', 'Almost there'),
        subtitle: t(
          'gmail.scan.stage.finishing_sub',
          'Polishing your results',
        ),
      },
    ],
    [t],
  );
  const stageIdx =
    elapsed < 2 ? 0 : elapsed < 6 ? 1 : elapsed < 14 ? 2 : elapsed < 22 ? 3 : 4;
  const current = stages[stageIdx];
  const progress = Math.min(0.95, elapsed / 25);

  // Animated values. Persistent across renders via useRef so we
  // don't restart the loops every 250 ms tick.
  const pulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Capture each loop's CompositeAnimation handle so the cleanup
    // function can stop them on unmount. Without explicit .stop(),
    // RN keeps the native-driver animations ticking after the view
    // detaches and the JS-side Animated.Value listeners stay alive
    // until GC — cheap individually but a real leak across many
    // mount/unmount cycles (e.g. user taps Scan twice in a row).
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const ringWave = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const ring1Loop = ringWave(ring1, 0);
    const ring2Loop = ringWave(ring2, 900);

    const orbitLoop = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const loops = [pulseLoop, ring1Loop, ring2Loop, orbitLoop];
    loops.forEach((l) => l.start());
    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [pulse, ring1, ring2, orbit]);

  // Crossfade the stage label whenever stageIdx changes.
  useEffect(() => {
    Animated.sequence([
      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stageIdx, labelOpacity]);

  const orbitRotate = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Satellite envelopes — 4 mail-icon dots orbiting the central orb.
  const satellites = [0, 90, 180, 270].map((angle) => {
    const rad = (angle * Math.PI) / 180;
    const radius = 86;
    return {
      angle,
      left: radius * Math.cos(rad) + 90 - 9,
      top: radius * Math.sin(rad) + 90 - 9,
    };
  });

  return (
    <View style={loaderStyles.wrap}>
      <View style={loaderStyles.orbWrap}>
        {/* Radar rings */}
        {[ring1, ring2].map((v, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 132,
              height: 132,
              borderRadius: 66,
              borderWidth: 2,
              borderColor: MAGIC_MAIL_AMBER,
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.85] }) },
              ],
            }}
          />
        ))}
        {/* Soft outer glow */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 168,
            height: 168,
            borderRadius: 84,
            backgroundColor: MAGIC_MAIL_AMBER,
            opacity: 0.14,
          }}
        />
        {/* Orbiting envelope satellites */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 180,
            height: 180,
            transform: [{ rotate: orbitRotate }],
          }}
        >
          {satellites.map((s) => (
            <View
              key={s.angle}
              style={{
                position: 'absolute',
                left: s.left,
                top: s.top,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: 'rgba(245,158,11,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="mail" size={10} color={MAGIC_MAIL_AMBER} />
            </View>
          ))}
        </Animated.View>
        {/* Central pulsing sphere */}
        <Animated.View
          style={{
            transform: [{ scale: pulse }],
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: MAGIC_MAIL_AMBER,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: MAGIC_MAIL_AMBER,
            shadowOpacity: 0.45,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
            overflow: 'hidden',
          }}
        >
          {/* Highlight smear (top-left) */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 12,
              left: 18,
              width: 22,
              height: 12,
              borderRadius: 11,
              backgroundColor: 'rgba(255,255,255,0.32)',
              transform: [{ rotate: '-25deg' }],
            }}
          />
          <Ionicons name="mail" size={42} color="#FFF" style={{ opacity: 0.97 }} />
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: labelOpacity, alignItems: 'center', marginTop: 24 }}>
        <Text style={[loaderStyles.label, { color: colors.text }]}>
          {current.label}
        </Text>
        <Text style={[loaderStyles.subtitle, { color: colors.textSecondary }]}>
          {current.subtitle}
        </Text>
      </Animated.View>

      <View style={[loaderStyles.bar, { backgroundColor: colors.border }]}>
        <View
          style={{
            height: 3,
            width: `${progress * 100}%`,
            backgroundColor: MAGIC_MAIL_AMBER,
            borderRadius: 2,
          }}
        />
      </View>
    </View>
  );
}

const loaderStyles = StyleSheet.create({
  wrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  orbWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  bar: {
    marginTop: 28,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginHorizontal: 32,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});

function CandidateRow({
  item,
  selected,
  onToggle,
}: {
  item: GmailScanCandidate;
  selected: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lowConfidence = item.confidence < 0.6;
  // Two distinct "amount needs verifying" cases:
  //   - amountFromEmail=false: price came from the catalog (good
  //     guess but not from the user's actual receipt). Show "≈".
  //   - amountIsApproximate: catalog only stored a monthly figure
  //     and we multiplied (12× for YEARLY). Real-world annual prices
  //     usually discount the monthly × 12 by ~15–20%, so this is an
  //     upper bound. Show a stronger "yr est." inline label.
  const amountIsCatalogDefault =
    item.amountFromEmail === false && item.amount > 0;
  const amountIsApproximate = !!item.amountIsApproximate;
  const [iconError, setIconError] = useState(false);
  const showIcon = !!item.iconUrl && !iconError;
  // Letter fallback when no icon URL or the image failed — uses the
  // service's first letter on a neutral pill so the row never renders
  // an empty rectangle.
  const fallbackLetter = (item.name || '?').trim().charAt(0).toUpperCase();
  return (
    <TouchableOpacity onPress={onToggle} style={styles.candidateRow}>
      <View
        style={[
          styles.checkbox,
          {
            borderColor: selected ? colors.primary : colors.border,
            backgroundColor: selected ? colors.primary : 'transparent',
          },
        ]}
      >
        {selected && (
          <Ionicons name="checkmark" size={16} color="#FFF" />
        )}
      </View>
      {showIcon ? (
        <Image
          source={{ uri: item.iconUrl! }}
          style={styles.candidateIcon}
          onError={() => setIconError(true)}
        />
      ) : (
        <View
          style={[
            styles.candidateIcon,
            styles.candidateIconFallback,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.candidateIconLetter, { color: colors.text }]}>
            {fallbackLetter}
          </Text>
        </View>
      )}
      <View style={styles.candidateContent}>
        <View style={styles.candidateLine}>
          <Text style={[styles.candidateName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.candidateAmount, { color: colors.text }]}>
            {item.amount > 0
              ? `${item.currency} ${item.amount.toFixed(2)}`
              : '—'}
          </Text>
        </View>
        <View style={styles.candidateLine}>
          <Text
            style={[styles.candidateMeta, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.category && item.category !== 'OTHER'
              ? `${item.category.toLowerCase()} · `
              : ''}
            {item.billingPeriod.toLowerCase()}
            {item.isTrial ? ' · trial' : ''}
            {item.isCancellation ? ' · cancelled' : ''}
            {item.aggregatedFrom.length > 1
              ? ` · ${item.aggregatedFrom.length} receipts`
              : ''}
          </Text>
          {amountIsApproximate ? (
            <Text
              style={[styles.lowConfBadge, { color: colors.warning ?? MAGIC_MAIL_AMBER }]}
            >
              {t('gmail.approx_label', '≈ est.')}
            </Text>
          ) : amountIsCatalogDefault ? (
            <Text
              style={[styles.lowConfBadge, { color: colors.warning ?? MAGIC_MAIL_AMBER }]}
            >
              ≈
            </Text>
          ) : null}
          {lowConfidence && (
            <Text style={[styles.lowConfBadge, { color: colors.warning ?? MAGIC_MAIL_AMBER }]}>
              ?
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 44,
  },
  topBarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: { padding: 24, alignItems: 'center', gap: 8 },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '600' },
  headerSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  ctaBlock: { paddingHorizontal: 24, gap: 16 },
  connectedBlock: { flex: 1, paddingHorizontal: 24, gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexBtn: { flex: 1 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '500' },
  fineprint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  listHeader: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  listContent: { paddingBottom: 16, gap: 8 },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  candidateIconFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  candidateIconLetter: {
    fontSize: 16,
    fontWeight: '700',
  },
  candidateContent: { flex: 1, gap: 2 },
  candidateLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  candidateName: { fontSize: 16, fontWeight: '500' },
  candidateAmount: { fontSize: 16, fontWeight: '600' },
  candidateMeta: { fontSize: 12 },
  lowConfBadge: { fontSize: 14, fontWeight: '700' },
  privacyLink: { padding: 16, alignItems: 'center' },
  privacyText: { fontSize: 12 },
});
