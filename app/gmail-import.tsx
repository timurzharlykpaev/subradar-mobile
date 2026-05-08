import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/theme';
import {
  useGmailStatus,
  useGmailConnect,
  useGmailDisconnect,
  useGmailScan,
} from '../src/hooks/useGmail';
import { useCreateSubscription } from '../src/hooks/useSubscriptions';
import type { GmailScanCandidate } from '../src/api/gmail';
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

          {candidates.length === 0 && !scan.isPending && (
            <Text style={[styles.fineprint, { color: colors.textSecondary }]}>
              {t(
                'gmail.fineprint.scan',
                'Tap “Scan inbox” to find subscriptions. The scan looks at receipts from the last 90 days; older mail is ignored.',
              )}
            </Text>
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
  const lowConfidence = item.confidence < 0.6;
  // `amountFromEmail = false` means the price came from the service
  // catalog rather than the receipt itself — surface that as a soft
  // "verify amount" hint so the user double-checks before saving.
  const amountIsCatalogDefault =
    item.amountFromEmail === false && item.amount > 0;
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
          {amountIsCatalogDefault && (
            <Text
              style={[styles.lowConfBadge, { color: colors.warning ?? '#F59E0B' }]}
            >
              ≈
            </Text>
          )}
          {lowConfidence && (
            <Text style={[styles.lowConfBadge, { color: colors.warning ?? '#F59E0B' }]}>
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
