import { useTranslation } from 'react-i18next';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { analytics } from '../services/analytics';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { reportError } from '../utils/errorReporter';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { subscriptionsApi } from '../api/subscriptions';
import { aiApi } from '../api/ai';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { ParsedSub } from './add-subscription/types';
import { SuccessOverlay } from './SuccessOverlay';
import { BulkAddSheet } from './BulkAddSheet';
import type { ConfirmCardData } from './InlineConfirmCard';
import ProFeatureModal from './ProFeatureModal';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { useTheme } from '../theme';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useIsMounted } from '../hooks/useIsMounted';
import { lookupService, lookupServiceWithAI, CatalogEntry } from '../utils/catalogLookup';
import { isBulkInput } from '../utils/clientParser';
import { getPopularServices, CatalogService } from '../services/catalogCache';
import { convertAmount, hasFxRates, refreshFxRates } from '../services/fxCache';
import { prefetchImage } from '../utils/imagePrefetch';
import { resolveIconUrl } from '../utils/iconUrl';
import { translateBackendError } from '../utils/translateBackendError';
import { IdleView, type QuickChipItem } from './add-subscription/IdleView';
import { LoadingView } from './add-subscription/LoadingView';
import { TranscriptionView } from './add-subscription/TranscriptionView';
import { ConfirmView } from './add-subscription/ConfirmView';
import { BulkConfirmView } from './add-subscription/BulkConfirmView';
import { BulkEditModal } from './add-subscription/BulkEditModal';
import { ManualFormView } from './add-subscription/ManualFormView';
import { WizardView } from './add-subscription/WizardView';
import { useAddSubscriptionForm, emptyForm } from './add-subscription/useAddSubscriptionForm';
import type { LoadingStage } from './add-subscription/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ── Flow state machine ──────────────────────────────────────────────────────

type FlowState =
  | 'idle'
  | 'loading'
  | 'transcription'
  | 'confirm'
  | 'bulk-confirm'
  | 'wizard'
  | 'manual'
  | 'success';

export function AddSubscriptionSheet({ visible, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  // Safe-area insets so the bottom of the ScrollView doesn't get
  // clipped by the iPhone home indicator / Android nav bar. Without this
  // the user couldn't reach the Save button on long forms — content
  // visually scrolled past it but the last 30-40px lived under the
  // home indicator gesture zone and weren't tappable.
  const insets = useSafeAreaInsets();
  const access = useEffectiveAccess();
  const subsLimitReached =
    !!access &&
    access.limits.subscriptions.limit !== null &&
    access.limits.subscriptions.used >= access.limits.subscriptions.limit;
  if (__DEV__) {
    const isPro = access?.isPro ?? false;
    const activeCount = access?.limits.subscriptions.used ?? 0;
    const maxSubscriptions =
      access && access.limits.subscriptions.limit !== null
        ? access.limits.subscriptions.limit
        : Infinity;
    console.log('[AddSheet] isPro:', isPro, 'subsLimitReached:', subsLimitReached, 'active:', activeCount, '/', maxSubscriptions);
  }

  // Read displayCurrency early so the form hook can seed `currency` with it
  // on first mount (before resetAll has a chance to run).
  const displayCurrency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');

  // ── Form state (kept for manual mode) ───────────────────────────────────
  // Form slice lives in a dedicated hook. `React.memo(ManualFormView)` does
  // NOT skip per-keystroke renders — `form` changes every keystroke and
  // invalidates the memo. What the memo DOES buy: when the orchestrator
  // re-renders for non-form reasons (visible toggling, useBilling limits
  // refresh, theme, router events), ManualFormView skips its re-render
  // because its setters/saving flag/handlers are stable. `formRef` below
  // keeps `handleSave`'s identity stable too — handleSave doesn't need
  // `form` in its deps, so non-form-related state changes don't churn the
  // save handler prop.
  //
  // `displayCurrency` is captured in useState ONLY on first render — later
  // currency changes don't re-seed. That's fine: first sheet open shows the
  // user's preferred currency, and `resetAll` re-seeds on subsequent opens.
  const formCtx = useAddSubscriptionForm({ ...emptyForm, currency: displayCurrency });
  const formRef = useRef(formCtx.form);
  formRef.current = formCtx.form;
  const [saving, setSaving] = useState(false);
  // Synchronous mutex against double/triple-tap on Save. Setting React state
  // (setSaving) doesn't update savingRef until the next render — between two
  // onPress calls in the same frame there IS no render, so an "is the button
  // already saving?" guard built on state lets all taps through and the user
  // fires N concurrent POST /subscriptions (we saw 3 requests in 290ms in
  // prod logs → first 201, rest 429 ThrottlerException). Write the ref
  // BEFORE setSaving so the very next call to handleSave sees a hot mutex.
  const savingRef = useRef(false);
  const [addedViaSource, setAddedViaSource] = useState<'MANUAL' | 'AI_TEXT' | 'AI_SCREENSHOT'>('MANUAL');
  // Keep frequently-changing values in refs so handlers passed to memoized
  // children (BulkConfirmView, ConfirmView, ManualFormView, BulkEditModal)
  // don't get a new identity every save / toggle / keystroke and defeat
  // their React.memo.
  const addedViaSourceRef = useRef(addedViaSource);
  addedViaSourceRef.current = addedViaSource;

  // ── Unified flow state ──────────────────────────────────────────────────
  const [flowState, _setFlowState] = useState<FlowState>('idle');
  const flowStateRef = React.useRef<FlowState>('idle');
  // Sticky flag: did THIS open-session ever enter a flow whose rendered
  // tree is taller than the sheet's ScrollView? Used by the open-useEffect
  // to decide whether the next open needs a UIScrollView remount to flush
  // stale contentSize. Sticky (not derived from current flowState) because
  // `SuccessOverlay.onFinish` runs resetAll before handleClose, so by the
  // time we reopen, flowStateRef is already 'idle' even though the
  // PREVIOUS session rendered a tall form — and iOS still holds the
  // bloated contentSize.
  const sessionWasTallRef = React.useRef(false);
  const setFlowState = (state: FlowState) => {
    if (__DEV__) console.log('[AddSheet] flowState:', flowStateRef.current, '→', state);
    flowStateRef.current = state;
    if (
      state === 'manual' ||
      state === 'wizard' ||
      state === 'confirm' ||
      state === 'bulk-confirm'
    ) {
      sessionWasTallRef.current = true;
    }
    _setFlowState(state);
  };
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('thinking');
  // Modal gate for Pro-only limits (replaces blocking Alert.alert dialogs)
  const [proGate, setProGate] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [confirmData, setConfirmData] = useState<ConfirmCardData | null>(null);
  const [bulkItems, setBulkItems] = useState<ParsedSub[]>([]);
  const bulkItemsRef = useRef(bulkItems);
  bulkItemsRef.current = bulkItems;
  // `bulkChecked` lives alongside `bulkItems` so it shifts in lockstep when
  // rows are removed mid-array. See handleBulkRemove + the edit-modal delete.
  const [bulkChecked, setBulkChecked] = useState<boolean[]>([]);
  const bulkCheckedRef = useRef(bulkChecked);
  bulkCheckedRef.current = bulkChecked;
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  // ── IdleView seed + remount key ─────────────────────────────────────────
  // Lets the orchestrator seed IdleView's local `smartInput` (e.g., after
  // voice transcription that falls back to idle) and reset it on close.
  // Remount nonce re-initializes IdleView state when key changes.
  const [idleSeed, setIdleSeed] = useState<string>('');
  const [idleKey, setIdleKey] = useState(0);

  // ── ScrollView remount nonce ────────────────────────────────────────────
  // Bumped on every open so the native UIScrollView is torn down and
  // re-created instead of being reused across sessions. Without this, iOS
  // kept the previous session's `contentOffset.y` AND the inflated
  // `contentSize` measured against a tall flow (ManualFormView / WizardView),
  // so the user reopened the sheet, saw the short IdleView at the top, but
  // could still rubber-scroll into empty space below it (the "infinite
  // scroll down" report). Tied to `visible` instead of `idleKey` because
  // resetAll already bumps idleKey for other reasons (transcription
  // fallback) — those paths must not pay the ScrollView remount cost.
  const [scrollNonce, setScrollNonce] = useState(0);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const { addSubscription } = useSubscriptionsStore();
  const { currency } = useSettingsStore();
  const region = useSettingsStore((s) => s.region || 'US');
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const isMounted = useIsMounted();

  useEffect(() => {
    if (visible) {
      // ALWAYS reset to idle on open. The previous version tried to
      // preserve "mid-flow" state across re-renders, but in practice
      // every close path is supposed to end the flow — and the guard's
      // per-flow state checks had a hole: `wizard` / `manual` always
      // passed even when their supporting state (wizardStore /
      // formCtx) was already torn down by a prior swipe / backdrop /
      // app-suspend close path. Result: ScrollView rendered the
      // matching branch with no inner state and the user saw the
      // sheet open with only the title visible, scroll effectively
      // dead because the body had zero content. Unconditional reset
      // eliminates the entire class of bugs and matches the user's
      // mental model (tapping "Add" = fresh start).
      // Read the sticky session flag instead of the current flowState:
      // SuccessOverlay.onFinish runs resetAll before handleClose, so by
      // the time the sheet reopens, flowStateRef.current is back to
      // 'idle' even though the PREVIOUS session rendered a tall form
      // (manual/wizard/etc.) — iOS still holds that bloated contentSize.
      // The sticky ref captures "did any tall flow render at all during
      // the last session" and is reset right after we read it.
      const needsRemount = sessionWasTallRef.current;
      sessionWasTallRef.current = false;
      if (needsRemount) {
        // Dismiss the keyboard BEFORE the remount tears down every
        // TextInput inside the ScrollView. Otherwise the focused input's
        // blur event fires after its host object is gone → Fabric logs
        //   "instanceHandle is null, event of type topBlur will be dropped"
        // and iOS keyboard's RTI session loses its sessionID
        //   "UIEmojiSearchOperations: no valid sessionID"
        // Dismiss-then-remount lets iOS close the session cleanly first.
        Keyboard.dismiss();
      }
      resetAll();
      if (needsRemount) {
        // Force UIScrollView remount so the previous session's
        // contentOffset and (stale) contentSize don't leak into this
        // open. See scrollNonce declaration above for the full rationale.
        setScrollNonce((n) => n + 1);
      }
      backdropOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withTiming(0, { duration: 300 });
      // Load regional catalog when sheet opens
      getPopularServices(region, displayCurrency).then((services) => {
        if (!isMounted.current) return;
        if (services.length > 0) setCatalogServices(services);
      });
      // Warm the FX cache while the user is still scanning chips, so by the
      // time they tap one the cheapest-plan price can be converted into
      // displayCurrency synchronously. Without this, cold-start tap →
      // chip → confirm sees null from convertAmount and falls back to raw
      // USD, while the plan rows below render in KZT (already converted at
      // render time once rates land) — the exact mismatch reported.
      if (!hasFxRates()) {
        refreshFxRates().catch(() => {});
      }
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [visible]);

  // Destructure stable setters so effects/callbacks don't re-fire just
  // because `formCtx` returns a fresh object identity each render.
  const { setForm, setF, setMoreExpanded } = formCtx;

  const resetAll = useCallback(() => {
    setFlowState('idle');
    setTranscribedText('');
    setConfirmData(null);
    setBulkItems([]);
    setBulkChecked([]);
    // Seed form currency from the user's display currency on each reset so
    // manual-mode defaults feel right.
    setForm({ ...emptyForm, currency: displayCurrency });
    setMoreExpanded(false);
    setAddedViaSource('MANUAL');
    // IdleView stays mounted across open/close (sheet uses pointerEvents +
    // translate, not conditional mount). Remount it with an empty seed so
    // its local `smartInput` resets.
    setIdleSeed('');
    setIdleKey((k) => k + 1);
  }, [displayCurrency, setForm, setMoreExpanded]);

  const handleClose = useCallback(() => {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
      runOnJS(onClose)();
    });
    setTimeout(resetAll, 300);
  }, [onClose, resetAll]);

  // Android back button
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (flowState !== 'idle') {
        setFlowState('idle');
        return true;
      }
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, handleClose, flowState]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-20, 20])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 500) {
        // Swipe-down close must go through the same path as the
        // ✕ button — otherwise flowState, confirmData, bulkItems,
        // and form context survive the close, and the NEXT time the
        // sheet opens it renders a stale view (e.g. flowState='wizard'
        // with no bulkItems → blank ScrollView, exactly the "empty
        // modal" symptom users reported).
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
          runOnJS(onClose)();
        });
        runOnJS(resetAll)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0 ? 'auto' as const : 'none' as const,
  }));

  // ── handleSave (manual form) — reads form via ref for stable identity ──
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    if (subsLimitReached) {
      analytics.track('pro_gate_shown', { feature: 'unlimited_subs', source: 'manual_save' });
      setProGate('unlimited_subs');
      return;
    }
    // Read latest form / source from refs so this callback doesn't need
    // `form` / `saving` / `addedViaSource` in deps — keeps handleSave's
    // identity stable across unrelated re-renders so ManualFormView stays
    // memoized.
    const form = formRef.current;
    const source = addedViaSourceRef.current;
    if (!form.name.trim() || !form.amount || parseFloat(form.amount) <= 0) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const iconUrl = resolveIconUrl({ iconUrl: form.iconUrl, serviceUrl: form.serviceUrl });

      const VALID_BILLING = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'ONE_TIME'];
      const rawBilling = (form.billingPeriod || 'MONTHLY').toUpperCase();
      const safeBilling = VALID_BILLING.includes(rawBilling) ? rawBilling : 'MONTHLY';

      const res = await subscriptionsApi.create({
        name: form.name,
        category: (form.category || 'OTHER').toUpperCase(),
        amount: parseFloat(form.amount),
        currency: form.currency,
        billingPeriod: safeBilling,
        billingDay: Math.min(Math.max(parseInt(form.billingDay) || 1, 1), 31),
        status: form.isTrial ? 'TRIAL' : 'ACTIVE',
        paymentCardId: form.paymentCardId || undefined,
        currentPlan: form.currentPlan || undefined,
        serviceUrl: form.serviceUrl || undefined,
        cancelUrl: form.cancelUrl || undefined,
        iconUrl: iconUrl || undefined,
        notes: form.notes || undefined,
        // Always pair status:'TRIAL' with a real trialEndDate. Without
        // it the backend persists TRIAL + null and SubscriptionCard
        // renders neither the trial badge nor the next-payment row
        // because `trialDays === null` short-circuits the trial branch
        // and the trial branch suppresses the next-payment fallback.
        // Default to +7d (matches what the toggle pre-fills) so the
        // user always gets a working trial card even if they cleared
        // the date field by accident.
        trialEndDate: form.isTrial
          ? (form.trialEndDate ||
              new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
          : undefined,
        startDate: form.startDate || undefined,
        nextPaymentDate: form.nextPaymentDate || undefined,
        reminderDaysBefore: form.reminderDaysBefore.length > 0 ? form.reminderDaysBefore : undefined,
        reminderEnabled: form.reminderDaysBefore.length > 0 ? true : undefined,
        color: form.color || undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
        addedVia: source,
      });
      addSubscription(res.data);
      const allSubs = useSubscriptionsStore.getState().subscriptions;
      analytics.subscriptionAdded(
        (form.category || 'OTHER').toLowerCase(),
        parseFloat(form.amount),
        form.currency,
        (form.billingPeriod || 'MONTHLY').toLowerCase(),
        allSubs.length === 0,
        'manual',
      );
      setSuccessName(form.name);
      setShowSuccess(true);
      subscriptionsApi.getAll({ displayCurrency: useSettingsStore.getState().displayCurrency }).then((r) => {
        if (!isMounted.current) return;
        useSubscriptionsStore.getState().setSubscriptions(r.data || []);
      }).catch(() => {});
    } catch (err: any) {
      const errorData = err?.response?.data?.error || err?.response?.data;
      const code = errorData?.code || '';
      const status = err?.response?.status;
      // Only treat 429 as the subscription-cap paywall trigger when the
      // server explicitly tagged it as such. Generic 429 = NestJS throttler
      // (rate-limit on /subscriptions); showing the upgrade modal there is
      // the wrong UX — the user already created the sub on the first POST,
      // the 2nd/3rd are double-tap collisions.
      const isLimitError = code === 'SUBSCRIPTION_LIMIT_REACHED';
      const isRateLimited = status === 429 && !isLimitError;

      if (isLimitError) {
        analytics.track('pro_gate_shown', { feature: 'unlimited_subs', source: 'manual_save_backend' });
        setProGate('unlimited_subs');
      } else if (isRateLimited) {
        Alert.alert(t('common.error'), t('add.rate_limited'));
      } else {
        const msg = typeof errorData === 'string' ? errorData
          : errorData?.message || errorData?.message_key || err?.message || t('add.save_failed');
        Alert.alert(t('common.error'), String(msg));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [subsLimitReached, t, addSubscription]);

  // ── Save from InlineConfirmCard ─────────────────────────────────────────
  // Reads `saving` / `addedViaSource` via refs so the callback identity stays
  // stable across save lifecycle — ConfirmView stays memoized.
  const handleConfirmSave = useCallback(async (data: any) => {
    if (savingRef.current) return;
    if (subsLimitReached) {
      analytics.track('pro_gate_shown', { feature: 'unlimited_subs', source: 'confirm_save' });
      setProGate('unlimited_subs');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setLoadingStage('saving');
    const source = addedViaSourceRef.current;

    try {
    const iconUrl = resolveIconUrl({ iconUrl: data.iconUrl, serviceUrl: data.serviceUrl });

    const VALID_CATEGORIES = ['STREAMING', 'AI_SERVICES', 'INFRASTRUCTURE', 'DEVELOPER', 'PRODUCTIVITY', 'MUSIC', 'GAMING', 'EDUCATION', 'FINANCE', 'DESIGN', 'SECURITY', 'HEALTH', 'SPORT', 'NEWS', 'BUSINESS', 'OTHER'];
    const rawCategory = (data.category || 'OTHER').toUpperCase().replace(/\s+/g, '_');
    const safeCategory = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : 'OTHER';

    const VALID_BILLING = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'ONE_TIME'];
    const rawBillingPeriod = (data.billingPeriod || 'MONTHLY').toUpperCase();
    const safeBillingPeriod = VALID_BILLING.includes(rawBillingPeriod) ? rawBillingPeriod : 'MONTHLY';

    const res = await subscriptionsApi.create({
      name: data.name || 'Subscription',
      category: safeCategory,
      amount: data.amount || 0,
      currency: data.currency || currency || 'USD',
      billingPeriod: safeBillingPeriod,
      billingDay: data.billingDay ? Math.min(Math.max(parseInt(String(data.billingDay)) || 1, 1), 31) : 1,
      status: 'ACTIVE',
      serviceUrl: data.serviceUrl || undefined,
      cancelUrl: data.cancelUrl || undefined,
      iconUrl: iconUrl || undefined,
      currentPlan: data.currentPlan || undefined,
      notes: data.notes || undefined,
      tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : undefined,
      paymentCardId: data.paymentCardId || undefined,
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      nextPaymentDate: data.nextPaymentDate || undefined,
      addedVia: source,
      reminderEnabled: data.reminderEnabled ?? true,
      reminderDaysBefore: data.reminderDaysBefore ?? [3],
    });
    addSubscription(res.data);
    if (res.data.iconUrl) { prefetchImage(res.data.iconUrl); }
    const allSubs = useSubscriptionsStore.getState().subscriptions;
    analytics.subscriptionAdded(
      (data.category || 'OTHER').toLowerCase(),
      data.amount || 0,
      data.currency || currency || 'USD',
      (data.billingPeriod || 'MONTHLY').toLowerCase(),
      allSubs.length === 0,
      source === 'AI_SCREENSHOT' ? 'screenshot' : source === 'AI_TEXT' ? 'ai_lookup' : 'manual',
    );
    setSuccessName(data.name || '');
    setShowSuccess(true);
    subscriptionsApi.getAll({ displayCurrency: useSettingsStore.getState().displayCurrency }).then((r) => {
      if (!isMounted.current) return;
      useSubscriptionsStore.getState().setSubscriptions(r.data || []);
    }).catch(() => {});
    } catch (err: any) {
      const errorData = err?.response?.data?.error || err?.response?.data;
      const code = errorData?.code || '';
      const status = err?.response?.status;
      const isLimitError = code === 'SUBSCRIPTION_LIMIT_REACHED';
      const isRateLimited = status === 429 && !isLimitError;
      if (isLimitError) {
        analytics.track('pro_gate_shown', { feature: 'unlimited_subs', source: 'confirm_save_backend' });
        setProGate('unlimited_subs');
      } else if (isRateLimited) {
        Alert.alert(t('common.error'), t('add.rate_limited'));
      } else {
        Alert.alert(t('common.error'), translateBackendError(t, err) || t('add.save_failed'));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [subsLimitReached, currency, addSubscription, t]);

  // ── Convert CatalogEntry to ConfirmCardData ─────────────────────────────
  // The previous version stamped `currency: displayCurrency` onto the
  // confirm card without touching `amount`, which produced the worst
  // possible mismatch — "20 KZT" instead of either "20 USD" (raw) or
  // "9 267 KZT" (correctly converted). Now we await an FX warm-up if
  // needed and either return the entry already converted into the
  // user's currency, or fall back to the entry's own (raw, USD) values
  // when no FX rate exists. Either way: amount and currency stay in sync.
  const catalogToConfirmData = useCallback(
    async (entry: CatalogEntry): Promise<ConfirmCardData> => {
      const target = (useSettingsStore.getState().displayCurrency || 'USD').toUpperCase();
      const source = (entry.currency || 'USD').toUpperCase();
      if (source !== target && !hasFxRates()) {
        await refreshFxRates();
      }
      const converted =
        source === target
          ? entry.amount
          : convertAmount(entry.amount, source, target);
      const seedAmount = converted ?? entry.amount;
      const seedCurrency = converted == null ? source : target;
      return {
        name: { value: entry.name, confidence: 'high' },
        amount: { value: seedAmount, confidence: seedAmount > 0 ? 'high' : 'low' },
        currency: { value: seedCurrency, confidence: 'high' },
        billingPeriod: { value: entry.billingPeriod, confidence: 'high' },
        category: { value: entry.category || 'OTHER', confidence: 'medium' },
        iconUrl: entry.iconUrl,
        serviceUrl: entry.serviceUrl,
        cancelUrl: entry.cancelUrl,
        plans: entry.plans?.map((p) => ({
          name: p.name,
          priceMonthly: p.amount,
          currency: p.currency,
        })),
      };
    },
    [],
  );

  // ── Smart input submit ──────────────────────────────────────────────────
  const handleSmartSubmit = useCallback(async (text: string) => {
    const input = text.trim();
    if (!input) return;

    Keyboard.dismiss();

    // Check if bulk input
    if (isBulkInput(input)) {
      setAddedViaSource('AI_TEXT');
      setLoadingStage('thinking');
      setFlowState('loading');
      try {
        // Try bulk parse via AI
        const res = await aiApi.parseBulkText(input, i18n.language ?? 'en', displayCurrency, region);
        const data = res.data;
        let subs: ParsedSub[] = [];
        if (Array.isArray(data)) subs = data;
        else if (Array.isArray(data?.subscriptions)) subs = data.subscriptions;
        else if (data && typeof data === 'object' && data.name) subs = [data];
        subs = subs.filter((s: any) => s.name && s.name.trim());

        if (subs.length > 0) {
          setBulkItems(subs);
          setBulkChecked(subs.map(() => true));
          setFlowState('bulk-confirm');
          return;
        }
      } catch (err: any) {
        reportError(`Smart bulk parse error: ${err?.message ?? err}`, err?.stack);
      }
      setFlowState('idle');
      Alert.alert(t('common.error'), t('add.service_not_found'));
      return;
    }

    // Single service lookup
    setAddedViaSource('AI_TEXT');
    setLoadingStage('thinking');
    setFlowState('loading');

    // Step 1: Free lookup (local catalog + backend service-catalog)
    try {
      const entry = await lookupService(input);
      if (entry) {
        setConfirmData(await catalogToConfirmData(entry));
        setFlowState('confirm');
        return;
      }
    } catch {
      // fall through
    }

    // Step 2: AI lookup (1 credit)
    try {
      const result = await lookupServiceWithAI(input, i18n.language ?? 'en', displayCurrency, region);
      if (result.found && result.entry) {
        setConfirmData(await catalogToConfirmData(result.entry));
        setFlowState('confirm');
        return;
      }
      if (result.question) {
        // AI needs more info — fall back to wizard
        setFlowState('wizard');
        return;
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || '';
      const isLimitError = status === 429 || status === 403 || /limit|exceeded|quota/i.test(msg);
      if (isLimitError) {
        setFlowState('idle');
        analytics.track('pro_gate_shown', { feature: 'ai_limit', source: 'smart_input' });
        setProGate('ai_limit');
        return;
      }
    }

    // Nothing found — show wizard as fallback
    setFlowState('wizard');
  }, [i18n.language, displayCurrency, region, t]);

  // ── Quick chip tap ──────────────────────────────────────────────────────
  // Pick the cheapest plan as the default seed and pre-convert it into the
  // user's display currency right here so the headline amount + the plan
  // rows in InlineConfirmCard agree from the first frame. Previously we
  // seeded `currency: chip.currency` (always 'USD' in QUICK_CHIPS) and
  // relied on InlineConfirmCard to FX-convert in its useState initializer
  // — when FX rates weren't warm yet it fell back to the raw USD number,
  // so the user saw "20 USD" up top while plans below showed "9 267 KZT".
  const handleQuickChip = useCallback(async (chip: QuickChipItem) => {
    setAddedViaSource('AI_TEXT');
    const plans = chip.plans;
    const cheapest = plans && plans.length > 0
      ? plans.reduce((min, p) => (p.priceMonthly < min.priceMonthly ? p : min), plans[0])
      : undefined;
    const seedAmount = cheapest?.priceMonthly ?? chip.amount;
    const seedCurrency = (cheapest?.currency ?? chip.currency).toUpperCase();
    const targetCurrency = displayCurrency.toUpperCase();
    // Block the confirm-sheet seed on FX rates being available so the
    // cheapest-plan amount is ALWAYS expressed in the user's display
    // currency. Showing a brief loading screen here is preferable to the
    // alternative — opening the sheet with the headline amount in USD
    // and the plan rows in KZT, which the user reads as a hard bug.
    if (seedCurrency !== targetCurrency && !hasFxRates()) {
      setLoadingStage('thinking');
      setFlowState('loading');
      await refreshFxRates();
    }
    const converted =
      seedCurrency === targetCurrency
        ? seedAmount
        : convertAmount(seedAmount, seedCurrency, targetCurrency);
    const finalAmount = converted ?? seedAmount;
    const finalCurrency = converted == null ? seedCurrency : targetCurrency;
    setConfirmData({
      name: { value: chip.name, confidence: 'high' },
      amount: { value: finalAmount, confidence: 'high' },
      currency: { value: finalCurrency, confidence: 'high' },
      billingPeriod: { value: chip.billingPeriod, confidence: 'high' },
      category: { value: chip.category, confidence: 'high' },
      iconUrl: chip.iconUrl,
      serviceUrl: chip.serviceUrl,
      cancelUrl: chip.cancelUrl,
      plans: plans?.map(p => ({ name: p.name, priceMonthly: p.priceMonthly, currency: p.currency })),
    });
    setFlowState('confirm');
  }, [displayCurrency]);

  // ── Catalog chip tap (from regional catalog) ───────────────────────────
  // Default to the cheapest plan, not service.plans[0] — backend ordering
  // isn't guaranteed and users expect the lowest tier to seed the form.
  // Pre-convert into displayCurrency for the same reason as handleQuickChip.
  const handleCatalogChip = useCallback(async (service: CatalogService) => {
    setAddedViaSource('AI_TEXT');
    const plans = service.plans;
    const cheapest = plans && plans.length > 0
      ? plans.reduce((min, p) => (p.price < min.price ? p : min), plans[0])
      : undefined;
    const seedAmount = cheapest?.price ?? 0;
    const seedCurrency = (cheapest?.currency ?? displayCurrency).toUpperCase();
    const targetCurrency = displayCurrency.toUpperCase();
    if (seedCurrency !== targetCurrency && !hasFxRates()) {
      setLoadingStage('thinking');
      setFlowState('loading');
      await refreshFxRates();
    }
    const converted =
      seedCurrency === targetCurrency
        ? seedAmount
        : convertAmount(seedAmount, seedCurrency, targetCurrency);
    const finalAmount = converted ?? seedAmount;
    const finalCurrency = converted == null ? seedCurrency : targetCurrency;
    setConfirmData({
      name: { value: service.name, confidence: 'high' },
      amount: { value: finalAmount, confidence: 'high' },
      currency: { value: finalCurrency, confidence: 'high' },
      billingPeriod: { value: cheapest?.period ?? 'MONTHLY', confidence: 'high' },
      category: { value: service.category || 'OTHER', confidence: 'high' },
      iconUrl: service.iconUrl,
      plans: plans?.map((p) => ({ name: p.name, priceMonthly: p.price, currency: p.currency })),
    });
    setFlowState('confirm');
  }, [displayCurrency]);

  // ── Voice handler ───────────────────────────────────────────────────────
  const handleVoiceComplete = useCallback(async (uri: string) => {
    if (!uri) return;
    Keyboard.dismiss();
    setAddedViaSource('AI_TEXT');
    setLoadingStage('transcribing');
    setFlowState('loading');
    try {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as const });
      const transcribeRes = await aiApi.parseAudio({ audioBase64, locale: i18n.language ?? 'en', currency: displayCurrency, country: region });
      const text: string = transcribeRes.data?.text ?? '';
      if (!text.trim()) {
        setFlowState('idle');
        Alert.alert(t('ai.voice_error_title'), t('ai.voice_empty'));
        return;
      }
      setTranscribedText(text);
      setFlowState('transcription');
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || '';
      const isLimitError = status === 429 || status === 403 || /limit|exceeded|quota/i.test(msg);
      setFlowState('idle');
      if (isLimitError) {
        analytics.track('pro_gate_shown', { feature: 'ai_limit', source: 'voice' });
        setProGate('ai_limit');
      } else {
        reportError(`Voice error: ${err?.message ?? err}`, err?.stack);
        Alert.alert(t('ai.voice_error_title'), msg || t('ai.voice_error'));
      }
    }
  }, [i18n.language, displayCurrency, region, t]);

  const handleVoiceError = useCallback((reason: 'no_uri' | 'start_failed' | 'stop_failed') => {
    reportError(`Voice recorder error: ${reason}`);
    setFlowState('idle');
    Alert.alert(
      t('ai.voice_error_title', 'Voice Error'),
      reason === 'start_failed'
        ? t('ai.voice_start_failed', 'Could not start recording. Check microphone permission and try again.')
        : t('ai.voice_no_audio', 'Recording failed. Please try again.'),
    );
  }, [t]);
  const { isRecording, durationFmt, start: startRecording, stop: stopRecording } =
    useVoiceRecorder(handleVoiceComplete, handleVoiceError);

  // ── Camera/Screenshot handler ───────────────────────────────────────────
  const handleCamera = useCallback(async () => {
    // Mirror of `add.magic_mail.tap` — without this event the
    // image-vs-mail funnel symmetry collapses to "Magic Mail tapped X
    // times, Magic Image always 0". Fired before the picker opens so it
    // captures intent regardless of whether the user picks an image.
    analytics.track('add.magic_image.tap');
    if (__DEV__) console.log('[Screenshot] Opening image picker...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled) {
      if (__DEV__) console.log('[Screenshot] User cancelled picker');
      return;
    }

    const uri = result.assets[0].uri;
    setAddedViaSource('AI_SCREENSHOT');
    setLoadingStage('analyzing');
    setFlowState('loading');

    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'screenshot.jpg',
      } as any);
      if (__DEV__) console.log('[Screenshot] Sending to API, uri:', uri?.slice(0, 80));
      const res = await aiApi.parseScreenshot(formData, { locale: i18n.language ?? 'en', currency: displayCurrency, country: region });
      if (__DEV__) console.log('[Screenshot] API response:', JSON.stringify(res.data).slice(0, 300));
      const data = res.data;
      const subs = Array.isArray(data) ? data : (data.subscriptions ?? [data]);
      const validSubs = subs.filter((s: any) => s && s.name);

      if (validSubs.length === 0) {
        Alert.alert(t('common.error'), t('add.service_not_found'));
        setFlowState('idle');
        return;
      }

      if (validSubs.length === 1) {
        const s = validSubs[0];
        setConfirmData({
          name: { value: s.name, confidence: 'medium' },
          amount: { value: s.amount || 0, confidence: s.amount ? 'medium' : 'low' },
          currency: { value: s.currency || 'USD', confidence: 'medium' },
          billingPeriod: { value: (s.billingPeriod || 'MONTHLY').toUpperCase(), confidence: 'medium' },
          category: { value: (s.category || 'OTHER').toUpperCase(), confidence: 'medium' },
          iconUrl: s.iconUrl,
          serviceUrl: s.serviceUrl,
          cancelUrl: s.cancelUrl,
        });
        setFlowState('confirm');
      } else {
        if (__DEV__) console.log('[Screenshot] Multiple subs found:', validSubs.length, 'setting bulk-confirm');
        setBulkItems(validSubs);
        setBulkChecked(validSubs.map(() => true));
        setFlowState('bulk-confirm');
      }
    } catch (err: any) {
      if (__DEV__) console.error('[Screenshot] Full error:', JSON.stringify({ status: err?.response?.status, data: err?.response?.data, message: err?.message }));
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || '';
      const isLimitError = status === 429 || status === 403 || /limit|exceeded|quota/i.test(msg);
      setFlowState('idle');
      if (isLimitError) {
        analytics.track('pro_gate_shown', { feature: 'ai_limit', source: 'screenshot' });
        setProGate('ai_limit');
      } else {
        Alert.alert(t('common.error'), msg || t('add.screenshot_parse_error', 'Could not parse the screenshot. Try a clearer image.'));
      }
    }
  }, [t]);

  // Handler: toggle manual form from idle
  const handleManualToggle = useCallback(() => {
    setFlowState('manual');
  }, []);

  // Handler: tap on Magic Mail tile from idle. We *only* commit to a
  // route once `useEffectiveAccess()` has resolved — while it's null
  // (cold-start billing fetch in flight) the tap is a no-op so paying
  // users don't get sent to the paywall during the loading window. This
  // is the same pattern already adopted by the trial-offer fix in
  // 33fcaca: don't make plan-gated decisions on null access.
  // Three-state derivation:
  //   access null  → billing still loading; show unlocked tile but no-op the tap
  //   access free  → locked; render lock badge + route to paywall on tap
  //   access paid  → unlocked; route to /gmail-import on tap
  const isMagicMailLocked = access != null && !access.isPro;

  const handleMagicMail = useCallback(() => {
    if (!access) return;
    if (access.isPro) {
      analytics.track('add.magic_mail.tap');
      onClose?.();
      // expo-router doesn't generate static types for routes that aren't
      // also declared in the typed-routes config; gmail-import is one of
      // them. Cast keeps strict mode happy without losing the runtime
      // path. Same pattern used in app/(tabs)/settings.tsx.
      router.push('/gmail-import' as any);
    } else {
      analytics.track('add.magic_mail.locked_tap');
      onClose?.();
      router.push('/paywall?feature=magic_mail' as any);
    }
  }, [access, router, onClose]);

  // Voice transcription sentinel for LoadingView — lets the "transcribing"
  // step stay visible with a checkmark after we advance to "thinking".
  const hasTranscribedText = transcribedText.length > 0;

  // Transcription confirm handler — seeds IdleView's smart input with the
  // transcribed text BEFORE kicking off the AI lookup, so if handleSmartSubmit
  // falls back to `idle` (credit limit, empty bulk-parse, etc.) the user
  // returns to IdleView with their text preserved and can edit & retry.
  const handleTranscriptionConfirm = useCallback((text: string) => {
    setIdleSeed(text);
    setIdleKey((k) => k + 1);
    handleSmartSubmit(text);
  }, [handleSmartSubmit]);

  const handleBackToIdle = useCallback(() => setFlowState('idle'), []);

  // ── Bulk confirm state (screenshot parsed multiple subscriptions) ────────
  // `bulkChecked` is owned alongside `bulkItems` so removal at index N
  // shifts both arrays in lockstep. Previously the child resynced `checked`
  // by position, which caused the row after the removed one to inherit its
  // slot's checked-state.
  const [bulkSaving, setBulkSaving] = useState(false);
  // Same race-condition pattern as savingRef above: bulk Save All is a
  // potentially long for-loop of POSTs; without a synchronous ref guard a
  // quick double-tap can kick off two concurrent loops over the same items.
  const bulkSavingRef = useRef(false);
  const wizardSavingRef = useRef(false);
  const [bulkEditIdx, setBulkEditIdx] = useState<number | null>(null);
  const [bulkMoreExpanded, setBulkMoreExpanded] = useState(false);

  // Handlers for BulkEditModal — kept at the orchestrator level because
  // the modal only owns its own presentation state, while `bulkItems`
  // and `bulkChecked` need to stay in lockstep across edit / delete.
  const handleBulkEditClose = useCallback(() => {
    setBulkEditIdx(null);
    setBulkMoreExpanded(false);
  }, []);

  const updateBulkSub = useCallback((patch: Partial<ParsedSub>) => {
    setBulkItems((prev) => {
      // Read `bulkEditIdx` from the latest state via functional updater +
      // closure; if the user hit Close mid-edit the idx is null → bail.
      if (bulkEditIdx === null) return prev;
      const next = [...prev];
      next[bulkEditIdx] = { ...next[bulkEditIdx], ...patch };
      return next;
    });
  }, [bulkEditIdx]);

  const deleteBulkSub = useCallback(() => {
    if (bulkEditIdx === null) return;
    const idx = bulkEditIdx;
    setBulkItems((prev) => prev.filter((_, j) => j !== idx));
    setBulkChecked((prev) => prev.filter((_, j) => j !== idx));
    setBulkEditIdx(null);
    setBulkMoreExpanded(false);
  }, [bulkEditIdx]);

  // Reads `bulkItems` / `bulkChecked` / `addedViaSource` via refs — identity
  // stays stable across every row toggle / edit keystroke so BulkConfirmView
  // skips those re-renders.
  const handleBulkSaveAll = useCallback(async () => {
    const items = bulkItemsRef.current;
    const checked = bulkCheckedRef.current;
    const source = addedViaSourceRef.current;
    const selected = items.filter((_, i) => checked[i]);
    const VALID_CATEGORIES = ['STREAMING','AI_SERVICES','INFRASTRUCTURE','DEVELOPER','PRODUCTIVITY','MUSIC','GAMING','EDUCATION','FINANCE','DESIGN','SECURITY','HEALTH','SPORT','NEWS','BUSINESS','OTHER'];
    const VALID_BILLING = ['WEEKLY','MONTHLY','QUARTERLY','YEARLY','LIFETIME','ONE_TIME'];
    if (selected.length === 0) return;
    if (bulkSavingRef.current) return;
    bulkSavingRef.current = true;

    setBulkSaving(true);
    let saved = 0;
    let limitHit = false;
    const failed: string[] = [];
    for (const sub of selected) {
      try {
        const rawCat = (sub.category || 'OTHER').toUpperCase().replace(/\s+/g,'_');
        const rawBill = (sub.billingPeriod || 'MONTHLY').toUpperCase();
        const iconUrl = resolveIconUrl({ iconUrl: sub.iconUrl, serviceUrl: sub.serviceUrl });
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await subscriptionsApi.create({
          name: sub.name || 'Subscription',
          category: VALID_CATEGORIES.includes(rawCat) ? rawCat : 'OTHER',
          amount: sub.amount || 0,
          currency: sub.currency || currency || 'USD',
          billingPeriod: (VALID_BILLING.includes(rawBill) ? rawBill : 'MONTHLY') as any,
          billingDay: sub.billingDay ?? 1,
          status: sub.isTrial ? 'TRIAL' : 'ACTIVE',
          serviceUrl: sub.serviceUrl || undefined,
          cancelUrl: sub.cancelUrl || undefined,
          iconUrl: iconUrl || undefined,
          startDate: sub.startDate || todayStr,
          nextPaymentDate: sub.nextPaymentDate || undefined,
          // Mirror the manual-save guard: always pair TRIAL with a real
          // end date (default +7d) so the card never lands in the broken
          // "status:TRIAL + trialEndDate:null" state where neither the
          // trial badge nor the next-payment row render.
          trialEndDate: sub.isTrial
            ? (sub.trialEndDate ||
                new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
            : undefined,
          notes: sub.notes || undefined,
          reminderDaysBefore: sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0 ? sub.reminderDaysBefore : undefined,
          reminderEnabled: sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0 ? true : undefined,
          // Newly persisted via BulkEditModal — without these the user's
          // bulk-edit changes silently dropped on save.
          tags: sub.tags && sub.tags.length > 0 ? sub.tags : undefined,
          color: sub.color || undefined,
          currentPlan: sub.currentPlan || undefined,
          paymentCardId: sub.paymentCardId || undefined,
          addedVia: source,
        });
        addSubscription(res.data);
        saved++;
      } catch (err: any) {
        const status = err?.response?.status;
        const code = err?.response?.data?.error?.code;
        const msg = err?.response?.data?.message || '';
        // Backend returns 403 + SUBSCRIPTION_LIMIT_REACHED OR (older
        // builds) a generic 403 with "limit/locked" message. Treat
        // both as "user hit free-tier cap" — instead of showing the
        // ugly generic "Some failed" alert, route through the same
        // ProFeatureModal we use elsewhere so the user gets the
        // upgrade CTA.
        const isLimitError =
          code === 'SUBSCRIPTION_LIMIT_REACHED' ||
          status === 403 ||
          /limit|exceeded|quota|locked/i.test(msg);
        if (isLimitError) {
          limitHit = true;
          break;
        }
        failed.push(sub.name || '?');
      }
    }
    subscriptionsApi.getAll({ displayCurrency: useSettingsStore.getState().displayCurrency }).then((r) => {
      useSubscriptionsStore.getState().setSubscriptions(r.data || []);
    }).catch(() => {});
    bulkSavingRef.current = false;
    setBulkSaving(false);

    if (saved > 0) {
      setSuccessName(`${saved} ${t('add.bulk_saved', 'subscriptions')}`);
      setShowSuccess(true);
    }
    if (limitHit) {
      // Wait for success animation if any items were saved before the
      // limit blocked the rest, then open the paywall modal.
      setTimeout(() => {
        analytics.track('pro_gate_shown', {
          feature: 'unlimited_subs',
          source: 'bulk_save',
        });
        setProGate('unlimited_subs');
      }, saved > 0 ? 2500 : 100);
    } else if (failed.length > 0) {
      setTimeout(() => {
        Alert.alert(
          t('add.bulk_partial_title', 'Some failed'),
          t('add.bulk_partial_msg', { names: failed.join(', '), defaultValue: 'Could not add: {{names}}' }),
        );
      }, saved > 0 ? 2500 : 100);
    }
  }, [addSubscription, currency, t]);

  const handleBulkEdit = useCallback((index: number) => {
    setBulkEditIdx(index);
  }, []);

  const handleBulkRemove = useCallback((index: number) => {
    setBulkItems(prev => prev.filter((_, i) => i !== index));
    setBulkChecked(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleBulkToggle = useCallback((index: number) => {
    setBulkChecked(prev => prev.map((v, i) => (i === index ? !v : v)));
  }, []);

  // ── Wizard: AI-clarification fallback handlers ──────────────────────────
  const handleWizardSave = useCallback(async (sub: ParsedSub) => {
    if (wizardSavingRef.current) return;
    wizardSavingRef.current = true;
    try {
    const iconUrl = resolveIconUrl({ iconUrl: sub.iconUrl, serviceUrl: sub.serviceUrl });

    const VALID_CATEGORIES = ['STREAMING', 'AI_SERVICES', 'INFRASTRUCTURE', 'DEVELOPER', 'PRODUCTIVITY', 'MUSIC', 'GAMING', 'EDUCATION', 'FINANCE', 'DESIGN', 'SECURITY', 'HEALTH', 'SPORT', 'NEWS', 'BUSINESS', 'OTHER'];
    const rawCategory = (sub.category || 'OTHER').toUpperCase().replace(/\s+/g, '_');
    const safeCategory = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : 'OTHER';

    const VALID_BILLING = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'ONE_TIME'];
    const rawBillingPeriod = (sub.billingPeriod || 'MONTHLY').toUpperCase();
    const safeBillingPeriod = VALID_BILLING.includes(rawBillingPeriod) ? rawBillingPeriod : 'MONTHLY';

    const res = await subscriptionsApi.create({
      name: sub.name || 'Subscription',
      category: safeCategory,
      amount: sub.amount || 0,
      currency: sub.currency || currency || 'USD',
      billingPeriod: safeBillingPeriod,
      billingDay: sub.billingDay ?? 1,
      status: 'ACTIVE',
      serviceUrl: sub.serviceUrl || undefined,
      cancelUrl: sub.cancelUrl || undefined,
      iconUrl: iconUrl || undefined,
      startDate: sub.startDate || new Date().toISOString().split('T')[0],
      nextPaymentDate: sub.nextPaymentDate || undefined,
      // Wizard previously dropped these — if the AI-clarification step
      // surfaced any of them, keep the data in the persisted sub.
      notes: sub.notes || undefined,
      tags: sub.tags && sub.tags.length > 0 ? sub.tags : undefined,
      color: sub.color || undefined,
      currentPlan: sub.currentPlan || undefined,
      reminderDaysBefore:
        sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0
          ? sub.reminderDaysBefore
          : undefined,
      reminderEnabled:
        sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0
          ? true
          : undefined,
      addedVia: 'AI_TEXT',
    });
    addSubscription(res.data);
    if (res.data.iconUrl) { prefetchImage(res.data.iconUrl); }
    setSuccessName(sub.name || '');
    setShowSuccess(true);
    subscriptionsApi.getAll({ displayCurrency: useSettingsStore.getState().displayCurrency }).then((r) => {
      useSubscriptionsStore.getState().setSubscriptions(r.data || []);
    }).catch(() => {});
    } finally {
      wizardSavingRef.current = false;
    }
  }, [addSubscription, currency]);

  const handleWizardSaveBulk = useCallback(async (subs: ParsedSub[]) => {
    if (wizardSavingRef.current) return;
    wizardSavingRef.current = true;
    const VALID_CATEGORIES = ['STREAMING','AI_SERVICES','INFRASTRUCTURE','DEVELOPER','PRODUCTIVITY','MUSIC','GAMING','EDUCATION','FINANCE','DESIGN','SECURITY','HEALTH','SPORT','NEWS','BUSINESS','OTHER'];
    const VALID_BILLING = ['WEEKLY','MONTHLY','QUARTERLY','YEARLY','LIFETIME','ONE_TIME'];
    let saved = 0;
    const failed: string[] = [];
    try {
    for (const sub of subs) {
      try {
        const rawCat = (sub.category || 'OTHER').toUpperCase().replace(/\s+/g,'_');
        const rawBill = (sub.billingPeriod || 'MONTHLY').toUpperCase();
        const iconUrl = resolveIconUrl({ iconUrl: sub.iconUrl, serviceUrl: sub.serviceUrl });
        const todayStr2 = new Date().toISOString().split('T')[0];
        const res = await subscriptionsApi.create({
          name: sub.name || 'Subscription',
          category: VALID_CATEGORIES.includes(rawCat) ? rawCat : 'OTHER',
          amount: sub.amount || 0,
          currency: sub.currency || currency || 'USD',
          billingPeriod: (VALID_BILLING.includes(rawBill) ? rawBill : 'MONTHLY') as any,
          billingDay: sub.billingDay ?? 1,
          status: 'ACTIVE',
          serviceUrl: sub.serviceUrl || undefined,
          cancelUrl: sub.cancelUrl || undefined,
          iconUrl: iconUrl || undefined,
          startDate: sub.startDate || todayStr2,
          nextPaymentDate: sub.nextPaymentDate || undefined,
          notes: sub.notes || undefined,
          reminderDaysBefore: sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0 ? sub.reminderDaysBefore : undefined,
          reminderEnabled: sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0 ? true : undefined,
          addedVia: 'AI_TEXT',
        });
        addSubscription(res.data);
        saved++;
      } catch (err: any) {
        const code = err?.response?.data?.error?.code;
        if (code === 'SUBSCRIPTION_LIMIT_REACHED') {
          failed.push(...subs.slice(subs.indexOf(sub)).map(s => s.name || '?'));
          break;
        }
        failed.push(sub.name || '?');
      }
    }
    subscriptionsApi.getAll({ displayCurrency: useSettingsStore.getState().displayCurrency }).then((r) => {
      useSubscriptionsStore.getState().setSubscriptions(r.data || []);
    }).catch(() => {});
    if (saved > 0) {
      setSuccessName(`${saved} ${t('add.bulk_saved','subscriptions')}`);
      setShowSuccess(true);
    }
    if (failed.length > 0 && saved === 0) {
      handleClose();
      router.push('/paywall');
    }
    } finally {
      wizardSavingRef.current = false;
    }
  }, [addSubscription, currency, t, handleClose, router]);

  const handleWizardEdit = useCallback((sub: ParsedSub) => {
    setForm((f) => ({
      ...f,
      name: sub.name ?? f.name,
      amount: sub.amount != null ? String(sub.amount) : f.amount,
      currency: sub.currency ?? f.currency,
      billingPeriod: (sub.billingPeriod ?? f.billingPeriod) as typeof f.billingPeriod,
      category: sub.category?.toUpperCase() ?? f.category,
      serviceUrl: sub.serviceUrl ?? f.serviceUrl,
      cancelUrl: sub.cancelUrl ?? f.cancelUrl,
      iconUrl: sub.iconUrl ?? f.iconUrl,
    }));
    setFlowState('manual');
  }, [setForm]);

  const handleWizardBack = useCallback(() => {
    setFlowState('idle');
  }, []);

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <>
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <Reanimated.View style={[styles.backdrop, animatedBackdropStyle]} />
      </TouchableWithoutFeedback>

      <Reanimated.View
        testID="add-sub-sheet"
        style={[styles.sheet, { backgroundColor: colors.surface }, animatedSheetStyle]}
      >
        {/* Drag handle */}
        <GestureDetector gesture={panGesture}>
          <Reanimated.View style={{ paddingTop: 10, paddingBottom: 6, paddingHorizontal: 20, alignItems: 'center' }}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </Reanimated.View>
        </GestureDetector>

        <KeyboardAvoidingView
          // iOS: NO behavior — the ScrollView below has
          // `automaticallyAdjustKeyboardInsets` and the runtime
          // (UIScrollView) handles keyboard avoidance natively. Setting
          // KAV `behavior="padding"` *also* adds bottom padding on top of
          // the ScrollView's inset → content gets pushed up TWICE and
          // disappears above the visible area (the user saw an empty
          // modal). Without a behavior, KAV is just a passive flex wrapper
          // and only the ScrollView shifts.
          // Android: keep `height` — RN doesn't auto-adjust keyboard
          // insets there, so we still need KAV to shrink the container.
          behavior={Platform.OS === 'android' ? 'height' : undefined}
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.title, { color: colors.text }]}>{t('add.title')}</Text>
                <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.primary + '22', flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="sparkles" size={9} color={colors.primary} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.6 }}>AI</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3, letterSpacing: 0.1 }}>
                {t('add.subtitle', 'Voice, photo, mail or manual')}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            key={scrollNonce}
            style={styles.content}
            // Bottom padding = (home-indicator inset) + (40px buffer so the
            // Save button doesn't sit flush against the indicator). The
            // hard-coded `120` previously over-padded on devices without a
            // home indicator and under-padded on Android with system nav.
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 0) + 40 }}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            // Android needs nestedScrollEnabled when the ScrollView is
            // inside a gesture-handled container — otherwise the parent
            // gesture handler can swallow scroll events and the user sees
            // a frozen list.
            nestedScrollEnabled
            scrollEnabled
            showsVerticalScrollIndicator={false}
            // "never": модалка лежит поверх root-view, у которого
            // top safeArea inset = высота статус-бара/чёлки. С "automatic"
            // UIScrollView внутри модалки добавляет этот inset как
            // contentInset.top, начальный contentOffset = -inset, и
            // визуально верх контента (smart-input) уезжает выше видимой
            // области, а скроллить вверх нельзя — упёрлись в логический
            // верх. Высоту хедера/драг-хэндла мы и так считаем сами.
            contentInsetAdjustmentBehavior="never"
          >
            {flowState === 'idle' && (
              <IdleView
                key={idleKey}
                seedSmartInput={idleSeed}
                catalogServices={catalogServices}
                isRecording={isRecording}
                durationFmt={durationFmt}
                onSmartSubmit={handleSmartSubmit}
                onQuickChip={handleQuickChip}
                onCatalogChip={handleCatalogChip}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onCamera={handleCamera}
                onMagicMail={handleMagicMail}
                isMagicMailLocked={isMagicMailLocked}
                onManualToggle={handleManualToggle}
              />
            )}
            {flowState === 'loading' && (
              <LoadingView
                stage={loadingStage}
                source={addedViaSource}
                hasTranscribedText={hasTranscribedText}
                onCancel={handleBackToIdle}
              />
            )}
            {flowState === 'transcription' && (
              <TranscriptionView
                text={transcribedText}
                onConfirm={handleTranscriptionConfirm}
                onCancel={handleBackToIdle}
              />
            )}
            {flowState === 'confirm' && confirmData && (
              <ConfirmView
                data={confirmData}
                onSave={handleConfirmSave}
                onCancel={handleBackToIdle}
                saving={saving}
              />
            )}
            {flowState === 'bulk-confirm' && (
              <BulkConfirmView
                items={bulkItems}
                checked={bulkChecked}
                saving={bulkSaving}
                onToggle={handleBulkToggle}
                onSave={handleBulkSaveAll}
                onEdit={handleBulkEdit}
                onRemove={handleBulkRemove}
                onCancel={handleBackToIdle}
              />
            )}
            {flowState === 'wizard' && (
              <WizardView
                onSave={handleWizardSave}
                onSaveBulk={handleWizardSaveBulk}
                onEdit={handleWizardEdit}
                onBack={handleWizardBack}
              />
            )}
            {flowState === 'manual' && (
              <ManualFormView
                form={formCtx.form}
                setF={setF}
                setForm={setForm}
                moreExpanded={formCtx.moreExpanded}
                setMoreExpanded={setMoreExpanded}
                saving={saving}
                onSave={handleSave}
                onCancel={handleBackToIdle}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        <SuccessOverlay
          visible={showSuccess}
          name={successName}
          onFinish={() => {
            setShowSuccess(false);
            setSuccessName('');
            resetAll();
            handleClose();
          }}
        />
      </Reanimated.View>
    </View>

    <BulkAddSheet
      visible={showBulk}
      onClose={() => setShowBulk(false)}
      onDone={(count) => {
        setShowBulk(false);
        setSuccessName(`${count} ${t('add.bulk_saved', 'subscriptions')}`);
        setShowSuccess(true);
      }}
    />

    {/* ── Full-screen edit modal for bulk items ─────────────────────────── */}
    <BulkEditModal
      visible={bulkEditIdx !== null}
      sub={bulkEditIdx !== null ? bulkItems[bulkEditIdx] ?? null : null}
      onClose={handleBulkEditClose}
      onUpdate={updateBulkSub}
      onDelete={deleteBulkSub}
      moreExpanded={bulkMoreExpanded}
      setMoreExpanded={setBulkMoreExpanded}
      saving={bulkSaving}
    />

    {/* Pro gate modal — replaces Alert.alert for AI quota / subs limit. */}
    <ProFeatureModal
      visible={proGate !== null}
      onClose={() => setProGate(null)}
      feature={proGate ?? 'unlimited_subs'}
    />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.92,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 24,
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: 20 },
});
