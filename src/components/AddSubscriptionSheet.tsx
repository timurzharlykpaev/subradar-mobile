import { useTranslation } from 'react-i18next';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { analytics } from '../services/analytics';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Animated,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ActivityIndicator,
  Switch,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
import { CATEGORIES, CURRENCIES, BILLING_PERIODS } from '../constants';
import { subscriptionsApi } from '../api/subscriptions';
import { aiApi } from '../api/ai';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { AIWizard, ParsedSub } from './AIWizard';
import { SuccessOverlay } from './SuccessOverlay';
import { BulkAddSheet } from './BulkAddSheet';
import { TranscriptionConfirm } from './TranscriptionConfirm';
import { InlineConfirmCard, ConfirmCardData } from './InlineConfirmCard';
import ProFeatureModal from './ProFeatureModal';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { useTheme } from '../theme';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useIsMounted } from '../hooks/useIsMounted';
import { lookupService, lookupServiceWithAI, CatalogEntry } from '../utils/catalogLookup';
import { isBulkInput, splitBulkInput, extractPrice } from '../utils/clientParser';
import { GiftIcon } from './icons';
import { formatMoney } from '../utils/formatMoney';
import { getPopularServices, CatalogService } from '../services/catalogCache';
import { convertAmount } from '../services/fxCache';
import { DatePickerField } from './DatePickerField';
import { NumericInput } from './NumericInput';
import { prefetchImage } from '../utils/imagePrefetch';
import { translateBackendError } from '../utils/translateBackendError';
import { IdleView, type QuickChipItem } from './add-subscription/IdleView';

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

const emptyForm = {
  name: '',
  category: 'STREAMING',
  amount: '',
  currency: 'USD' as string,
  billingPeriod: 'MONTHLY' as const,
  billingDay: '1',
  paymentCardId: '',
  currentPlan: '',
  serviceUrl: '',
  cancelUrl: '',
  notes: '',
  iconUrl: '',
  isTrial: false,
  trialEndDate: '',
  startDate: new Date().toISOString().split('T')[0],
  nextPaymentDate: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0]; })(),
  reminderDaysBefore: [3] as number[],
  color: '' as string,
  tags: [] as string[],
};

export function AddSubscriptionSheet({ visible, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const access = useEffectiveAccess();
  const isPro = access?.isPro ?? false;
  const isProUser = access?.plan === 'pro';
  const activeCount = access?.limits.subscriptions.used ?? 0;
  const maxSubscriptions =
    access && access.limits.subscriptions.limit !== null
      ? access.limits.subscriptions.limit
      : Infinity;
  const subsLimitReached =
    !!access &&
    access.limits.subscriptions.limit !== null &&
    access.limits.subscriptions.used >= access.limits.subscriptions.limit;
  if (__DEV__) console.log('[AddSheet] isPro:', isPro, 'subsLimitReached:', subsLimitReached, 'active:', activeCount, '/', maxSubscriptions);

  // ── Form state (kept for manual mode) ───────────────────────────────────
  const [form, setForm] = useState(emptyForm);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addedViaSource, setAddedViaSource] = useState<'MANUAL' | 'AI_TEXT' | 'AI_SCREENSHOT'>('MANUAL');

  // ── Unified flow state ──────────────────────────────────────────────────
  const [flowState, _setFlowState] = useState<FlowState>('idle');
  const flowStateRef = React.useRef<FlowState>('idle');
  const setFlowState = (state: FlowState) => {
    if (__DEV__) console.log('[AddSheet] flowState:', flowStateRef.current, '→', state);
    flowStateRef.current = state;
    _setFlowState(state);
  };
  type LoadingStage = 'transcribing' | 'analyzing' | 'thinking' | 'saving';
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('thinking');
  // Modal gate for Pro-only limits (replaces blocking Alert.alert dialogs)
  const [proGate, setProGate] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [confirmData, setConfirmData] = useState<ConfirmCardData | null>(null);
  const [bulkItems, setBulkItems] = useState<ParsedSub[]>([]);
  const [manualExpanded, setManualExpanded] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  // ── IdleView seed + remount key ─────────────────────────────────────────
  // Lets the orchestrator seed IdleView's local `smartInput` (e.g., after
  // voice transcription that falls back to idle) and reset it on close.
  // Remount nonce re-initializes IdleView state when key changes.
  const [idleSeed, setIdleSeed] = useState<string>('');
  const [idleKey, setIdleKey] = useState(0);

  // ── Screenshot state ────────────────────────────────────────────────────
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [parsingScreenshot, setParsingScreenshot] = useState(false);

  // ── Legacy states kept for AIWizard integration ─────────────────────────
  const [foundService, setFoundService] = useState<any>(null);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const { addSubscription } = useSubscriptionsStore();
  const { cards } = usePaymentCardsStore();
  const { currency } = useSettingsStore();
  const displayCurrency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');
  const region = useSettingsStore((s) => s.region || 'US');
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const isMounted = useIsMounted();

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withTiming(0, { duration: 300 });
      // Load regional catalog when sheet opens
      getPopularServices(region, displayCurrency).then((services) => {
        if (!isMounted.current) return;
        if (services.length > 0) setCatalogServices(services);
      });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [visible]);

  const resetAll = useCallback(() => {
    setFlowState('idle');
    setTranscribedText('');
    setConfirmData(null);
    setBulkItems([]);
    setManualExpanded(false);
    setForm({ ...emptyForm, currency: displayCurrency });
    setScreenshotUri(null);
    setMoreExpanded(false);
    setAddedViaSource('MANUAL');
    setFoundService(null);
    // IdleView stays mounted across open/close (sheet uses pointerEvents +
    // translate, not conditional mount). Remount it with an empty seed so
    // its local `smartInput` resets.
    setIdleSeed('');
    setIdleKey((k) => k + 1);
  }, []);

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
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
          runOnJS(onClose)();
        });
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

  const setF = useCallback((key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  // ── handleSave (manual form) — KEPT AS-IS ──────────────────────────────
  const handleSave = useCallback(async () => {
    if (saving) return;
    if (subsLimitReached) {
      analytics.track('pro_gate_shown', { feature: 'unlimited_subs', source: 'manual_save' });
      setProGate('unlimited_subs');
      return;
    }
    if (!form.name.trim() || !form.amount || parseFloat(form.amount) <= 0) {
      return;
    }
    setSaving(true);
    try {
      let iconUrl = form.iconUrl;
      if (!iconUrl && form.serviceUrl) {
        try {
          const host = new URL(form.serviceUrl).hostname;
          iconUrl = `https://icon.horse/icon/${host}`;
        } catch {}
      }
      if (!iconUrl && form.name) {
        const slug = form.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        iconUrl = `https://icon.horse/icon/${slug}.com`;
      }

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
        trialEndDate: form.isTrial && form.trialEndDate ? form.trialEndDate : undefined,
        startDate: form.startDate || undefined,
        nextPaymentDate: form.nextPaymentDate || undefined,
        reminderDaysBefore: form.reminderDaysBefore.length > 0 ? form.reminderDaysBefore : undefined,
        reminderEnabled: form.reminderDaysBefore.length > 0 ? true : undefined,
        color: form.color || undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
        addedVia: addedViaSource,
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
      const isLimitError = code === 'SUBSCRIPTION_LIMIT_REACHED' || err?.response?.status === 429;

      if (isLimitError) {
        analytics.track('pro_gate_shown', { feature: 'unlimited_subs', source: 'manual_save_backend' });
        setProGate('unlimited_subs');
      } else {
        const msg = typeof errorData === 'string' ? errorData
          : errorData?.message || errorData?.message_key || err?.message || t('add.save_failed');
        Alert.alert(t('common.error'), String(msg));
      }
    } finally {
      setSaving(false);
    }
  }, [form, handleClose, subsLimitReached, onClose, router, t, addSubscription, saving, addedViaSource]);

  // ── Save from InlineConfirmCard ─────────────────────────────────────────
  const handleConfirmSave = useCallback(async (data: any) => {
    if (saving) return;
    if (subsLimitReached) {
      analytics.track('pro_gate_shown', { feature: 'unlimited_subs', source: 'confirm_save' });
      setProGate('unlimited_subs');
      return;
    }
    setSaving(true);
    setLoadingStage('saving');

    try {
    const iconUrl = data.iconUrl || (data.serviceUrl
      ? `https://icon.horse/icon/${(() => { try { return new URL(data.serviceUrl).hostname; } catch { return ''; } })()}`
      : data.name
        ? `https://icon.horse/icon/${data.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`
        : undefined);

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
      addedVia: addedViaSource,
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
      addedViaSource === 'AI_SCREENSHOT' ? 'screenshot' : addedViaSource === 'AI_TEXT' ? 'ai_lookup' : 'manual',
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
      const isLimitError = code === 'SUBSCRIPTION_LIMIT_REACHED' || err?.response?.status === 429;
      if (isLimitError) {
        analytics.track('pro_gate_shown', { feature: 'unlimited_subs', source: 'confirm_save_backend' });
        setProGate('unlimited_subs');
      } else {
        Alert.alert(t('common.error'), translateBackendError(t, err) || t('add.save_failed'));
      }
    } finally {
      setSaving(false);
    }
  }, [saving, subsLimitReached, onClose, router, currency, addSubscription, addedViaSource, t]);

  // ── Convert CatalogEntry to ConfirmCardData ─────────────────────────────
  const catalogToConfirmData = (entry: CatalogEntry): ConfirmCardData => ({
    name: { value: entry.name, confidence: 'high' },
    amount: { value: entry.amount, confidence: entry.amount > 0 ? 'high' : 'low' },
    currency: { value: useSettingsStore.getState().displayCurrency || entry.currency, confidence: 'high' },
    billingPeriod: { value: entry.billingPeriod, confidence: 'high' },
    category: { value: entry.category || 'OTHER', confidence: 'medium' },
    iconUrl: entry.iconUrl,
    serviceUrl: entry.serviceUrl,
    cancelUrl: entry.cancelUrl,
    plans: entry.plans?.map(p => ({ name: p.name, priceMonthly: p.amount, currency: p.currency })),
  });

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
        setConfirmData(catalogToConfirmData(entry));
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
        setConfirmData(catalogToConfirmData(result.entry));
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
  const handleQuickChip = useCallback((chip: QuickChipItem) => {
    setAddedViaSource('AI_TEXT');
    setConfirmData({
      name: { value: chip.name, confidence: 'high' },
      amount: { value: chip.amount, confidence: 'high' },
      currency: { value: displayCurrency, confidence: 'high' },
      billingPeriod: { value: chip.billingPeriod, confidence: 'high' },
      category: { value: chip.category, confidence: 'high' },
      iconUrl: chip.iconUrl,
      serviceUrl: chip.serviceUrl,
      cancelUrl: chip.cancelUrl,
      plans: chip.plans?.map(p => ({ name: p.name, priceMonthly: p.priceMonthly, currency: p.currency })),
    });
    setFlowState('confirm');
  }, [displayCurrency]);

  // ── Catalog chip tap (from regional catalog) ───────────────────────────
  const handleCatalogChip = useCallback((service: CatalogService) => {
    setAddedViaSource('AI_TEXT');
    const defaultPlan = service.plans?.[0];
    setConfirmData({
      name: { value: service.name, confidence: 'high' },
      amount: { value: defaultPlan?.price ?? 0, confidence: 'high' },
      currency: { value: defaultPlan?.currency ?? displayCurrency, confidence: 'high' },
      billingPeriod: { value: defaultPlan?.period ?? 'MONTHLY', confidence: 'high' },
      category: { value: service.category || 'OTHER', confidence: 'high' },
      iconUrl: service.iconUrl,
      plans: service.plans?.map((p) => ({ name: p.name, priceMonthly: p.price, currency: p.currency })),
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
    setScreenshotUri(uri);
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

  // ── Edit from confirm → manual ──────────────────────────────────────────
  // Перенеси ВСЁ что AI мог заполнить (включая tags/notes/card/dates) — иначе
  // в Edit эти поля выглядят пустыми по сравнению с ручной формой.
  const handleEditFromConfirm = useCallback((data: any) => {
    setForm(f => ({
      ...f,
      name: data.name?.value ?? data.name ?? f.name,
      amount: data.amount?.value != null ? String(data.amount.value) : (data.amount != null ? String(data.amount) : f.amount),
      currency: data.currency?.value ?? data.currency ?? f.currency,
      billingPeriod: (data.billingPeriod?.value ?? data.billingPeriod ?? f.billingPeriod) as typeof f.billingPeriod,
      category: (data.category?.value ?? data.category ?? f.category).toUpperCase(),
      serviceUrl: data.serviceUrl ?? f.serviceUrl,
      cancelUrl: data.cancelUrl ?? f.cancelUrl,
      iconUrl: data.iconUrl ?? f.iconUrl,
      currentPlan: data.currentPlan ?? f.currentPlan,
      notes: data.notes ?? f.notes,
      tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : f.tags,
      paymentCardId: data.paymentCardId ?? f.paymentCardId,
      startDate: data.startDate ?? f.startDate,
      nextPaymentDate: data.nextPaymentDate ?? f.nextPaymentDate,
      billingDay: data.billingDay != null ? String(data.billingDay) : f.billingDay,
      reminderDaysBefore: Array.isArray(data.reminderDaysBefore) ? data.reminderDaysBefore : f.reminderDaysBefore,
      color: data.color ?? f.color,
      isTrial: data.status === 'TRIAL' ? true : f.isTrial,
      trialEndDate: data.trialEndDate ?? f.trialEndDate,
    }));
    setManualExpanded(true);
    setFlowState('manual');
  }, []);

  // Shared input style
  const inputStyle = {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    letterSpacing: 0,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  };

  // Handler: toggle manual form from idle
  const handleManualToggle = useCallback(() => {
    setManualExpanded(true);
    setFlowState('manual');
  }, []);

  // ── Render: loading with progressive stages ─────────────────────────────
  // Stage order — based on source, so once voice transcription is complete the
  // user still sees "transcribed ✓" when we return to "thinking" after their
  // edit-and-confirm step.
  const voiceHadTranscribe = addedViaSource === 'AI_TEXT' && (loadingStage === 'transcribing' || transcribedText);
  const stageOrder: LoadingStage[] = voiceHadTranscribe
    ? ['transcribing', 'thinking', 'saving']
    : addedViaSource === 'AI_SCREENSHOT'
    ? ['analyzing', 'thinking', 'saving']
    : ['thinking', 'saving'];
  const currentIdx = Math.max(stageOrder.indexOf(loadingStage), 0);
  const stageLabel = (s: LoadingStage) => ({
    transcribing: t('add.stage_transcribing', 'Transcribing voice'),
    analyzing:    t('add.stage_analyzing', 'Analyzing image'),
    thinking:     t('add.stage_thinking', 'AI looking up service'),
    saving:       t('add.stage_saving', 'Saving subscription'),
  }[s]);

  const renderLoading = () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
        {stageLabel(loadingStage)}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, marginBottom: 24 }}>
        {t('add.loading_hint', 'AI is processing your request. This usually takes a few seconds.')}
      </Text>

      {/* Progressive steps — shows all stages, ticks off completed ones */}
      <View style={{ gap: 10, alignSelf: 'stretch', paddingHorizontal: 32 }}>
        {stageOrder.map((s, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const pending = idx > currentIdx;
          const iconName = done ? 'checkmark-circle' : active ? 'ellipsis-horizontal-circle' : 'ellipse-outline';
          const iconColor = done ? '#22C55E' : active ? colors.primary : colors.textMuted;
          return (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={iconName as any} size={20} color={iconColor} />
              <Text style={{
                color: active ? colors.text : pending ? colors.textMuted : colors.textSecondary,
                fontSize: 14,
                fontWeight: active ? '700' : '500',
              }}>
                {stageLabel(s)}
              </Text>
              {active && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />}
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={() => setFlowState('idle')}
        style={{ marginTop: 28, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.surface2 }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
          {t('common.cancel', 'Cancel')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Render: transcription confirm ───────────────────────────────────────
  const renderTranscription = () => (
    <TranscriptionConfirm
      text={transcribedText}
      onConfirm={(text) => {
        // Seed IdleView's smart input with the transcribed text BEFORE
        // kicking off the AI lookup — if handleSmartSubmit falls back to
        // `idle` (credit limit, empty bulk-parse, etc.), the user returns
        // to IdleView with their text preserved and can edit & retry.
        setIdleSeed(text);
        setIdleKey((k) => k + 1);
        handleSmartSubmit(text);
      }}
      onCancel={() => setFlowState('idle')}
    />
  );

  // ── Render: inline confirm card ─────────────────────────────────────────
  const renderConfirm = () => {
    if (!confirmData) return null;
    return (
      <InlineConfirmCard
        data={confirmData}
        onSave={handleConfirmSave}
        onCancel={() => setFlowState('idle')}
        saving={saving}
      />
    );
  };

  // ── Render: bulk confirm (screenshot parsed multiple subscriptions) ─
  const [bulkChecked, setBulkChecked] = useState<boolean[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkEditIdx, setBulkEditIdx] = useState<number | null>(null);
  const [bulkMoreExpanded, setBulkMoreExpanded] = useState(false);

  useEffect(() => {
    if (bulkItems.length > 0) setBulkChecked(bulkItems.map(() => true));
  }, [bulkItems]);

  const handleBulkSaveAll = async () => {
    const VALID_CATEGORIES = ['STREAMING','AI_SERVICES','INFRASTRUCTURE','DEVELOPER','PRODUCTIVITY','MUSIC','GAMING','EDUCATION','FINANCE','DESIGN','SECURITY','HEALTH','SPORT','NEWS','BUSINESS','OTHER'];
    const VALID_BILLING = ['WEEKLY','MONTHLY','QUARTERLY','YEARLY','LIFETIME','ONE_TIME'];
    const selected = bulkItems.filter((_, i) => bulkChecked[i]);
    if (selected.length === 0) return;

    setBulkSaving(true);
    let saved = 0;
    const failed: string[] = [];
    for (const sub of selected) {
      try {
        const rawCat = (sub.category || 'OTHER').toUpperCase().replace(/\s+/g,'_');
        const rawBill = (sub.billingPeriod || 'MONTHLY').toUpperCase();
        const iconUrl = sub.iconUrl || (sub.name ? `https://icon.horse/icon/${sub.name.toLowerCase().replace(/[^a-z0-9]/g,'')}.com` : undefined);
        const todayStr = new Date().toISOString().split('T')[0];
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
          startDate: sub.startDate || todayStr,
          nextPaymentDate: sub.nextPaymentDate || undefined,
          notes: sub.notes || undefined,
          reminderDaysBefore: sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0 ? sub.reminderDaysBefore : undefined,
          reminderEnabled: sub.reminderDaysBefore && sub.reminderDaysBefore.length > 0 ? true : undefined,
          addedVia: addedViaSource,
        });
        addSubscription(res.data);
        saved++;
      } catch (err: any) {
        const code = err?.response?.data?.error?.code;
        if (code === 'SUBSCRIPTION_LIMIT_REACHED') {
          failed.push(...selected.slice(selected.indexOf(sub)).map(s => s.name || '?'));
          break;
        }
        failed.push(sub.name || '?');
      }
    }
    subscriptionsApi.getAll({ displayCurrency: useSettingsStore.getState().displayCurrency }).then((r) => {
      useSubscriptionsStore.getState().setSubscriptions(r.data || []);
    }).catch(() => {});
    setBulkSaving(false);

    if (saved > 0) {
      setSuccessName(`${saved} ${t('add.bulk_saved', 'subscriptions')}`);
      setShowSuccess(true);
    }
    if (failed.length > 0) {
      setTimeout(() => {
        Alert.alert(
          t('add.bulk_partial_title', 'Some failed'),
          t('add.bulk_partial_msg', { names: failed.join(', '), defaultValue: 'Could not add: {{names}}' }),
        );
      }, saved > 0 ? 2500 : 100);
    }
  };

  const renderBulkConfirm = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={() => setFlowState('idle')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 4 }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>{t('common.back', 'Back')}</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Ionicons name="sparkles" size={22} color={colors.primary} />
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
          {t('add.bulk_review_title', 'Found subscriptions')}
        </Text>
      </View>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
        {t('add.bulk_review_sub', { count: bulkItems.length, defaultValue: 'Found: {{count}}' })}
      </Text>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {bulkItems.map((sub, idx) => {
          // Known service → real domain mapping
          const DOMAIN_MAP: Record<string, string> = {
            'chatgpt': 'openai.com', 'chatgpt plus': 'openai.com', 'openai': 'openai.com',
            'youtube': 'youtube.com', 'youtube premium': 'youtube.com', 'youtube music': 'music.youtube.com',
            'netflix': 'netflix.com', 'netflix premium': 'netflix.com', 'netflix standard': 'netflix.com',
            'spotify': 'spotify.com', 'spotify premium': 'spotify.com',
            'playstation plus': 'playstation.com', 'playstation': 'playstation.com', 'ps plus': 'playstation.com',
            'xbox game pass': 'xbox.com', 'xbox': 'xbox.com',
            'apple tv+': 'tv.apple.com', 'apple tv': 'tv.apple.com',
            'apple music': 'music.apple.com', 'apple arcade': 'apple.com',
            'icloud': 'icloud.com', 'icloud+': 'icloud.com', 'icloud plus': 'icloud.com',
            'disney+': 'disneyplus.com', 'disney plus': 'disneyplus.com',
            'hbo max': 'hbomax.com', 'hbo': 'hbomax.com',
            'amazon prime': 'amazon.com', 'prime video': 'amazon.com',
            'github': 'github.com', 'github copilot': 'github.com',
            'figma': 'figma.com', 'notion': 'notion.so', 'slack': 'slack.com',
            'adobe': 'adobe.com', 'adobe creative cloud': 'adobe.com',
            'midjourney': 'midjourney.com', 'claude': 'claude.ai',
            'nordvpn': 'nordvpn.com', '1password': '1password.com',
            'strava': 'strava.com', 'duolingo': 'duolingo.com',
          };
          const nameLower = (sub.name || '').toLowerCase().trim();
          const domain = sub.serviceUrl
            ? (() => { try { return new URL(sub.serviceUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })()
            : DOMAIN_MAP[nameLower] || '';
          const iconUrl = sub.iconUrl || (domain ? `https://icon.horse/icon/${domain}` : null);

          // Translate category
          const categoryKey = `categories.${(sub.category || 'OTHER').toLowerCase()}`;
          const categoryLabel = t(categoryKey, (sub.category || 'OTHER').replace(/_/g, ' '));

          // Translate billing period
          const periodMap: Record<string, string> = {
            'MONTHLY': t('subscription.monthly', 'monthly'),
            'YEARLY': t('subscription.yearly', 'yearly'),
            'WEEKLY': t('subscription.weekly', 'weekly'),
            'QUARTERLY': t('subscription.quarterly', 'quarterly'),
            'LIFETIME': t('subscription.lifetime', 'lifetime'),
            'ONE_TIME': t('subscription.one_time', 'one-time'),
          };
          const periodLabel = periodMap[(sub.billingPeriod || 'MONTHLY').toUpperCase()] || sub.billingPeriod;

          return (
            <View key={idx} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              padding: 16, marginBottom: 10, borderRadius: 16,
              backgroundColor: colors.card, borderWidth: 1.5,
              borderColor: bulkChecked[idx] ? colors.primary : colors.border,
              opacity: bulkChecked[idx] ? 1 : 0.4,
            }}>
              {/* Checkbox */}
              <TouchableOpacity
                onPress={() => setBulkChecked(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; })}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={bulkChecked[idx] ? 'checkbox' : 'square-outline'}
                  size={26}
                  color={bulkChecked[idx] ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>

              {/* Icon */}
              {iconUrl ? (
                <Image
                  source={{ uri: iconUrl }}
                  style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface2 }}
                />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cube-outline" size={22} color={colors.primary} />
                </View>
              )}

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>{sub.name}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>
                  {categoryLabel} · {periodLabel}
                </Text>
              </View>

              {/* Price + Actions */}
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                  {formatMoney(sub.amount || 0, sub.currency || displayCurrency, i18n.language)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setBulkEditIdx(idx)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setBulkItems(prev => prev.filter((_, i) => i !== idx));
                      setBulkChecked(prev => prev.filter((_, i) => i !== idx));
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.error || '#EF4444'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Save button */}
      <TouchableOpacity
        onPress={handleBulkSaveAll}
        disabled={bulkSaving || bulkChecked.every(c => !c)}
        style={{
          backgroundColor: bulkChecked.some(c => c) ? colors.primary : colors.surface2,
          borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 14,
          shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
        }}
      >
        {bulkSaving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800' }}>
            {t('add.bulk_save', { count: bulkChecked.filter(Boolean).length, defaultValue: 'Add {{count}}' })}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ── Render: wizard ─────────────────────────────────────────────────────
  const renderWizard = () => (
    <View style={{ flex: 1, paddingHorizontal: 4, paddingBottom: 16 }}>
      <TouchableOpacity
        onPress={() => setFlowState('idle')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 4 }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>{t('common.back', 'Back')}</Text>
      </TouchableOpacity>
      <AIWizard
        onSave={async (sub) => {
          const iconUrl = sub.iconUrl || (sub.serviceUrl
            ? `https://icon.horse/icon/${(() => { try { return new URL(sub.serviceUrl).hostname; } catch { return ''; } })()}`
            : sub.name
              ? `https://icon.horse/icon/${sub.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`
              : undefined);

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
            billingDay: 1,
            status: 'ACTIVE',
            serviceUrl: sub.serviceUrl || undefined,
            cancelUrl: sub.cancelUrl || undefined,
            iconUrl: iconUrl || undefined,
            startDate: new Date().toISOString().split('T')[0],
            addedVia: 'AI_TEXT',
          });
          addSubscription(res.data);
          if (res.data.iconUrl) { prefetchImage(res.data.iconUrl); }
          setSuccessName(sub.name || '');
          setShowSuccess(true);
          subscriptionsApi.getAll({ displayCurrency: useSettingsStore.getState().displayCurrency }).then((r) => {
            useSubscriptionsStore.getState().setSubscriptions(r.data || []);
          }).catch(() => {});
        }}
        onSaveBulk={async (subs) => {
          // Same bulk save logic
          const VALID_CATEGORIES = ['STREAMING','AI_SERVICES','INFRASTRUCTURE','DEVELOPER','PRODUCTIVITY','MUSIC','GAMING','EDUCATION','FINANCE','DESIGN','SECURITY','HEALTH','SPORT','NEWS','BUSINESS','OTHER'];
          const VALID_BILLING = ['WEEKLY','MONTHLY','QUARTERLY','YEARLY','LIFETIME','ONE_TIME'];
          let saved = 0;
          const failed: string[] = [];
          for (const sub of subs) {
            try {
              const rawCat = (sub.category || 'OTHER').toUpperCase().replace(/\s+/g,'_');
              const rawBill = (sub.billingPeriod || 'MONTHLY').toUpperCase();
              const iconUrl = sub.iconUrl || (sub.name ? `https://icon.horse/icon/${sub.name.toLowerCase().replace(/[^a-z0-9]/g,'')}.com` : undefined);
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
        }}
        onEdit={(sub) => {
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
          setManualExpanded(true);
          setFlowState('manual');
        }}
      />
    </View>
  );

  // ── Render: manual form ─────────────────────────────────────────────────
  const renderManual = () => (
    <View style={{ paddingBottom: 40 }}>
      {/* Back to main */}
      <TouchableOpacity
        onPress={() => { setManualExpanded(false); setFlowState('idle'); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 }}
      >
        <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>{t('common.back', 'Back')}</Text>
      </TouchableOpacity>

      {/* Essential fields */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
          {t('add.name')} *
        </Text>
        <TextInput
          testID="name-input"
          style={inputStyle}
          value={form.name}
          onChangeText={(v) => setF('name', v)}
          placeholder={t('add.name_placeholder')}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
          {t('add.amount')} *
        </Text>
        <NumericInput
          testID="amount-input"
          style={inputStyle}
          value={form.amount}
          onChangeText={(v) => setF('amount', v)}
          placeholder="9.99"
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textMuted}
          accessoryId="manual-amount"
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
          {t('add.billing_cycle')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: 6 }}>
            {BILLING_PERIODS.map((p) => (
              <TouchableOpacity
                key={p}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: form.billingPeriod === p ? colors.primary : colors.background,
                  borderWidth: 1,
                  borderColor: form.billingPeriod === p ? colors.primary : colors.border,
                }}
                onPress={() => setF('billingPeriod', p)}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: form.billingPeriod === p ? '#FFF' : colors.text }}>
                  {t(`billing.${p.toLowerCase()}`, p)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <DatePickerField
        label={t('add.start_date', 'Start date')}
        value={form.startDate}
        onChange={(v) => setF('startDate', v)}
      />
      <DatePickerField
        label={t('add.next_payment', 'Next payment date')}
        value={form.nextPaymentDate}
        onChange={(v) => setF('nextPaymentDate', v)}
      />

      {/* "More" toggle */}
      <TouchableOpacity
        onPress={() => setMoreExpanded(!moreExpanded)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 14,
          marginTop: 4,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Ionicons
          name={moreExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
          {moreExpanded ? t('add.show_less', 'Less') : t('add.show_more', 'More options')}
        </Text>
      </TouchableOpacity>

      {/* Optional fields */}
      {moreExpanded && (
        <View style={{ marginTop: 8 }}>
          {/* Category */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              {t('add.category')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: 8 }}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: form.category === cat.id ? colors.primaryLight : colors.background,
                      borderWidth: 1,
                      borderColor: form.category === cat.id ? colors.primary : colors.border,
                    }}
                    onPress={() => setF('category', cat.id)}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.color }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: form.category === cat.id ? colors.primary : colors.text }}>
                      {t(`categories.${cat.id.toLowerCase()}`, cat.label)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Payment Card */}
          {cards.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                {t('add.card')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: !form.paymentCardId ? colors.primary : colors.background,
                      borderWidth: 1,
                      borderColor: !form.paymentCardId ? colors.primary : colors.border,
                    }}
                    onPress={() => setF('paymentCardId', '')}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: !form.paymentCardId ? '#FFF' : colors.text }}>
                      {t('add.no_card')}
                    </Text>
                  </TouchableOpacity>
                  {cards.map((card) => (
                    <TouchableOpacity
                      key={card.id}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: form.paymentCardId === card.id ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor: form.paymentCardId === card.id ? colors.primary : colors.border,
                      }}
                      onPress={() => setF('paymentCardId', card.id)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: form.paymentCardId === card.id ? '#FFF' : colors.text }}>
                        ••••{card.last4} ({card.brand})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Plan name */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
              {t('add.plan')}
            </Text>
            <TextInput
              style={inputStyle}
              value={form.currentPlan}
              onChangeText={(v) => setF('currentPlan', v)}
              placeholder={t('add.plan_placeholder')}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Service URL */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
              {t('add.website')}
            </Text>
            <TextInput
              style={inputStyle}
              value={form.serviceUrl}
              onChangeText={(v) => setF('serviceUrl', v)}
              placeholder="https://netflix.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
            />
          </View>

          {/* Cancel URL */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
              {t('add.cancel_url', 'Cancel URL')}
            </Text>
            <TextInput
              style={inputStyle}
              value={form.cancelUrl}
              onChangeText={(v) => setF('cancelUrl', v)}
              placeholder="https://netflix.com/cancelplan"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
            />
          </View>

          {/* Billing Day */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
              {t('add.billing_day', 'Billing day')}
            </Text>
            <NumericInput
              style={inputStyle}
              value={form.billingDay}
              onChangeText={(v) => {
                const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                if (!v || isNaN(num)) { setF('billingDay', ''); return; }
                setF('billingDay', String(Math.min(Math.max(num, 1), 31)));
              }}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={2}
              accessoryId="manual-billing-day"
            />
          </View>

          {/* Notes */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
              {t('add.notes')}
            </Text>
            <TextInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
              value={form.notes}
              onChangeText={(v) => setF('notes', v)}
              placeholder={t('add.notes_placeholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Reminder */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              {t('add.reminder', 'Reminder')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: t('add.reminder_off', 'Off'), value: [] as number[] },
                { label: t('add.reminder_1d', '1d'), value: [1] },
                { label: t('add.reminder_3d', '3d'), value: [3] },
                { label: t('add.reminder_7d', '7d'), value: [7] },
              ].map((opt) => {
                const isSelected = JSON.stringify(form.reminderDaysBefore) === JSON.stringify(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: isSelected ? colors.primary : colors.background,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                    onPress={() => setF('reminderDaysBefore', opt.value)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#FFF' : colors.text }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Card color */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              {t('add.card_color', 'Card color')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: t('add.color_auto', 'Auto'), value: '', hex: colors.primary },
                { value: '#3B82F6', hex: '#3B82F6' },
                { value: '#10B981', hex: '#10B981' },
                { value: '#EF4444', hex: '#EF4444' },
                { value: '#F59E0B', hex: '#F59E0B' },
                { value: '#EC4899', hex: '#EC4899' },
                { value: '#06B6D4', hex: '#06B6D4' },
                { value: '#6B7280', hex: '#6B7280' },
              ].map((c) => (
                <TouchableOpacity
                  key={c.value || 'auto'}
                  onPress={() => setF('color', c.value)}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: c.hex,
                    borderWidth: 2.5,
                    borderColor: form.color === c.value ? colors.text : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {'label' in c && c.label && (
                    <Text style={{ fontSize: 7, fontWeight: '800', color: '#FFF' }}>{c.label}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tags */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              {t('add.tags', 'Tags')}
            </Text>
            {form.tags.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {form.tags.map((tag, idx) => (
                  <View key={idx} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                  }}>
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>{tag}</Text>
                    <TouchableOpacity onPress={() => setF('tags', form.tags.filter((_: string, i: number) => i !== idx))}>
                      <Ionicons name="close" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              style={inputStyle}
              placeholder={t('add.tags_placeholder', 'Type and press comma...')}
              placeholderTextColor={colors.textMuted}
              onChangeText={(v) => {
                if (v.includes(',')) {
                  const tag = v.replace(',', '').trim();
                  if (tag && !form.tags.includes(tag)) {
                    setF('tags', [...form.tags, tag]);
                  }
                }
              }}
              onSubmitEditing={(e) => {
                const tag = e.nativeEvent.text.trim();
                if (tag && !form.tags.includes(tag)) {
                  setF('tags', [...form.tags, tag]);
                }
              }}
              returnKeyType="done"
            />
          </View>

          {/* Trial toggle + date */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <GiftIcon size={16} color={colors.text} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                    {t('add.trial_period')}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {t('add.trial_desc')}
                </Text>
              </View>
              <Switch
                value={form.isTrial}
                onValueChange={(v) => setForm((f) => ({
                  ...f,
                  isTrial: v,
                  trialEndDate: v
                    ? new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
                    : '',
                }))}
                trackColor={{ false: colors.border, true: '#F59E0B' }}
                thumbColor={form.isTrial ? '#FFF' : '#999'}
              />
            </View>

            {form.isTrial && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 2 }}>
                  {t('add.trial_end_date')}
                </Text>
                <TextInput
                  style={inputStyle}
                  value={form.trialEndDate}
                  onChangeText={(v) => setF('trialEndDate', v)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity
        testID="btn-save-sub"
        style={[{ backgroundColor: (form.name.trim() !== '' && parseFloat(form.amount) > 0) ? colors.primary : colors.border, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 }, (saving || !(form.name.trim() !== '' && parseFloat(form.amount) > 0)) && { opacity: 0.5 }]}
        onPress={handleSave}
        disabled={saving || !(form.name.trim() !== '' && parseFloat(form.amount) > 0)}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>{t('add.add_subscription')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

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
          <Reanimated.View style={{ paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center' }}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </Reanimated.View>
        </GestureDetector>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.1 + 10 : 0}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('add.title')}</Text>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.background }]}>
              <Ionicons name="close" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            contentInsetAdjustmentBehavior="automatic"
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
                onManualToggle={handleManualToggle}
              />
            )}
            {flowState === 'loading' && renderLoading()}
            {flowState === 'transcription' && renderTranscription()}
            {flowState === 'confirm' && renderConfirm()}
            {flowState === 'bulk-confirm' && renderBulkConfirm()}
            {flowState === 'wizard' && renderWizard()}
            {flowState === 'manual' && renderManual()}
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
    {bulkEditIdx !== null && bulkItems[bulkEditIdx] && (() => {
      const sub = bulkItems[bulkEditIdx];
      const PERIODS = ['MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY'] as const;
      const ALL_CATEGORIES = ['STREAMING', 'AI_SERVICES', 'PRODUCTIVITY', 'MUSIC', 'GAMING', 'DESIGN', 'EDUCATION', 'FINANCE', 'INFRASTRUCTURE', 'SECURITY', 'HEALTH', 'SPORT', 'DEVELOPER', 'NEWS', 'BUSINESS', 'OTHER'];
      const updateSub = (patch: Partial<typeof sub>) => setBulkItems(prev => { const n = [...prev]; n[bulkEditIdx] = { ...n[bulkEditIdx], ...patch }; return n; });
      return (
        <Modal visible transparent animationType="slide" onRequestClose={() => { setBulkEditIdx(null); setBulkMoreExpanded(false); }}>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, gap: 12 }}>
              <TouchableOpacity onPress={() => { setBulkEditIdx(null); setBulkMoreExpanded(false); }}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 }}>{t('common.edit', 'Edit')}</Text>
              <TouchableOpacity
                onPress={() => { setBulkEditIdx(null); setBulkMoreExpanded(false); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.primary }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>{t('common.done', 'Done')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentInsetAdjustmentBehavior="automatic"
            >
              {/* Name */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.service_name', 'Name')}</Text>
                <TextInput
                  style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card }}
                  value={sub.name}
                  onChangeText={(v) => updateSub({ name: v })}
                />
              </View>
              {/* Amount */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.amount', 'Amount')}</Text>
                <NumericInput
                  style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card }}
                  value={String(sub.amount || '')}
                  onChangeText={(v) => updateSub({ amount: parseFloat(v) || 0 })}
                  keyboardType="decimal-pad"
                  accessoryId="bulk-amount"
                />
              </View>
              {/* Billing Period */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.billing_period', 'Billing Period')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {PERIODS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: (sub.billingPeriod || 'MONTHLY').toUpperCase() === p ? colors.primary : colors.border, backgroundColor: (sub.billingPeriod || 'MONTHLY').toUpperCase() === p ? colors.primary + '12' : colors.card }}
                      onPress={() => updateSub({ billingPeriod: p })}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: (sub.billingPeriod || 'MONTHLY').toUpperCase() === p ? colors.primary : colors.textSecondary }}>
                        {String(t(`add.${p.toLowerCase()}`, p.toLowerCase()))}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Category */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.category', 'Category')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {ALL_CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: (sub.category || 'OTHER').toUpperCase() === c ? colors.primary : colors.border, backgroundColor: (sub.category || 'OTHER').toUpperCase() === c ? colors.primary + '12' : colors.card }}
                      onPress={() => updateSub({ category: c })}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: (sub.category || 'OTHER').toUpperCase() === c ? colors.primary : colors.textSecondary }}>{String(t(`categories.${c.toLowerCase()}`, c))}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* More options toggle */}
              <TouchableOpacity
                onPress={() => setBulkMoreExpanded(!bulkMoreExpanded)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 14,
                  marginTop: 4,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <Ionicons
                  name={bulkMoreExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                  {bulkMoreExpanded ? t('add_flow.less_options', 'Less') : t('add_flow.more_options', 'More options')}
                </Text>
              </TouchableOpacity>

              {bulkMoreExpanded && (
                <View style={{ gap: 16 }}>
                  {/* Start Date */}
                  <DatePickerField
                    label={t('add.start_date', 'Start date')}
                    value={sub.startDate || new Date().toISOString().split('T')[0]}
                    onChange={(v) => updateSub({ startDate: v })}
                  />
                  {/* Next Payment Date */}
                  <DatePickerField
                    label={t('add.next_payment', 'Next payment date')}
                    value={sub.nextPaymentDate || ''}
                    onChange={(v) => updateSub({ nextPaymentDate: v })}
                  />
                  {/* Billing Day */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.billing_day', 'Billing day')}</Text>
                    <NumericInput
                      style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card, width: 80 }}
                      value={sub.billingDay != null ? String(sub.billingDay) : ''}
                      onChangeText={(v) => {
                        const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                        updateSub({ billingDay: isNaN(num) ? undefined : Math.min(Math.max(num, 1), 31) });
                      }}
                      placeholder="1"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={2}
                      accessoryId="bulk-billing-day"
                    />
                  </View>
                  {/* Notes */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.notes', 'Notes')}</Text>
                    <TextInput
                      style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card, minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }}
                      value={sub.notes || ''}
                      onChangeText={(v) => updateSub({ notes: v })}
                      placeholder={t('add.notes_placeholder', 'Additional notes...')}
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                  {/* Reminder Days */}
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.reminder', 'Reminder')}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {[
                        { label: t('add.reminder_off', 'Off'), value: [] as number[] },
                        { label: t('add.reminder_1d', '1d'), value: [1] },
                        { label: t('add.reminder_3d', '3d'), value: [3] },
                        { label: t('add.reminder_7d', '7d'), value: [7] },
                      ].map((opt) => {
                        const current = sub.reminderDaysBefore ?? [3];
                        const isSelected = JSON.stringify(current) === JSON.stringify(opt.value);
                        return (
                          <TouchableOpacity
                            key={opt.label}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: isSelected ? colors.primary : colors.border,
                              backgroundColor: isSelected ? colors.primary + '12' : colors.card,
                            }}
                            onPress={() => updateSub({ reminderDaysBefore: opt.value })}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? colors.primary : colors.textSecondary }}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* Delete */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EF444440', backgroundColor: '#EF444408', marginTop: 8 }}
                onPress={() => {
                  setBulkItems(prev => prev.filter((_, j) => j !== bulkEditIdx));
                  setBulkChecked(prev => prev.filter((_, j) => j !== bulkEditIdx));
                  setBulkEditIdx(null);
                  setBulkMoreExpanded(false);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>{t('common.delete', 'Delete')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      );
    })()}

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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.9,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 24, fontWeight: '800' },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: 20 },
});
