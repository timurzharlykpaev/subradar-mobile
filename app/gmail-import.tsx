import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
  useGmailScanJob,
} from '../src/hooks/useGmail';
import { useCreateSubscription } from '../src/hooks/useSubscriptions';
import type { GmailScanResult } from '../src/api/gmail';
import { analytics } from '../src/services/analytics';
import { SafeLinearGradient } from '../src/components/SafeLinearGradient';
import { BulkConfirmView } from '../src/components/add-subscription/BulkConfirmView';
import { BulkEditModal } from '../src/components/add-subscription/BulkEditModal';
import type { ParsedSub } from '../src/components/add-subscription/types';
import { subscriptionsApi } from '../src/api/subscriptions';
import { useSubscriptionsStore } from '../src/stores/subscriptionsStore';

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
  // Background scan job (start + poll). Returns the same shape as
  // the old sync hook once the job completes; surface-area for the
  // UI is identical (`scan.status` covers what `isScanInProgress`
  // used to). Critically, the scan keeps running server-side even
  // if the user backgrounds the app — a push notification deep-
  // links them back here with `?jobId=…` and we resume polling.
  const scan = useGmailScanJob();
  const isScanInProgress =
    scan.status === 'pending' || scan.status === 'running';
  const createSub = useCreateSubscription();
  const queryClient = useQueryClient();
  // Deep-link payload from the push notification: when present, we
  // skip the "start a new scan" path and resume polling the existing
  // job that completed while the user was offscreen.
  const searchParams = useLocalSearchParams<{ jobId?: string }>();

  // Single in-screen notice slot. Replaces five separate `Alert.alert`
  // call sites (connect error, scan failed, daily-limit hit, import done,
  // expired-connection auto-disconnect) with a slide-in banner that's
  // visually consistent with the rest of the screen and doesn't yank the
  // user out of context the way a system dialog does.
  type NoticeKind = 'error' | 'warn' | 'success' | 'info';
  interface Notice {
    kind: NoticeKind;
    title: string;
    body?: string;
    actionLabel?: string;
    onAction?: () => void;
  }
  const [notice, setNotice] = useState<Notice | null>(null);
  const [disconnectVisible, setDisconnectVisible] = useState(false);

  // Auto-dismiss success/info notices after 4 s; errors and warnings stick
  // until the user taps × so they don't disappear before being read.
  useEffect(() => {
    if (!notice) return;
    if (notice.kind !== 'success' && notice.kind !== 'info') return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  // Bulk-confirm state — keeps `bulkItems` and `bulkChecked` in
  // lockstep so per-row removals shift both arrays together. The same
  // dual-array pattern AddSubscriptionSheet uses; sharing the shape
  // lets us drop the bespoke FlatList/CandidateRow and reuse
  // BulkConfirmView + BulkEditModal so we get free localised
  // category/period tags, per-row edit + delete, and the
  // icon.horse / DOMAIN_MAP icon fallback.
  const [bulkItems, setBulkItems] = useState<ParsedSub[]>([]);
  const [bulkChecked, setBulkChecked] = useState<boolean[]>([]);
  const [bulkEditIdx, setBulkEditIdx] = useState<number | null>(null);
  const [bulkMoreExpanded, setBulkMoreExpanded] = useState(false);
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
  // Tracks whether at least one scan completed in this screen session.
  // Drives the generic "no new subscriptions" empty state when the
  // backend doesn't ship the `summary` field yet (older deploy).
  const [scanRanOnce, setScanRanOnce] = useState(false);
  // True when the most recent result was served from the backend's
  // 10-min result cache. Surfaces a "Cached" badge next to the
  // result header so the user understands why a 30-second scan just
  // returned in 200ms.
  const [scanFromCache, setScanFromCache] = useState(false);
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
        setBulkItems([]);
        setBulkChecked([]);
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
      setNotice({
        kind: 'error',
        title: t('gmail.errors.connectTitle', 'Connection failed'),
        body: err?.message ?? String(err),
      });
    }
  }, [connect, status, t]);

  const handleDisconnect = useCallback(() => {
    setDisconnectVisible(true);
  }, []);

  const handleDisconnectConfirm = useCallback(async () => {
    analytics.track('gmail.disconnect.confirm');
    setDisconnectVisible(false);
    await disconnect.mutateAsync();
    setBulkItems([]);
    setBulkChecked([]);
  }, [disconnect]);

  const applyScanResult = useCallback(
    (result: GmailScanResult, myScanId: number) => {
      // Bail if a newer scan was started after this one. Without this
      // a slow first scan that finishes after the user toggled some
      // checkboxes from a second scan would clobber their selections.
      if (myScanId !== scanIdRef.current) return;
      analytics.track('gmail.scan.success', {
        scanned: result.scanned,
        candidates: result.candidates.length,
      });
      // Map candidates → the shared ParsedSub shape so we can hand
      // them straight to BulkConfirmView + BulkEditModal (same shape
      // used by voice / screenshot bulk-add). serviceUrl falls back
      // to a `<brand>.com` guess when the catalog didn't enrich the
      // row — the icon.horse + DOMAIN_MAP lookup chain inside
      // BulkConfirmView then surfaces an icon for the long tail of
      // SaaS brands that own their .com (≈90% of real subscriptions).
      const items: ParsedSub[] = result.candidates.map((c) => {
        const cleanedName = (c.name || '').trim();
        const slug = cleanedName
          .toLowerCase()
          .replace(/\+/g, 'plus')
          .replace(/[^a-z0-9]/g, '');
        const fallbackServiceUrl =
          !c.serviceUrl && slug.length >= 2
            ? `https://${slug}.com`
            : undefined;
        return {
          name: cleanedName || undefined,
          amount: c.amount,
          currency: c.currency,
          billingPeriod: c.billingPeriod as ParsedSub['billingPeriod'],
          category: c.category,
          iconUrl: c.iconUrl,
          serviceUrl: c.serviceUrl ?? fallbackServiceUrl,
          cancelUrl: c.cancelUrl,
          nextPaymentDate: c.nextPaymentDate,
          currentPlan: undefined,
        };
      });
      // Auto-check rule (same logic as the previous Set<string>
      // version): high-confidence recurring rows + medium-confidence
      // rows the catalog enriched. Cancellations and clearly
      // non-recurring stay unchecked but visible — the user can
      // toggle them on if our classifier was wrong.
      const checked = result.candidates.map((c) => {
        if (!c.isRecurring || c.isCancellation) return false;
        const hasPlans = (c.availablePlans?.length ?? 0) > 0;
        const enriched = !!c.iconUrl || hasPlans;
        return c.confidence >= 0.7 || (c.confidence >= 0.5 && enriched);
      });
      setBulkItems(items);
      setBulkChecked(checked);
      setTruncated(!!result.truncated);
      setScanSummary(result.summary ?? null);
      setScanFromCache(!!result.cached);
      setScanRanOnce(true);
    },
    [],
  );

  const applyScanError = useCallback(
    async (err: any) => {
      const code = err?.response?.data?.code ?? err?.code;
      const httpStatus = err?.response?.status ?? err?.statusCode;
      if (code === 'PRO_PLAN_REQUIRED' || httpStatus === 402) {
        analytics.track('gmail.scan.paywall');
        router.push('/paywall?feature=magic_mail');
        return;
      }
      // 401 from /gmail/scan means the stored Google refresh token is
      // dead (revoked grant, password change, 6-month inactivity). The
      // server already cleared our tokens on its side — invalidate the
      // status query so the UI flips back to "Connect Gmail" CTA, then
      // surface a friendly notice with a one-tap reconnect action.
      // Without this the user keeps hitting Scan and seeing a generic
      // "scan failed" error with no obvious path forward.
      if (httpStatus === 401) {
        analytics.track('gmail.scan.expired');
        setBulkItems([]);
        setBulkChecked([]);
        await queryClient.invalidateQueries({ queryKey: ['gmail', 'status'] });
        setNotice({
          kind: 'warn',
          title: t(
            'gmail.errors.expiredTitle',
            'Gmail connection expired',
          ),
          body: t(
            'gmail.errors.expiredBody',
            'Your Gmail grant is no longer valid. Reconnect to keep scanning your inbox.',
          ),
          actionLabel: t('gmail.cta.reconnect', 'Reconnect'),
          onAction: () => {
            setNotice(null);
            handleConnect();
          },
        });
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
        analytics.track('gmail.scan.rate_limited', { code });
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
        setNotice({
          kind: 'warn',
          title: t('gmail.daily_limit_title', 'Daily scan limit reached'),
          body: t(
            'gmail.daily_limit_body',
            "You've used all of your scans for today. Try again {{when}}.",
            { when: whenLabel },
          ),
        });
        return;
      }
      setNotice({
        kind: 'error',
        title: t('gmail.errors.scanTitle', 'Scan failed'),
        body:
          err?.response?.data?.message ?? err?.message ?? String(err),
      });
    },
    [router, t, queryClient, handleConnect],
  );

  // Kick off a new background scan. The actual result lands via the
  // useEffect below once the job completes server-side — we don't
  // await it here, so the user can leave the screen / app and a
  // push will bring them back.
  const handleScan = useCallback(
    async (opts?: { force?: boolean }) => {
      scanIdRef.current += 1;
      analytics.track('gmail.scan.tap');
      setBulkItems([]);
      setBulkChecked([]);
      setTruncated(false);
      setScanSummary(null);
      setScanFromCache(false);
      try {
        await scan.start({ force: !!opts?.force });
      } catch (err: any) {
        await applyScanError(err);
      }
    },
    [scan, applyScanError],
  );

  // React to the scan job's terminal state. `applyScanResult` /
  // `applyScanError` keep the same UX as the previous sync flow.
  //
  // The two callbacks are stashed in refs so the effect doesn't
  // re-fire every time one of THEIR transitive dependencies (e.g.
  // useMutation results that get a fresh object on each render)
  // changes identity — without the ref the result-applied effect
  // entered an infinite loop on production: applyScanResult ran,
  // its setCandidates triggered a re-render, applyScanError
  // got a new identity (handleConnect → connect mutation handle),
  // the effect saw new deps and re-ran, looping at ~20 Hz until
  // React bailed with "Maximum update depth exceeded".
  //
  // The fix is to only depend on the SCAN STATE primitives. The
  // callbacks are stable in their behaviour even when their
  // identity flickers.
  const applyResultRef = useRef(applyScanResult);
  const applyErrorRef = useRef(applyScanError);
  useEffect(() => {
    applyResultRef.current = applyScanResult;
  }, [applyScanResult]);
  useEffect(() => {
    applyErrorRef.current = applyScanError;
  }, [applyScanError]);

  // Last-handled marker so we never fire applyScanResult twice for
  // the same job completion (e.g. on a focus refresh that re-runs
  // the effect with identical scan state).
  const lastHandledJobIdRef = useRef<string | null>(null);
  useEffect(() => {
    const jobId = scan.jobId;
    if (!jobId) {
      lastHandledJobIdRef.current = null;
      return;
    }
    if (lastHandledJobIdRef.current === jobId && scan.status !== 'running') {
      // Already dispatched the terminal event for this job.
      return;
    }
    if (scan.status === 'completed' && scan.result) {
      lastHandledJobIdRef.current = jobId;
      applyResultRef.current(scan.result, scanIdRef.current);
    } else if (scan.status === 'failed' && scan.error) {
      lastHandledJobIdRef.current = jobId;
      void applyErrorRef.current(scan.error);
    }
  }, [scan.status, scan.result, scan.error, scan.jobId]);

  // Push-notification deep link: when the backend finishes a scan
  // while the app was backgrounded, the tap on the notification
  // routes here with `?jobId=…`. We resume polling that job so the
  // user lands directly on the review sheet instead of having to
  // re-scan. `scan.resume` is stashed in a ref so the effect
  // doesn't re-fire on every render — same reason as the terminal-
  // state effect above (the spreaded `scan` object gets a fresh
  // identity on each render even when nothing changed).
  const resumeRef = useRef(scan.resume);
  useEffect(() => {
    resumeRef.current = scan.resume;
  }, [scan.resume]);
  useEffect(() => {
    const incomingJobId = Array.isArray(searchParams.jobId)
      ? searchParams.jobId[0]
      : searchParams.jobId;
    if (!incomingJobId) return;
    if (scan.jobId === incomingJobId) return;
    scanIdRef.current += 1;
    resumeRef.current(incomingJobId);
  }, [searchParams.jobId, scan.jobId]);

  // Bulk-confirm row handlers — identical pattern to
  // AddSubscriptionSheet's voice/screenshot flow so BulkConfirmView's
  // contract sees the same shape both places.
  const handleBulkToggle = useCallback((index: number) => {
    setBulkChecked((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }, []);
  const handleBulkEdit = useCallback((index: number) => {
    setBulkEditIdx(index);
  }, []);
  const handleBulkRemove = useCallback((index: number) => {
    setBulkItems((prev) => prev.filter((_, i) => i !== index));
    setBulkChecked((prev) => prev.filter((_, i) => i !== index));
  }, []);
  const handleBulkEditClose = useCallback(() => {
    setBulkEditIdx(null);
    setBulkMoreExpanded(false);
  }, []);
  const updateBulkSub = useCallback(
    (patch: Partial<ParsedSub>) => {
      setBulkItems((prev) => {
        if (bulkEditIdx === null) return prev;
        const next = [...prev];
        next[bulkEditIdx] = { ...next[bulkEditIdx], ...patch };
        return next;
      });
    },
    [bulkEditIdx],
  );
  const deleteBulkSub = useCallback(() => {
    if (bulkEditIdx === null) return;
    const idx = bulkEditIdx;
    setBulkItems((prev) => prev.filter((_, i) => i !== idx));
    setBulkChecked((prev) => prev.filter((_, i) => i !== idx));
    setBulkEditIdx(null);
    setBulkMoreExpanded(false);
  }, [bulkEditIdx]);

  const handleBulkSaveAll = useCallback(async () => {
    const picked = bulkItems.filter((_, i) => bulkChecked[i]);
    if (picked.length === 0) return;
    setImporting(true);
    let created = 0;
    let failed = 0;
    // Sequential — keeps backend pressure bounded and gives the
    // server-side advisory lock around free-plan limit a chance to
    // serialise legitimately. Parallel `Promise.all` would fight the
    // lock and waste roundtrips.
    const VALID_BILLING = [
      'WEEKLY',
      'MONTHLY',
      'QUARTERLY',
      'YEARLY',
      'LIFETIME',
      'ONE_TIME',
    ] as const;
    for (const sub of picked) {
      try {
        const rawBilling = (sub.billingPeriod || 'MONTHLY').toUpperCase();
        const safeBilling = (
          VALID_BILLING.includes(rawBilling as any) ? rawBilling : 'MONTHLY'
        ) as (typeof VALID_BILLING)[number];
        await createSub.mutateAsync({
          name: sub.name || 'Subscription',
          amount: sub.amount ?? 0,
          currency: sub.currency || 'USD',
          billingPeriod: safeBilling,
          category: (sub.category || 'OTHER').toUpperCase(),
          status: sub.isTrial ? 'TRIAL' : 'ACTIVE',
          ...(sub.nextPaymentDate ? { nextPaymentDate: sub.nextPaymentDate } : {}),
          ...(sub.isTrial && sub.trialEndDate
            ? { trialEndDate: sub.trialEndDate }
            : {}),
          ...(sub.serviceUrl ? { serviceUrl: sub.serviceUrl } : {}),
          ...(sub.cancelUrl ? { cancelUrl: sub.cancelUrl } : {}),
          ...(sub.iconUrl ? { iconUrl: sub.iconUrl } : {}),
          ...(sub.currentPlan ? { currentPlan: sub.currentPlan } : {}),
          ...(sub.paymentCardId ? { paymentCardId: sub.paymentCardId } : {}),
          ...(sub.tags && sub.tags.length > 0 ? { tags: sub.tags } : {}),
          ...(sub.color ? { color: sub.color } : {}),
          ...(sub.notes ? { notes: sub.notes } : {}),
          ...(sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0
            ? {
                reminderDaysBefore: sub.reminderDaysBefore,
                reminderEnabled: true,
              }
            : {}),
        });
        created++;
      } catch {
        failed++;
      }
    }
    // Refresh local store so the dashboard reflects the new rows
    // immediately when the user lands back on /(tabs).
    subscriptionsApi
      .getAll({ displayCurrency: undefined })
      .then((r) => {
        useSubscriptionsStore.getState().setSubscriptions(r.data || []);
      })
      .catch(() => {});
    setImporting(false);
    analytics.track('gmail.import.complete', { created, failed });
    setNotice({
      kind:
        created > 0 && failed === 0
          ? 'success'
          : failed > 0
            ? 'warn'
            : 'info',
      title: t('gmail.import.doneTitle', 'Imported'),
      body: t('gmail.import.doneBody', '{{ok}} added, {{fail}} skipped.', {
        ok: created,
        fail: failed,
      }),
    });
    setTimeout(() => router.replace('/(tabs)'), 1200);
  }, [bulkItems, bulkChecked, createSub, router, t]);

  const handleBulkCancel = useCallback(() => {
    // BulkConfirmView's Back button — drop the result list and return
    // to the pre-scan "Scan inbox" state.
    setBulkItems([]);
    setBulkChecked([]);
    setScanRanOnce(false);
    setScanSummary(null);
    setTruncated(false);
    setScanFromCache(false);
    scan.reset();
  }, [scan]);

  const isLoading = status.isLoading;
  const isConnected = !!status.data?.connected;
  const linkedEmail = status.data?.email ?? null;
  // Per-plan daily scan budget. Old backends don't ship this field — when
  // it's missing we silently skip the pill rather than rendering an empty
  // "0 / 0" badge that looks like an error to the user.
  const dailyScans = status.data?.dailyScans ?? null;
  const quotaExhausted = !!(
    dailyScans && dailyScans.cap > 0 && dailyScans.used >= dailyScans.cap
  );

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
      {notice && (
        <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
      )}
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
          {dailyScans && (
            <View
              style={[
                styles.quotaPill,
                {
                  backgroundColor: quotaExhausted
                    ? colors.error + '15'
                    : colors.primary + '12',
                  borderColor: quotaExhausted
                    ? colors.error + '40'
                    : colors.primary + '30',
                },
              ]}
            >
              <Ionicons
                name={quotaExhausted ? 'lock-closed' : 'flash-outline'}
                size={14}
                color={quotaExhausted ? colors.error : colors.primary}
              />
              <Text
                style={[
                  styles.quotaPillText,
                  {
                    color: quotaExhausted ? colors.error : colors.primary,
                  },
                ]}
                numberOfLines={1}
              >
                {quotaExhausted
                  ? t(
                      'gmail.daily_quota.exhausted',
                      'Daily scan limit reached — resets at midnight UTC',
                    )
                  : t('gmail.daily_quota.label', '{{used}} / {{cap}} scans today', {
                      used: dailyScans.used,
                      cap: dailyScans.cap,
                    })}
              </Text>
            </View>
          )}

          <View style={styles.row}>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                styles.flexBtn,
                {
                  backgroundColor: quotaExhausted
                    ? colors.textMuted
                    : colors.primary,
                  opacity: quotaExhausted ? 0.6 : 1,
                },
              ]}
              onPress={() => handleScan()}
              disabled={isScanInProgress || importing || quotaExhausted}
            >
              {isScanInProgress ? (
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

          {bulkItems.length === 0 && !isScanInProgress && !scanRanOnce && (
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
              "scan failed". Falls back to a generic message when the
              backend doesn't ship `summary` yet (old deploy / dev
              behind main). */}
          {bulkItems.length === 0 && !isScanInProgress && scanRanOnce && (
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
                {scanSummary && scanSummary.droppedDup > 0
                  ? t(
                      'gmail.empty.all_tracked',
                      'Found {{n}} subscription(s) — already in your list. Nothing new to import.',
                      { n: scanSummary.droppedDup },
                    )
                  : scanSummary && scanSummary.aiReturned === 0
                    ? t(
                        'gmail.empty.no_recurring',
                        'No recurring subscriptions detected in your last 365 days of receipts.',
                      )
                    : t(
                        'gmail.empty.all_filtered',
                        'No new subscriptions found. Anything we detected was already in your list.',
                      )}
              </Text>
            </View>
          )}

          {isScanInProgress && <ScanLoader progress={scan.progress} />}

          {truncated && !isScanInProgress && (
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

          {bulkItems.length > 0 && (
            <>
              <View style={styles.resultsHeaderRow}>
                <Text style={[styles.listHeader, { color: colors.text }]}>
                  {t('gmail.list.found', 'Found {{n}} subscriptions', {
                    n: bulkItems.length,
                  })}
                </Text>
                {scanFromCache && (
                  <View
                    style={[
                      styles.cachedBadge,
                      { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: MAGIC_MAIL_AMBER },
                    ]}
                  >
                    <Ionicons name="time-outline" size={11} color={MAGIC_MAIL_AMBER} />
                    <Text style={[styles.cachedBadgeText, { color: MAGIC_MAIL_AMBER }]}>
                      {t('gmail.list.cached', 'Cached')}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => handleScan({ force: true })}
                  disabled={isScanInProgress || importing}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.scanAgainBtn}
                >
                  <Ionicons name="refresh" size={14} color={colors.primary} />
                  <Text style={[styles.scanAgainText, { color: colors.primary }]}>
                    {t('gmail.cta.scan_again', 'Scan again')}
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Shared bulk-confirm UI — same as the voice / screenshot
                  add-flow. Brings free localised category + period tags,
                  icon.horse-backed icon fallback, per-row Edit and
                  Delete buttons. The local CandidateRow has been retired. */}
              <View style={{ marginTop: 8 }}>
                <BulkConfirmView
                  items={bulkItems}
                  checked={bulkChecked}
                  saving={importing}
                  onToggle={handleBulkToggle}
                  onEdit={handleBulkEdit}
                  onRemove={handleBulkRemove}
                  onSave={handleBulkSaveAll}
                  onCancel={handleBulkCancel}
                />
              </View>
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

      <DisconnectConfirmSheet
        visible={disconnectVisible}
        onCancel={() => setDisconnectVisible(false)}
        onConfirm={handleDisconnectConfirm}
      />

      <BulkEditModal
        visible={bulkEditIdx !== null}
        sub={bulkEditIdx !== null ? bulkItems[bulkEditIdx] ?? null : null}
        onClose={handleBulkEditClose}
        onUpdate={updateBulkSub}
        onDelete={deleteBulkSub}
        moreExpanded={bulkMoreExpanded}
        setMoreExpanded={setBulkMoreExpanded}
      />
    </SafeAreaView>
  );
}

/**
 * Slide-in banner that replaces the five system `Alert.alert` calls that
 * previously interrupted the Gmail flow with native modals. Lives at the
 * top of the screen so it never overlays the primary CTA; errors and
 * warnings stay until dismissed, success/info auto-fade via the effect
 * in the parent. Optional `actionLabel` + `onAction` render an inline
 * link button — used for the "Reconnect" CTA on the expired-grant path
 * so the user can fix it in one tap without navigating away.
 */
function NoticeBanner({
  notice,
  onClose,
}: {
  notice: {
    kind: 'error' | 'warn' | 'success' | 'info';
    title: string;
    body?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [notice, translateY, opacity]);

  const palette: Record<
    'error' | 'warn' | 'success' | 'info',
    { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap; tint: string }
  > = {
    error: {
      bg: 'rgba(239,68,68,0.10)',
      border: '#EF4444',
      icon: 'alert-circle',
      tint: '#EF4444',
    },
    warn: {
      bg: 'rgba(245,158,11,0.10)',
      border: MAGIC_MAIL_AMBER,
      icon: 'warning',
      tint: MAGIC_MAIL_AMBER,
    },
    success: {
      bg: 'rgba(16,185,129,0.10)',
      border: '#10B981',
      icon: 'checkmark-circle',
      tint: '#10B981',
    },
    info: {
      bg: 'rgba(59,130,246,0.10)',
      border: '#3B82F6',
      icon: 'information-circle',
      tint: '#3B82F6',
    },
  };
  const p = palette[notice.kind];

  return (
    <Animated.View
      style={[
        noticeStyles.banner,
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Ionicons name={p.icon} size={20} color={p.tint} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[noticeStyles.title, { color: colors.text }]} numberOfLines={2}>
          {notice.title}
        </Text>
        {!!notice.body && (
          <Text
            style={[noticeStyles.body, { color: colors.textSecondary }]}
            numberOfLines={3}
          >
            {notice.body}
          </Text>
        )}
        {!!notice.actionLabel && !!notice.onAction && (
          <TouchableOpacity
            onPress={notice.onAction}
            style={noticeStyles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[noticeStyles.actionText, { color: p.tint }]}>
              {notice.actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        onPress={onClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Confirm-disconnect bottom sheet. Replaces the destructive-style
 * system `Alert.alert` that used to ask this question; matches the
 * rest of the screen's visual language and lets the body wrap freely
 * (system Alerts on Android truncate long descriptions).
 */
function DisconnectConfirmSheet({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onCancel}>
        <Pressable
          style={[sheetStyles.card, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={[
              sheetStyles.iconBubble,
              { backgroundColor: 'rgba(239,68,68,0.12)' },
            ]}
          >
            <Ionicons name="unlink-outline" size={28} color="#EF4444" />
          </View>
          <Text style={[sheetStyles.title, { color: colors.text }]}>
            {t('gmail.disconnect.title', 'Disconnect Gmail?')}
          </Text>
          <Text style={[sheetStyles.body, { color: colors.textSecondary }]}>
            {t(
              'gmail.disconnect.body',
              "SubRadar will stop scanning your inbox. The grant will be revoked on Google's side immediately. You can reconnect at any time.",
            )}
          </Text>
          <View style={sheetStyles.row}>
            <TouchableOpacity
              style={[
                sheetStyles.btn,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
              onPress={onCancel}
            >
              <Text style={[sheetStyles.btnText, { color: colors.text }]}>
                {t('common.cancel', 'Cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sheetStyles.btn, { backgroundColor: '#EF4444' }]}
              onPress={onConfirm}
            >
              <Text style={[sheetStyles.btnText, { color: '#FFF' }]}>
                {t('gmail.disconnect.confirm', 'Disconnect')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const noticeStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  actionBtn: { marginTop: 8, alignSelf: 'flex-start' },
  actionText: { fontSize: 13, fontWeight: '700' },
});

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  body: {
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  row: { flexDirection: 'row', gap: 10, width: '100%' },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
});

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
function ScanLoader({
  progress: liveProgress,
}: {
  progress?: import('../src/api/gmail').GmailScanProgress | null;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const startedAtRef = useRef(Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = (now - startedAtRef.current) / 1000;

  // Stage definitions — same five phases the backend now reports.
  // When the server tells us which stage we're in via `liveProgress`
  // we use that directly; otherwise we fall back to the old elapsed-
  // time heuristic so the loader doesn't go blank for the brief
  // window before the first progress update lands.
  const stages = useMemo(
    () => [
      {
        key: 'listing',
        label: t('gmail.scan.stage.linking', 'Linking up'),
        subtitle: t(
          'gmail.scan.stage.linking_sub',
          'Securely connecting to your Gmail',
        ),
      },
      {
        key: 'fetching',
        label: t('gmail.scan.stage.sifting', 'Sifting through receipts'),
        subtitle: t(
          'gmail.scan.stage.sifting_sub',
          'Reading the last year of billing emails',
        ),
      },
      {
        key: 'parsing',
        label: t('gmail.scan.stage.ai', 'AI on the case'),
        subtitle: t(
          'gmail.scan.stage.ai_sub',
          'Identifying subscriptions and amounts',
        ),
      },
      {
        key: 'enriching',
        label: t('gmail.scan.stage.crossref', 'Cross-referencing'),
        subtitle: t(
          'gmail.scan.stage.crossref_sub',
          'Matching with our service catalog',
        ),
      },
      {
        key: 'filtering',
        label: t('gmail.scan.stage.finishing', 'Almost there'),
        subtitle: t(
          'gmail.scan.stage.finishing_sub',
          'Polishing your results',
        ),
      },
    ],
    [t],
  );
  // Prefer the real backend stage when we have one. Falls back to
  // elapsed-time guess for the first ~1-2 s before the first
  // progress poll lands so the orb doesn't render against an
  // empty subtitle.
  const stageKeyToIdx: Record<string, number> = {
    listing: 0,
    fetching: 1,
    parsing: 2,
    enriching: 3,
    filtering: 4,
  };
  const stageIdx = liveProgress
    ? stageKeyToIdx[liveProgress.stage] ?? 0
    : elapsed < 2
      ? 0
      : elapsed < 6
        ? 1
        : elapsed < 14
          ? 2
          : elapsed < 22
            ? 3
            : 4;
  const current = stages[stageIdx];

  // Build a live count line ("123 / 500 emails") when the backend
  // gave us total. Falls through to a blank when only `stage` is
  // known (early in the scan or post-listing transitions).
  const liveCountText = useMemo(() => {
    if (
      liveProgress &&
      typeof liveProgress.current === 'number' &&
      typeof liveProgress.total === 'number' &&
      liveProgress.total > 0
    ) {
      return t(
        'gmail.scan.stage.count',
        '{{current}} / {{total}} emails',
        { current: liveProgress.current, total: liveProgress.total },
      );
    }
    return null;
  }, [liveProgress, t]);

  // True progress when the server told us current/total; otherwise
  // fall back to elapsed-time-against-25s heuristic. Capped at 0.95
  // so the bar never reads "100% but still loading".
  const progress = useMemo(() => {
    if (
      liveProgress &&
      typeof liveProgress.current === 'number' &&
      typeof liveProgress.total === 'number' &&
      liveProgress.total > 0
    ) {
      // Map stage index + within-stage progress onto a single bar.
      // Each stage gets an even slice of the bar (1/5), and we
      // interpolate within the slice based on current/total.
      const stagePortion = 1 / stages.length;
      const within = liveProgress.current / liveProgress.total;
      return Math.min(0.97, stageIdx * stagePortion + within * stagePortion);
    }
    return Math.min(0.95, elapsed / 25);
  }, [liveProgress, stageIdx, stages.length, elapsed]);

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
        {liveCountText && (
          <Text
            style={[
              loaderStyles.subtitle,
              {
                color: colors.text,
                fontWeight: '700',
                marginTop: 4,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {liveCountText}
          </Text>
        )}
      </Animated.View>

      <View style={[loaderStyles.bar, { backgroundColor: colors.border }]}>
        <View
          style={{
            height: 3,
            width: `${progress * 100}%`,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <SafeLinearGradient
            colors={[MAGIC_MAIL_AMBER, '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
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
  quotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  quotaPillText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  listHeader: { fontSize: 14, fontWeight: '600' },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  cachedBadgeText: { fontSize: 11, fontWeight: '700' },
  scanAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  scanAgainText: { fontSize: 13, fontWeight: '700' },
  periodPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  periodPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
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
    gap: 6,
  },
  candidateName: { fontSize: 16, fontWeight: '500' },
  candidateAmount: { fontSize: 16, fontWeight: '600' },
  candidateMeta: { fontSize: 12 },
  lowConfBadge: { fontSize: 14, fontWeight: '700' },
  privacyLink: { padding: 16, alignItems: 'center' },
  privacyText: { fontSize: 12 },
});
