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
import { AICreditsBadge } from './AICreditsBadge';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useTheme } from '../theme';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { lookupService, lookupServiceWithAI, CatalogEntry } from '../utils/catalogLookup';
import { isBulkInput, splitBulkInput, extractPrice } from '../utils/clientParser';
import { CameraIcon, GiftIcon } from './icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ── Quick chips (hardcoded, 0 AI credits, 0 network) ─────────────────────────

const QUICK_CHIPS = [
  // Streaming
  { name: 'Netflix', letter: 'N', letterBg: '#E50914', iconUrl: 'https://icon.horse/icon/netflix.com', amount: 15.49, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://netflix.com', cancelUrl: 'https://www.netflix.com/cancelplan', plans: [{ name: 'Standard with Ads', priceMonthly: 6.99, currency: 'USD' }, { name: 'Standard', priceMonthly: 15.49, currency: 'USD' }, { name: 'Premium', priceMonthly: 22.99, currency: 'USD' }] },
  { name: 'YouTube', letter: 'Y', letterBg: '#FF0000', iconUrl: 'https://icon.horse/icon/youtube.com', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://youtube.com', cancelUrl: 'https://youtube.com/paid_memberships', plans: [{ name: 'Individual', priceMonthly: 13.99, currency: 'USD' }, { name: 'Family', priceMonthly: 22.99, currency: 'USD' }] },
  { name: 'Disney+', letter: 'D', letterBg: '#113CCF', iconUrl: 'https://icon.horse/icon/disneyplus.com', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://disneyplus.com', cancelUrl: 'https://www.disneyplus.com/account/subscription', plans: [{ name: 'Basic', priceMonthly: 7.99, currency: 'USD' }, { name: 'Premium', priceMonthly: 13.99, currency: 'USD' }] },
  { name: 'HBO Max', letter: 'H', letterBg: '#5822B4', iconUrl: 'https://icon.horse/icon/max.com', amount: 16.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://max.com', cancelUrl: 'https://help.max.com/cancel', plans: [{ name: 'With Ads', priceMonthly: 9.99, currency: 'USD' }, { name: 'Ad-Free', priceMonthly: 16.99, currency: 'USD' }, { name: 'Ultimate', priceMonthly: 20.99, currency: 'USD' }] },
  { name: 'Amazon Prime', letter: 'A', letterBg: '#FF9900', iconUrl: 'https://icon.horse/icon/amazon.com', amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://amazon.com', cancelUrl: 'https://www.amazon.com/mc/cancel', plans: [{ name: 'Monthly', priceMonthly: 14.99, currency: 'USD' }, { name: 'Annual', priceMonthly: 11.58, currency: 'USD' }] },
  { name: 'Apple TV+', letter: 'A', letterBg: '#333333', iconUrl: 'https://icon.horse/icon/tv.apple.com', amount: 9.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://tv.apple.com', cancelUrl: 'https://support.apple.com/billing', plans: [{ name: 'Monthly', priceMonthly: 9.99, currency: 'USD' }] },
  // Music
  { name: 'Spotify', letter: 'S', letterBg: '#1DB954', iconUrl: 'https://icon.horse/icon/spotify.com', amount: 11.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'MUSIC', serviceUrl: 'https://spotify.com', cancelUrl: 'https://www.spotify.com/account/subscription/cancel', plans: [{ name: 'Individual', priceMonthly: 11.99, currency: 'USD' }, { name: 'Duo', priceMonthly: 16.99, currency: 'USD' }, { name: 'Family', priceMonthly: 19.99, currency: 'USD' }] },
  { name: 'Apple Music', letter: 'A', letterBg: '#FC3C44', iconUrl: 'https://icon.horse/icon/music.apple.com', amount: 10.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'MUSIC', serviceUrl: 'https://music.apple.com', cancelUrl: 'https://support.apple.com/billing', plans: [{ name: 'Individual', priceMonthly: 10.99, currency: 'USD' }, { name: 'Family', priceMonthly: 16.99, currency: 'USD' }] },
  // AI & Productivity
  { name: 'ChatGPT', letter: 'C', letterBg: '#10A37F', iconUrl: 'https://icon.horse/icon/openai.com', amount: 20, currency: 'USD', billingPeriod: 'MONTHLY', category: 'AI_SERVICES', serviceUrl: 'https://chat.openai.com', cancelUrl: 'https://help.openai.com/en/articles/7232013', plans: [{ name: 'Plus', priceMonthly: 20, currency: 'USD' }, { name: 'Pro', priceMonthly: 200, currency: 'USD' }] },
  { name: 'Claude', letter: 'C', letterBg: '#D4A574', iconUrl: 'https://icon.horse/icon/claude.ai', amount: 20, currency: 'USD', billingPeriod: 'MONTHLY', category: 'AI_SERVICES', serviceUrl: 'https://claude.ai', cancelUrl: 'https://claude.ai/settings', plans: [{ name: 'Pro', priceMonthly: 20, currency: 'USD' }, { name: 'Max', priceMonthly: 100, currency: 'USD' }] },
  { name: 'Notion', letter: 'N', letterBg: '#000000', iconUrl: 'https://icon.horse/icon/notion.so', amount: 10, currency: 'USD', billingPeriod: 'MONTHLY', category: 'PRODUCTIVITY', serviceUrl: 'https://notion.so', cancelUrl: 'https://notion.so/settings', plans: [{ name: 'Plus', priceMonthly: 10, currency: 'USD' }, { name: 'Business', priceMonthly: 15, currency: 'USD' }] },
  { name: 'Figma', letter: 'F', letterBg: '#A259FF', iconUrl: 'https://icon.horse/icon/figma.com', amount: 12, currency: 'USD', billingPeriod: 'MONTHLY', category: 'DESIGN', serviceUrl: 'https://figma.com', cancelUrl: 'https://figma.com/settings', plans: [{ name: 'Professional', priceMonthly: 12, currency: 'USD' }, { name: 'Organization', priceMonthly: 45, currency: 'USD' }] },
  { name: 'Slack', letter: 'S', letterBg: '#4A154B', iconUrl: 'https://icon.horse/icon/slack.com', amount: 7.25, currency: 'USD', billingPeriod: 'MONTHLY', category: 'PRODUCTIVITY', serviceUrl: 'https://slack.com', cancelUrl: 'https://slack.com/help/categories/200122103', plans: [{ name: 'Pro', priceMonthly: 7.25, currency: 'USD' }, { name: 'Business+', priceMonthly: 12.50, currency: 'USD' }] },
  // Cloud & Infrastructure
  { name: 'iCloud+', letter: 'i', letterBg: '#3693F3', iconUrl: 'https://icon.horse/icon/icloud.com', amount: 0.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'INFRASTRUCTURE', serviceUrl: 'https://icloud.com', cancelUrl: 'https://support.apple.com/billing', plans: [{ name: '50 GB', priceMonthly: 0.99, currency: 'USD' }, { name: '200 GB', priceMonthly: 2.99, currency: 'USD' }, { name: '2 TB', priceMonthly: 9.99, currency: 'USD' }] },
  { name: 'Google One', letter: 'G', letterBg: '#4285F4', iconUrl: 'https://icon.horse/icon/one.google.com', amount: 1.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'INFRASTRUCTURE', serviceUrl: 'https://one.google.com', cancelUrl: 'https://one.google.com/settings', plans: [{ name: '100 GB', priceMonthly: 1.99, currency: 'USD' }, { name: '200 GB', priceMonthly: 2.99, currency: 'USD' }, { name: '2 TB', priceMonthly: 9.99, currency: 'USD' }] },
  // Gaming
  { name: 'Xbox Game Pass', letter: 'X', letterBg: '#107C10', iconUrl: 'https://icon.horse/icon/xbox.com', amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'GAMING', serviceUrl: 'https://xbox.com/game-pass', cancelUrl: 'https://account.microsoft.com/services', plans: [{ name: 'Core', priceMonthly: 9.99, currency: 'USD' }, { name: 'Standard', priceMonthly: 14.99, currency: 'USD' }, { name: 'Ultimate', priceMonthly: 19.99, currency: 'USD' }] },
  { name: 'PlayStation Plus', letter: 'P', letterBg: '#003087', iconUrl: 'https://icon.horse/icon/playstation.com', amount: 9.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'GAMING', serviceUrl: 'https://playstation.com', cancelUrl: 'https://store.playstation.com/subscriptions', plans: [{ name: 'Essential', priceMonthly: 9.99, currency: 'USD' }, { name: 'Extra', priceMonthly: 14.99, currency: 'USD' }, { name: 'Premium', priceMonthly: 17.99, currency: 'USD' }] },
  // Developer
  { name: 'GitHub Copilot', letter: 'G', letterBg: '#24292E', iconUrl: 'https://icon.horse/icon/github.com', amount: 10, currency: 'USD', billingPeriod: 'MONTHLY', category: 'AI_SERVICES', serviceUrl: 'https://github.com/features/copilot', cancelUrl: 'https://github.com/settings/billing', plans: [{ name: 'Individual', priceMonthly: 10, currency: 'USD' }, { name: 'Business', priceMonthly: 19, currency: 'USD' }] },
  { name: 'Adobe CC', letter: 'A', letterBg: '#FF0000', iconUrl: 'https://icon.horse/icon/adobe.com', amount: 59.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'DESIGN', serviceUrl: 'https://adobe.com', cancelUrl: 'https://account.adobe.com/plans', plans: [{ name: 'Photography', priceMonthly: 9.99, currency: 'USD' }, { name: 'Single App', priceMonthly: 22.99, currency: 'USD' }, { name: 'All Apps', priceMonthly: 59.99, currency: 'USD' }] },
  // VPN / Security
  { name: 'NordVPN', letter: 'N', letterBg: '#4687FF', iconUrl: 'https://icon.horse/icon/nordvpn.com', amount: 12.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'SECURITY', serviceUrl: 'https://nordvpn.com', cancelUrl: 'https://my.nordaccount.com/billing', plans: [{ name: 'Monthly', priceMonthly: 12.99, currency: 'USD' }, { name: 'Annual', priceMonthly: 4.59, currency: 'USD' }] },
] as const;

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
  currency: 'USD',
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
  reminderDaysBefore: [3] as number[],
  color: '' as string,
  tags: [] as string[],
};


// Extracted to avoid useState inside .map()
function QuickChipButton({ chip, colors, onPress }: {
  chip: typeof QUICK_CHIPS[number];
  colors: any;
  onPress: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.background }]}
      onPress={onPress}
    >
      {!imgError ? (
        <Image
          source={{ uri: chip.iconUrl }}
          style={styles.quickChipIcon}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.quickChipIconFallback, { backgroundColor: chip.letterBg }]}>
          <Text style={styles.quickChipIconLetter}>{chip.letter}</Text>
        </View>
      )}
      <Text style={[styles.quickChipText, { color: colors.text }]}>{chip.name}</Text>
    </TouchableOpacity>
  );
}

export function AddSubscriptionSheet({ visible, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { subsLimitReached, isPro, activeCount, maxSubscriptions } = usePlanLimits();
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
    console.log('[AddSheet] flowState:', flowStateRef.current, '→', state);
    flowStateRef.current = state;
    _setFlowState(state);
  };
  const [smartInput, setSmartInput] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [confirmData, setConfirmData] = useState<ConfirmCardData | null>(null);
  const [bulkItems, setBulkItems] = useState<ParsedSub[]>([]);
  const [manualExpanded, setManualExpanded] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [showAllChips, setShowAllChips] = useState(false);

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

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [visible]);

  const resetAll = useCallback(() => {
    setFlowState('idle');
    setSmartInput('');
    setTranscribedText('');
    setConfirmData(null);
    setBulkItems([]);
    setManualExpanded(false);
    setForm(emptyForm);
    setScreenshotUri(null);
    setMoreExpanded(false);
    setAddedViaSource('MANUAL');
    setFoundService(null);
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
      analytics.paywallViewed('feature_gate');
      onClose();
      router.push('/paywall');
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
        billingDay: parseInt(form.billingDay) || 1,
        status: form.isTrial ? 'TRIAL' : 'ACTIVE',
        paymentCardId: form.paymentCardId || undefined,
        currentPlan: form.currentPlan || undefined,
        serviceUrl: form.serviceUrl || undefined,
        cancelUrl: form.cancelUrl || undefined,
        iconUrl: iconUrl || undefined,
        notes: form.notes || undefined,
        trialEndDate: form.isTrial && form.trialEndDate ? form.trialEndDate : undefined,
        startDate: form.startDate || undefined,
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
      subscriptionsApi.getAll().then((r) => {
        useSubscriptionsStore.getState().setSubscriptions(r.data || []);
      }).catch(() => {});
    } catch (err: any) {
      const errorData = err?.response?.data?.error || err?.response?.data;
      const code = errorData?.code || '';
      const isLimitError = code === 'SUBSCRIPTION_LIMIT_REACHED' || err?.response?.status === 429;

      if (isLimitError) {
        onClose();
        router.push('/paywall');
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
      analytics.paywallViewed('feature_gate');
      onClose();
      router.push('/paywall');
      return;
    }
    setSaving(true);

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
      billingDay: 1,
      status: 'ACTIVE',
      serviceUrl: data.serviceUrl || undefined,
      cancelUrl: data.cancelUrl || undefined,
      iconUrl: iconUrl || undefined,
      currentPlan: data.currentPlan || undefined,
      startDate: new Date().toISOString().split('T')[0],
      addedVia: addedViaSource,
    });
    addSubscription(res.data);
    if (res.data.iconUrl) { Image.prefetch(res.data.iconUrl).catch(() => {}); }
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
    subscriptionsApi.getAll().then((r) => {
      useSubscriptionsStore.getState().setSubscriptions(r.data || []);
    }).catch(() => {});
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.message || err?.message || t('add.save_failed'));
    } finally {
      setSaving(false);
    }
  }, [saving, subsLimitReached, onClose, router, currency, addSubscription, addedViaSource]);

  // ── Convert CatalogEntry to ConfirmCardData ─────────────────────────────
  const catalogToConfirmData = (entry: CatalogEntry): ConfirmCardData => ({
    name: { value: entry.name, confidence: 'high' },
    amount: { value: entry.amount, confidence: entry.amount > 0 ? 'high' : 'low' },
    currency: { value: entry.currency, confidence: 'high' },
    billingPeriod: { value: entry.billingPeriod, confidence: 'high' },
    category: { value: entry.category || 'OTHER', confidence: 'medium' },
    iconUrl: entry.iconUrl,
    serviceUrl: entry.serviceUrl,
    cancelUrl: entry.cancelUrl,
    plans: entry.plans?.map(p => ({ name: p.name, priceMonthly: p.amount, currency: p.currency })),
  });

  // ── Smart input submit ──────────────────────────────────────────────────
  const handleSmartSubmit = useCallback(async (text?: string) => {
    const input = (text || smartInput).trim();
    if (!input) return;

    Keyboard.dismiss();

    // Check if bulk input
    if (isBulkInput(input)) {
      setFlowState('loading');
      setAddedViaSource('AI_TEXT');
      try {
        // Try bulk parse via AI
        const res = await aiApi.parseBulkText(input, i18n.language ?? 'en', currency);
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
    setFlowState('loading');
    setAddedViaSource('AI_TEXT');

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
      const result = await lookupServiceWithAI(input, i18n.language ?? 'en', currency);
      if (result.found && result.entry) {
        setConfirmData(catalogToConfirmData(result.entry));
        setFlowState('confirm');
        return;
      }
      if (result.question) {
        // AI needs more info — fall back to wizard
        setSmartInput(input);
        setFlowState('wizard');
        return;
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || '';
      const isLimitError = status === 429 || status === 403 || /limit|exceeded|quota/i.test(msg);
      if (isLimitError) {
        Alert.alert(
          t('add.ai_limit_title', 'AI request limit reached'),
          t('add.ai_limit_msg', 'You\'ve used all your free AI requests. Upgrade to Pro for 200 requests/month.'),
          [
            { text: t('subscription_plan.upgrade_pro', 'Upgrade to Pro'), onPress: () => router.push('/paywall' as any) },
            { text: t('common.cancel', 'Close'), style: 'cancel' },
          ]
        );
        setFlowState('idle');
        return;
      }
    }

    // Nothing found — show wizard as fallback
    setFlowState('wizard');
  }, [smartInput, i18n.language, currency, t, router]);

  // ── Quick chip tap ──────────────────────────────────────────────────────
  const handleQuickChip = useCallback((chip: typeof QUICK_CHIPS[number]) => {
    setAddedViaSource('AI_TEXT');
    setConfirmData({
      name: { value: chip.name, confidence: 'high' },
      amount: { value: chip.amount, confidence: 'high' },
      currency: { value: chip.currency, confidence: 'high' },
      billingPeriod: { value: chip.billingPeriod, confidence: 'high' },
      category: { value: chip.category, confidence: 'high' },
      iconUrl: chip.iconUrl,
      serviceUrl: chip.serviceUrl,
      cancelUrl: chip.cancelUrl,
      plans: chip.plans?.map(p => ({ name: p.name, priceMonthly: p.priceMonthly, currency: p.currency })),
    });
    setFlowState('confirm');
  }, []);

  // ── Voice handler ───────────────────────────────────────────────────────
  const handleVoiceComplete = useCallback(async (uri: string) => {
    if (!uri) return;
    Keyboard.dismiss();
    setFlowState('loading');
    setAddedViaSource('AI_TEXT');
    try {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as const });
      const transcribeRes = await aiApi.parseAudio({ audioBase64, locale: i18n.language ?? 'en' });
      const text: string = transcribeRes.data?.text ?? '';
      if (!text.trim()) {
        Alert.alert(t('ai.voice_error_title'), t('ai.voice_empty'));
        setFlowState('idle');
        return;
      }
      setTranscribedText(text);
      setFlowState('transcription');
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || '';
      const isLimitError = status === 429 || status === 403 || /limit|exceeded|quota/i.test(msg);
      if (isLimitError) {
        Alert.alert(
          t('add.ai_limit_title', 'AI request limit reached'),
          t('add.ai_limit_msg', 'You\'ve used all your free AI requests. Upgrade to Pro for 200 requests/month.'),
          [
            { text: t('subscription_plan.upgrade_pro', 'Upgrade to Pro'), onPress: () => router.push('/paywall' as any) },
            { text: t('common.cancel', 'Close'), style: 'cancel' },
          ]
        );
      } else {
        reportError(`Voice error: ${err?.message ?? err}`, err?.stack);
        Alert.alert(t('ai.voice_error_title'), msg || t('ai.voice_error'));
      }
      setFlowState('idle');
    }
  }, [i18n.language, t, router]);

  const { isRecording, durationFmt, start: startRecording, stop: stopRecording } = useVoiceRecorder(handleVoiceComplete);

  // ── Camera/Screenshot handler ───────────────────────────────────────────
  const handleCamera = useCallback(async () => {
    console.log('[Screenshot] Opening image picker...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled) {
      console.log('[Screenshot] User cancelled picker');
      return;
    }

    const uri = result.assets[0].uri;
    setScreenshotUri(uri);
    setFlowState('loading');
    setAddedViaSource('AI_SCREENSHOT');

    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'screenshot.jpg',
      } as any);
      console.log('[Screenshot] Sending to API, uri:', uri?.slice(0, 80));
      const res = await aiApi.parseScreenshot(formData);
      console.log('[Screenshot] API response:', JSON.stringify(res.data).slice(0, 300));
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
        console.log('[Screenshot] Multiple subs found:', validSubs.length, 'setting bulk-confirm');
        setBulkItems(validSubs);
        setFlowState('bulk-confirm');
      }
    } catch (err: any) {
      console.error('[Screenshot] Full error:', JSON.stringify({ status: err?.response?.status, data: err?.response?.data, message: err?.message }));
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || '';
      const isLimitError = status === 429 || status === 403 || /limit|exceeded|quota/i.test(msg);
      if (isLimitError) {
        Alert.alert(
          t('add.ai_limit_title', 'AI request limit reached'),
          t('add.ai_limit_msg', 'You\'ve used all your free AI requests. Upgrade to Pro for 200 requests/month.'),
          [
            { text: t('subscription_plan.upgrade_pro', 'Upgrade to Pro'), onPress: () => router.push('/paywall' as any) },
            { text: t('common.cancel', 'Close'), style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(t('common.error'), msg || t('add.screenshot_parse_error', 'Could not parse the screenshot. Try a clearer image.'));
      }
      setFlowState('idle');
    }
  }, [t, router]);

  // ── Edit from confirm → manual ──────────────────────────────────────────
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

  // ── Render: idle state (main screen) ────────────────────────────────────
  const renderIdle = () => (
    <View style={{ gap: 16, paddingBottom: 40 }}>
      {/* Smart input with mic & camera */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
          {t('add.smart_input_label', 'What subscription?')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextInput
              testID="smart-input"
              style={[inputStyle, { marginTop: 0 }]}
              value={smartInput}
              onChangeText={setSmartInput}
              placeholder={t('add.smart_input_placeholder', 'Netflix, Spotify $9.99/mo...')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={() => handleSmartSubmit()}
              autoCorrect={false}
            />
          </View>
          {/* Mic button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: isRecording ? '#EF4444' : colors.primary }]}
            onPress={() => { if (isRecording) stopRecording(); else startRecording(); }}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={20} color="#FFF" />
          </TouchableOpacity>
          {/* Camera button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleCamera}
          >
            <CameraIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {isRecording && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
            <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>{durationFmt}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {t('add.tap_stop', 'Tap mic to stop')}
            </Text>
          </View>
        )}
        {/* Submit button if text entered */}
        {smartInput.trim().length > 0 && (
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}
            onPress={() => handleSmartSubmit()}
          >
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>
              {t('add.search', 'Search')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick chips */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
          {t('add.popular', 'Popular')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(showAllChips ? QUICK_CHIPS : QUICK_CHIPS.slice(0, 8)).map((chip) => (
            <QuickChipButton key={chip.name} chip={chip} colors={colors} onPress={() => handleQuickChip(chip)} />
          ))}
          {!showAllChips && QUICK_CHIPS.length > 8 && (
            <TouchableOpacity
              style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => setShowAllChips(true)}
            >
              <Ionicons name="add" size={18} color={colors.textSecondary} />
              <Text style={[styles.quickChipText, { color: colors.textSecondary }]}>
                +{QUICK_CHIPS.length - 8}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* "or enter manually" collapsible */}
      <TouchableOpacity
        onPress={() => {
          setManualExpanded(!manualExpanded);
          if (!manualExpanded) setFlowState('manual');
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 14,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Ionicons
          name={manualExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
          {t('add.or_manual', 'or enter manually')}
        </Text>
      </TouchableOpacity>

      {/* AI Credits Badge */}
      <AICreditsBadge />
    </View>
  );

  // ── Render: loading ─────────────────────────────────────────────────────
  const loadingHint = addedViaSource === 'AI_SCREENSHOT'
    ? t('add.analyzing_screenshot', 'Analyzing screenshot...')
    : addedViaSource === 'AI_TEXT'
    ? t('add.transcribing_voice', 'Transcribing voice...')
    : t('add.searching', 'Searching...');

  const renderLoading = () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>
        {loadingHint}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
        {t('add.loading_hint', 'AI is processing your request. This usually takes a few seconds.')}
      </Text>
      <TouchableOpacity
        onPress={() => setFlowState('idle')}
        style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.surface2 }}
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
        setSmartInput(text);
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
        const res = await subscriptionsApi.create({
          name: sub.name || 'Subscription',
          category: VALID_CATEGORIES.includes(rawCat) ? rawCat : 'OTHER',
          amount: sub.amount || 0,
          currency: sub.currency || currency || 'USD',
          billingPeriod: (VALID_BILLING.includes(rawBill) ? rawBill : 'MONTHLY') as any,
          billingDay: 1,
          status: 'ACTIVE',
          serviceUrl: sub.serviceUrl || undefined,
          cancelUrl: sub.cancelUrl || undefined,
          iconUrl: iconUrl || undefined,
          startDate: new Date().toISOString().split('T')[0],
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
    subscriptionsApi.getAll().then((r) => {
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
                  {sub.currency || 'USD'} {(sub.amount || 0).toFixed(2)}
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
          if (res.data.iconUrl) { Image.prefetch(res.data.iconUrl).catch(() => {}); }
          setSuccessName(sub.name || '');
          setShowSuccess(true);
          subscriptionsApi.getAll().then((r) => {
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
              const res = await subscriptionsApi.create({
                name: sub.name || 'Subscription',
                category: VALID_CATEGORIES.includes(rawCat) ? rawCat : 'OTHER',
                amount: sub.amount || 0,
                currency: sub.currency || currency || 'USD',
                billingPeriod: (VALID_BILLING.includes(rawBill) ? rawBill : 'MONTHLY') as any,
                billingDay: 1, status: 'ACTIVE',
                serviceUrl: sub.serviceUrl || undefined,
                cancelUrl: sub.cancelUrl || undefined,
                iconUrl: iconUrl || undefined,
                startDate: new Date().toISOString().split('T')[0],
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
          subscriptionsApi.getAll().then((r) => {
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
        <TextInput
          testID="amount-input"
          style={inputStyle}
          value={form.amount}
          onChangeText={(v) => setF('amount', v)}
          placeholder="9.99"
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
          {t('add.currency')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'nowrap' }}>
            {CURRENCIES.map((cur) => (
              <TouchableOpacity
                key={cur}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: form.currency === cur ? colors.primary : colors.background,
                  borderWidth: 1,
                  borderColor: form.currency === cur ? colors.primary : colors.border,
                }}
                onPress={() => setF('currency', cur)}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: form.currency === cur ? '#FFF' : colors.text }}>
                  {cur}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
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
                  {t(`periods.${p}`, { defaultValue: p })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
          {t('add.start_date', 'Start date')}
        </Text>
        <TextInput
          style={inputStyle}
          value={form.startDate}
          onChangeText={(v) => setF('startDate', v)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
        />
      </View>

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
            <TextInput
              style={inputStyle}
              value={form.billingDay}
              onChangeText={(v) => setF('billingDay', v.replace(/[^0-9]/g, ''))}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={2}
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

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="always" keyboardDismissMode="interactive">
            {flowState === 'idle' && renderIdle()}
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
        <Modal visible transparent animationType="slide" onRequestClose={() => setBulkEditIdx(null)}>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, gap: 12 }}>
              <TouchableOpacity onPress={() => setBulkEditIdx(null)}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 }}>{t('common.edit', 'Edit')}</Text>
              <TouchableOpacity
                onPress={() => setBulkEditIdx(null)}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.primary }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>{t('common.done', 'Done')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              {/* Name */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.service_name', 'Name')}</Text>
                <TextInput
                  style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card }}
                  value={sub.name}
                  onChangeText={(v) => updateSub({ name: v })}
                />
              </View>
              {/* Amount + Currency */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.amount', 'Amount')}</Text>
                  <TextInput
                    style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card }}
                    value={String(sub.amount || '')}
                    onChangeText={(v) => updateSub({ amount: parseFloat(v) || 0 })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ width: 80, gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.currency', 'Currency')}</Text>
                  <TextInput
                    style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card, textAlign: 'center' }}
                    value={sub.currency || 'USD'}
                    onChangeText={(v) => updateSub({ currency: v.toUpperCase() })}
                    maxLength={3}
                  />
                </View>
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
                        {t(`add.${p.toLowerCase()}`, p.toLowerCase())}
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
                      <Text style={{ fontSize: 11, fontWeight: '600', color: (sub.category || 'OTHER').toUpperCase() === c ? colors.primary : colors.textSecondary }}>{t(`categories.${c.toLowerCase()}`, c)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Delete */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EF444440', backgroundColor: '#EF444408', marginTop: 8 }}
                onPress={() => {
                  setBulkItems(prev => prev.filter((_, j) => j !== bulkEditIdx));
                  setBulkChecked(prev => prev.filter((_, j) => j !== bulkEditIdx));
                  setBulkEditIdx(null);
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
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 44,
  },
  quickChipIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  quickChipIconFallback: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  quickChipIconLetter: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 110,
  },
});
