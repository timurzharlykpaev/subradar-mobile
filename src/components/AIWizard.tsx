/**
 * AIWizard — conversational subscription wizard powered by /ai/wizard endpoint.
 *
 * Flow:
 *   User types/speaks → POST /ai/wizard → backend returns:
 *     { done: true, subscription: {...} }  → show confirmation card
 *     { done: false, question, field }     → show next question
 *
 * Quick chips for popular services bypass dialog entirely (1 tap).
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Animated, StyleSheet, ScrollView, Easing, Keyboard, TouchableWithoutFeedback, Alert, Image, Platform,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { reportError } from '../utils/errorReporter';
import { useTranslation } from 'react-i18next';
import { ExternalLinkIcon, PencilIcon } from './icons';
import { aiApi } from '../api/ai';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import * as FileSystem from 'expo-file-system/legacy';
import { Pressable } from 'react-native';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { cardsApi } from '../api/cards';
import { useRouter } from 'expo-router';

export interface ParsedSub {
  name?: string;
  amount?: number;
  currency?: string;
  billingPeriod?: 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY';
  category?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  iconUrl?: string;
  paymentCardId?: string;
  startDate?: string;
  nextPaymentDate?: string;
  billingDay?: number;
  notes?: string;
  reminderDaysBefore?: number[];
}

interface Props {
  onSave: (sub: ParsedSub) => Promise<void>;
  onSaveBulk?: (subs: ParsedSub[]) => Promise<void>;
  onEdit: (sub: ParsedSub) => void;
}

// ── SVG иконки ──────────────────────────────────────────────────────────────

function NetflixIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#E50914" />
      <Path d="M10 6h3.5l5 12.5V6H22v20h-3.5L13.5 13.5V26H10V6z" fill="white" />
    </Svg>
  );
}
function SpotifyIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="16" fill="#1DB954" />
      <Path d="M22 20.5c-.3 0-.5-.1-.7-.2-3.2-1.9-7.2-2.4-11.9-1.3-.5.1-1-.2-1.1-.7-.1-.5.2-1 .7-1.1 5.2-1.2 9.6-.7 13.2 1.5.4.3.5.8.3 1.3-.2.3-.5.5-.5.5zm1.5-3.3c-.3 0-.6-.1-.8-.3-3.6-2.2-9.1-2.9-13.4-1.6-.6.2-1.2-.2-1.3-.8-.2-.6.2-1.2.7-1.3 4.9-1.5 10.9-.8 15.1 1.8.5.3.6.9.4 1.5-.3.4-.7.7-.7.7zm.2-3.4c-.3 0-.6-.1-.9-.3-3.9-2.3-10.3-2.5-14-.8-.7.2-1.4-.1-1.6-.8-.2-.7.1-1.4.8-1.6 4.3-1.8 11.3-1.5 15.8 1 .6.4.8 1.1.5 1.7-.3.6-.6.8-.6.8z" fill="white" />
    </Svg>
  );
}
function ICloudIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#0071E3" />
      <Path d="M23 19.5a4 4 0 00-3.4-4 5.5 5.5 0 00-10.6 1.5A3 3 0 009 23h14a3 3 0 000-3.5z" fill="white" />
    </Svg>
  );
}
function YouTubeIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#FF0000" />
      <Path d="M26 11.2c-.3-1-1-1.8-2-2C22.2 9 16 9 16 9s-6.2 0-8 .2c-1 .2-1.7 1-2 2C5.8 13 5.8 16 5.8 16s0 3 .2 4.8c.3 1 1 1.8 2 2C9.8 23 16 23 16 23s6.2 0 8-.2c1-.2 1.7-1 2-2 .2-1.8.2-4.8.2-4.8s0-3-.2-4.8zm-12 7.8v-6l6 3-6 3z" fill="white" />
    </Svg>
  );
}
function ChatGPTIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#10A37F" />
      <Circle cx="16" cy="16" r="7" stroke="white" strokeWidth="2" fill="none" />
      <Path d="M13 16h6M16 13v6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
function AmazonIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#FF9900" />
      <Path d="M8 20c4 2.5 10 2.5 14-1M20 21l2-1-1.5 3" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <Rect x="10" y="10" width="12" height="7" rx="2" fill="white" />
    </Svg>
  );
}
function AppleTVIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#1C1C1E" />
      <Path d="M12 20l4-8 4 8M14 17h4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function DisneyIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#0C3594" />
      <Path d="M16 8c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm-1.5 5h3v6h-3v-6z" fill="white" />
    </Svg>
  );
}
function MicSvg({ size = 28, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="2" width="6" height="11" rx="3" fill={color} />
      <Path d="M5 11a7 7 0 0014 0" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M12 18v4M9 22h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

const QUICK = [
  { name: 'Netflix',   Icon: NetflixIcon,  amount: 15.99, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://www.netflix.com/cancelplan',   serviceUrl: 'https://netflix.com',    iconUrl: 'https://icon.horse/icon/netflix.com' },
  { name: 'Spotify',   Icon: SpotifyIcon,  amount: 9.99,  currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://www.spotify.com/account/subscription/cancel', serviceUrl: 'https://spotify.com', iconUrl: 'https://icon.horse/icon/spotify.com' },
  { name: 'iCloud',    Icon: ICloudIcon,   amount: 2.99,  currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://support.apple.com/billing',   serviceUrl: 'https://icloud.com',     iconUrl: 'https://icon.horse/icon/apple.com' },
  { name: 'YouTube',   Icon: YouTubeIcon,  amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://youtube.com/paid_memberships', serviceUrl: 'https://youtube.com',    iconUrl: 'https://icon.horse/icon/youtube.com' },
  { name: 'ChatGPT',   Icon: ChatGPTIcon,  amount: 20.00, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://help.openai.com/en/articles/7232013', serviceUrl: 'https://chat.openai.com', iconUrl: 'https://icon.horse/icon/openai.com' },
  { name: 'Amazon',    Icon: AmazonIcon,   amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://www.amazon.com/mc/cancel',    serviceUrl: 'https://amazon.com',     iconUrl: 'https://icon.horse/icon/amazon.com' },
  { name: 'Apple TV+', Icon: AppleTVIcon,  amount: 9.99,  currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://support.apple.com/billing',   serviceUrl: 'https://tv.apple.com',   iconUrl: 'https://icon.horse/icon/apple.com' },
  { name: 'Disney+',   Icon: DisneyIcon,   amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://www.disneyplus.com/account/subscription', serviceUrl: 'https://disneyplus.com', iconUrl: 'https://icon.horse/icon/disneyplus.com' },
] as const;

// ── Loading stages ───────────────────────────────────────────────────────────

type LoadingStage = 'transcribing' | 'analyzing' | 'searching' | 'preparing' | null;

const STAGE_LABELS: Record<string, Record<string, string>> = {
  transcribing: { en: 'Transcribing audio...', ru: 'Распознаю речь...' },
  analyzing:    { en: 'Analyzing request...', ru: 'Анализирую запрос...' },
  searching:    { en: 'Searching services...', ru: 'Ищу сервисы...' },
  preparing:    { en: 'Preparing options...', ru: 'Подбираю варианты...' },
};

function LoadingIndicator({ stage, colors, lang }: { stage: LoadingStage; colors: any; lang: string }) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progressAnim.setValue(0);
    const stages: LoadingStage[] = ['transcribing', 'analyzing', 'searching', 'preparing'];
    const idx = stages.indexOf(stage ?? 'transcribing');
    Animated.timing(progressAnim, {
      toValue: Math.min((idx + 1) / stages.length, 0.95),
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [stage]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dotAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(dotAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const label = STAGE_LABELS[stage ?? 'transcribing']?.[lang] ?? STAGE_LABELS[stage ?? 'transcribing']?.en ?? '';

  return (
    <View style={loadStyles.wrap}>
      {/* Pulsing icon */}
      <Animated.View style={{ opacity: dotAnim, marginBottom: 16 }}>
        <View style={[loadStyles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Animated.View>
      {/* Stage label */}
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 }}>{label}</Text>
      {/* Progress bar */}
      <View style={[loadStyles.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[loadStyles.fill, {
          backgroundColor: colors.primary,
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
    </View>
  );
}

const loadStyles = StyleSheet.create({
  wrap:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, flex: 1 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  track:      { width: '60%', height: 4, borderRadius: 2, overflow: 'hidden' },
  fill:       { height: '100%', borderRadius: 2 },
});

// ── MicButton ────────────────────────────────────────────────────────────────

function MicButton({ onVoice, loadingStage, colors, t, lang }: { onVoice: (uri: string) => void; loadingStage: LoadingStage; colors: any; t: any; lang: string }) {
  const { isRecording, duration, maxDuration, durationFmt, start, stop } = useVoiceRecorder(onVoice);
  const ring1 = useRef(new Animated.Value(1)).current;
  const loading = !!loadingStage;

  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ring1, { toValue: isRecording ? 1.3 : 1.15, duration: isRecording ? 500 : 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(ring1, { toValue: 1, duration: isRecording ? 500 : 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isRecording]);

  const bg = isRecording ? '#EF4444' : colors.primary;
  const progress = duration / maxDuration;

  const toggle = () => {
    if (loading) return;
    if (isRecording) stop();
    else start();
  };

  if (loading) {
    return <LoadingIndicator stage={loadingStage} colors={colors} lang={lang} />;
  }

  return (
    <View style={micStyles.container}>
      {/* Button + ring together, perfectly centered */}
      <View style={micStyles.btnArea}>
        {/* Pulsing glow ring — same center as button */}
        <Animated.View style={[
          micStyles.ring,
          {
            backgroundColor: bg + (isRecording ? '28' : '20'),
            transform: [{ scale: ring1 }],
          },
        ]} />
        {/* Button */}
        <Pressable onPress={toggle} style={micStyles.pressable}>
          <View style={[micStyles.btn, { backgroundColor: bg, shadowColor: bg }]}>
            {isRecording ? <StopSvg /> : <MicSvg size={34} />}
          </View>
        </Pressable>
      </View>

      {/* Label / Timer — always centered below button */}
      <View style={micStyles.labelWrap}>
        {isRecording ? (
          <>
            <Text style={[micStyles.timer, { color: '#EF4444' }]}>{durationFmt}</Text>
            <View style={micStyles.progressTrack}>
              <View style={[micStyles.progressFill, {
                width: `${progress * 100}%`,
                backgroundColor: progress > 0.8 ? '#EF4444' : colors.primary,
              }]} />
            </View>
            <Text style={[micStyles.limit, { color: colors.textMuted }]}>
              {t('add.max_recording', { sec: maxDuration, defaultValue: 'max {{sec}}s' })}
            </Text>
          </>
        ) : (
          <Text style={[micStyles.label, { color: colors.textSecondary }]}>
            {t('add.tap_to_record', 'Нажмите для записи')}
          </Text>
        )}
      </View>
    </View>
  );
}

function StopSvg() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Rect x="6" y="6" width="12" height="12" rx="2" fill="white" />
    </Svg>
  );
}

const BTN_SIZE = 84;
const RING_SIZE = 128;

const micStyles = StyleSheet.create({
  container:     { alignItems: 'center', marginVertical: 8, gap: 14 },
  // btnArea is sized to the ring — button sits perfectly in the center
  btnArea:       {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring:          {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  pressable:     { zIndex: 2 },
  btn:           {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  labelWrap:     { alignItems: 'center', minHeight: 44 },
  label:         { fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
  timer:         { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  progressTrack: { width: 150, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(128,128,128,0.2)', marginTop: 8, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 1.5 },
  limit:         { fontSize: 11, fontWeight: '500', marginTop: 4, opacity: 0.6 },
});

// ── Component ────────────────────────────────────────────────────────────────

interface PlanOption {
  name: string;
  amount: number;
  billingPeriod: string;
  currency: string;
}

type UIState =
  | { kind: 'idle' }
  | { kind: 'question'; text: string; field: string }
  | { kind: 'confirm'; subscription: ParsedSub }
  | { kind: 'bulk'; subs: ParsedSub[]; checked: boolean[] }
  | { kind: 'bulk-edit'; subs: ParsedSub[]; checked: boolean[]; editIdx: number }
  | { kind: 'plans'; plans: PlanOption[]; serviceName: string; iconUrl?: string; serviceUrl?: string; cancelUrl?: string; category?: string };

export function AIWizard({ onSave, onSaveBulk, onEdit }: Props) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const userCurrency = require('../stores/settingsStore').useSettingsStore((s: any) => s.displayCurrency || s.currency || 'USD');
  const userCountry = require('../stores/settingsStore').useSettingsStore((s: any) => s.region || s.country || 'US');
  const access = useEffectiveAccess();
  const isPro = access?.isPro ?? false;
  const activeCount = access?.limits.subscriptions.used ?? 0;
  // `null` limit == unlimited. Use Infinity so arithmetic comparisons stay simple.
  const maxSubscriptions =
    access && access.limits.subscriptions.limit !== null
      ? access.limits.subscriptions.limit
      : Infinity;
  const { cards, addCard } = usePaymentCardsStore();
  const [addingCard, setAddingCard] = useState(false);
  const router = useRouter();
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);

  const [ui, setUi] = useState<UIState>({ kind: 'idle' });
  const [input, setInput] = useState('');
  const [context, setContext] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(null);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  // Pulse loop for mic button
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const fade = (fn: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setTimeout(fn, 100);
  };

  // ── Limit check ──────────────────────────────────────────────────────────
  const checkLimit = (needed = 1): boolean => {
    if (isPro) return true;
    const remaining = maxSubscriptions - activeCount;
    if (remaining <= 0) {
      // Direct redirect to paywall — no Alert needed
      router.push('/paywall' as any);
      return false;
    }
    if (needed > remaining) {
      Alert.alert(
        t('add.limit_partial_title', 'Partial add'),
        t('add.limit_partial_msg', {
          remaining,
          max: maxSubscriptions,
          defaultValue: 'Only {{remaining}} of {{max}} slots left. First {{remaining}} will be added. Upgrade to Pro for unlimited.',
        }),
        [
          { text: t('subscription_plan.upgrade_pro', 'Upgrade to Pro'), onPress: () => router.push('/paywall' as any) },
          { text: t('common.ok', 'OK') },
        ]
      );
    }
    return true;
  };

  // ── Call backend wizard ──────────────────────────────────────────────────
  const callWizard = async (message: string) => {
    if (!message.trim()) return;

    // Detect if message mentions multiple services (comma/slash/and separated)
    const multiServicePattern = /[,\/]|\b(and|и|плюс|также|ещё|еще)\b/i;
    const looksLikeMultiple = multiServicePattern.test(message) || message.trim().split(/\s+/).length >= 4;

    // Always try bulk first — AI decides if there are 1 or many subscriptions
    setLoading(true);
    setLoadingStage('analyzing');
    try {
      const res = await aiApi.parseBulkText(message, i18n.language ?? 'ru', userCurrency, userCountry);
      const data = res.data;
      // Handle both array and object responses
      let subs: ParsedSub[] = [];
      if (Array.isArray(data)) {
        subs = data;
      } else if (Array.isArray(data?.subscriptions)) {
        subs = data.subscriptions;
      } else if (data && typeof data === 'object' && data.name) {
        subs = [data]; // single sub returned as object
      }
      // Filter out items with no name
      subs = subs.filter((s) => s.name && s.name.trim());

      // If we got any results from bulk AND input looks like multiple services → show bulk
      // (even 1 result for multi-service input should go to bulk for user review)
      if (subs.length > 0 && (subs.length > 1 || looksLikeMultiple)) {
        if (!checkLimit(subs.length)) { setLoading(false); setLoadingStage(null); setInput(''); return; }
        setEditingIndex(null);
        fade(() => setUi({ kind: 'bulk', subs, checked: subs.map(() => true) }));
        setLoading(false);
        setLoadingStage(null);
        setInput('');
        return;
      }
      // Single result for single-service input — fall through to single wizard
    } catch (e) {
      reportError(`parseBulkText error: ${(e as any)?.message ?? e}`, (e as any)?.stack);
      // fall through to wizard
    } finally {
      setLoading(false);
    }

    // Single subscription wizard flow
    if (!checkLimit(1)) { setInput(''); setLoadingStage(null); return; }

    setLoading(true);
    setLoadingStage('searching');
    const newHistory = [...history, { role: 'user' as const, content: message }];
    setHistory(newHistory);
    try {
      setLoadingStage('preparing');
      const contextWithCurrency = {
        ...context,
        preferredCurrency: userCurrency,
        userCountry,
      };
      const res = await aiApi.wizard(message, contextWithCurrency, i18n.language ?? 'en', newHistory);
      const data = res.data;
      // If wizard returned plans but input looks like multiple services — retry as bulk with explicit instruction
      if (data.done && data.plans && Array.isArray(data.plans) && looksLikeMultiple) {
        // Convert each plan to a separate subscription for bulk review
        const subs: ParsedSub[] = data.plans.map((p: any) => ({
          name: p.name || data.serviceName || message.split(',')[0].trim(),
          amount: p.amount || p.price || 0,
          currency: p.currency || 'USD',
          billingPeriod: p.billingPeriod || 'MONTHLY',
          category: data.category,
          serviceUrl: data.serviceUrl,
          cancelUrl: data.cancelUrl,
          iconUrl: data.iconUrl,
        }));
        if (subs.length > 0) {
          setEditingIndex(null);
          fade(() => setUi({ kind: 'bulk', subs, checked: subs.map(() => true) }));
          return;
        }
      }

      if (data.done && data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
        const newCtx = { ...context, ...data.partialContext };
        setContext(newCtx);
        setHistory((h) => [...h, { role: 'assistant', content: JSON.stringify(data) }]);
        // Convert plans to bulk list so user can select multiple, edit each, and add all at once
        const plansAsSubs: ParsedSub[] = data.plans.map((p: any) => ({
          name: p.name || data.serviceName || '',
          amount: p.amount || p.price || 0,
          currency: p.currency || 'USD',
          billingPeriod: (p.billingPeriod || 'MONTHLY') as ParsedSub['billingPeriod'],
          category: data.category,
          serviceUrl: data.serviceUrl,
          cancelUrl: data.cancelUrl,
          iconUrl: data.iconUrl,
        }));
        // Always show bulk so user can review/edit/add plans
        // (even 1 plan goes to bulk for consistency)
        fade(() => setUi({ kind: 'bulk', subs: plansAsSubs, checked: plansAsSubs.map(() => true) }));
      } else if (data.done && data.subscription) {
        const newCtx = { ...context, ...data.partialContext };
        setContext(newCtx);
        setHistory((h) => [...h, { role: 'assistant', content: JSON.stringify(data) }]);
        fade(() => setUi({ kind: 'confirm', subscription: data.subscription }));
      } else if (!data.done && data.question) {
        const newCtx = { ...context, ...(data.partialContext ?? {}) };
        setContext(newCtx);
        setHistory((h) => [...h, { role: 'assistant', content: data.question }]);
        fade(() => setUi({ kind: 'question', text: data.question, field: data.field ?? 'clarify' }));
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
      } else {
        fade(() => setUi({ kind: 'question', text: t('ai.could_not_parse'), field: 'clarify' }));
      }
    } finally {
      setLoading(false);
      setLoadingStage(null);
      setInput('');
    }
  };

  // ── Voice handler ────────────────────────────────────────────────────────
  const handleVoice = async (uri: string) => {
    if (!uri) return;
    Keyboard.dismiss();
    setLoading(true);
    setLoadingStage('transcribing');
    try {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as const });
      const transcribeRes = await aiApi.parseAudio({ audioBase64, locale: i18n.language ?? 'en', currency: userCurrency, country: userCountry });
      const text: string = transcribeRes.data?.text ?? '';
      if (!text.trim()) {
        Alert.alert(t('ai.voice_error_title'), t('ai.voice_empty'));
        setLoading(false);
        setLoadingStage(null);
        return;
      }
      setInput(text);
      setLoadingStage('analyzing');
      await callWizard(text);
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
        reportError(`AIWizard voice error: ${err?.message ?? err}`, err?.stack, { component: 'AIWizard' });
        Alert.alert(t('ai.voice_error_title'), msg || t('ai.voice_error'));
      }
      setLoading(false);
      setLoadingStage(null);
    }
  };

  // ── Quick chip — bypass dialog ────────────────────────────────────────────
  const handleQuick = (svc: typeof QUICK[number]) => {
    fade(() => setUi({ kind: 'confirm', subscription: { ...svc } }));
  };

  const reset = () => {
    setUi({ kind: 'idle' });
    setInput('');
    setContext({});
  };

  const bg   = isDark ? '#1C1C2E' : '#F5F5F7';
  const card = isDark ? '#252538' : '#FFFFFF';

  // ── Question label ────────────────────────────────────────────────────────
  const questionText = ui.kind === 'question'
    ? ui.text
    : t('add.ai_q_name', 'Что за подписка?');

  const hintText = ui.kind === 'idle'
    ? t('add.ai_q_name_hint', 'Скажи или напечатай название сервиса')
    : '';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View testID="ai-wizard" style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* ── Plans selection screen ────────────────────────────────────── */}
        {ui.kind === 'plans' && (() => {
          const quick = QUICK.find(q => q.name.toLowerCase() === (ui.serviceName ?? '').toLowerCase());
          const periodLabel = (p: string) => {
            const map: Record<string, string> = { MONTHLY: t('billing.monthly', 'мес'), YEARLY: t('billing.yearly', 'год'), WEEKLY: t('billing.weekly', 'нед'), QUARTERLY: t('billing.quarterly', 'кварт') };
            return map[p] ?? p.toLowerCase();
          };
          const handlePlanTap = (plan: PlanOption) => {
            const sub: ParsedSub = {
              name: plan.name,
              amount: plan.amount,
              currency: plan.currency,
              billingPeriod: plan.billingPeriod as ParsedSub['billingPeriod'],
              category: ui.category,
              serviceUrl: ui.serviceUrl,
              cancelUrl: ui.cancelUrl,
              iconUrl: ui.iconUrl,
            };
            fade(() => setUi({ kind: 'confirm', subscription: sub }));
          };
          return (
            <View style={{ flex: 1 }}>
              {/* Service header */}
              <View style={styles.plansHeader}>
                {quick
                  ? <quick.Icon size={44} />
                  : ui.iconUrl
                    ? <Image source={{ uri: ui.iconUrl }} style={styles.plansLogo} />
                    : (
                      <View style={[styles.fallbackIcon, { backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 11 }]}>
                        <Text style={[styles.fallbackLetter, { fontSize: 20 }]}>{(ui.serviceName || '?')[0].toUpperCase()}</Text>
                      </View>
                    )}
                <Text style={[styles.plansTitle, { color: colors.text }]}>{ui.serviceName}</Text>
              </View>
              <Text style={[styles.plansSubtitle, { color: colors.textSecondary }]}>
                {t('add.choose_plan', 'Выбери тариф')}
              </Text>

              {/* Plan cards */}
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {ui.plans.map((plan, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.planCard, { backgroundColor: card, borderColor: colors.border }]}
                    onPress={() => handlePlanTap(plan)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                      <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>
                        {periodLabel(plan.billingPeriod)}
                      </Text>
                    </View>
                    <Text style={[styles.planPrice, { color: colors.primary }]}>
                      {plan.currency} {plan.amount.toFixed(2)}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );
        })()}

        {/* ── Bulk confirm screen ─────────────────────────────────────── */}
        {ui.kind === 'bulk' && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.question, { color: colors.text }]}>
              {t('add.bulk_review', 'Выбери подписки')}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('add.bulk_auto_detected', `Найдено: ${ui.subs.length}`)}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 }}>
              <TouchableOpacity onPress={() => setUi({ ...ui, checked: ui.subs.map(() => true) })}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{t('add.bulk_select_all', 'Выбрать все')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setUi({ ...ui, checked: ui.subs.map(() => false) })}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('add.bulk_deselect_all', 'Снять все')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentInsetAdjustmentBehavior="automatic"
            >
              {ui.subs.map((sub, i) => {
                const isChecked = ui.checked[i] ?? true;
                const isEditing = editingIndex === i;
                const periodMap: Record<string, string> = { MONTHLY: '/мес', YEARLY: '/год', WEEKLY: '/нед', QUARTERLY: '/квар' };
                return (
                  <View key={i} style={[bulkStyles.card, {
                    backgroundColor: isChecked ? colors.primary + '12' : (isDark ? '#1C1C2E' : '#F5F5F7'),
                    borderColor: isEditing ? colors.primary : (isChecked ? colors.primary + '60' : colors.border),
                  }]}>
                    {/* Top row: checkbox + icon + name/price */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      {/* Checkbox */}
                      <TouchableOpacity onPress={() => {
                        const next = [...ui.checked]; next[i] = !next[i];
                        setUi({ ...ui, checked: next });
                      }}>
                        <View style={[bulkStyles.check, { borderColor: isChecked ? colors.primary : colors.border, backgroundColor: isChecked ? colors.primary : 'transparent' }]}>
                          {isChecked && <Ionicons name="checkmark" size={13} color="#fff" />}
                        </View>
                      </TouchableOpacity>

                      {/* Icon */}
                      {sub.iconUrl
                        ? <Image source={{ uri: sub.iconUrl }} style={{ width: 34, height: 34, borderRadius: 8 }} />
                        : <View style={[bulkStyles.iconBox, { backgroundColor: colors.primary + '18' }]}>
                            <Text style={[bulkStyles.iconLetter, { color: colors.primary }]}>
                              {(sub.name || '?')[0].toUpperCase()}
                            </Text>
                          </View>
                      }

                      {/* Name + price */}
                      <TouchableOpacity
                        onPress={() => {
                          if (ui.kind === 'bulk') {
                            fade(() => setUi({ kind: 'bulk-edit', subs: ui.subs, checked: ui.checked, editIdx: i }));
                          }
                        }}
                        style={{ flex: 1 }}
                        activeOpacity={0.7}
                      >
                        <Text style={[bulkStyles.name, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                        <Text style={[bulkStyles.meta, { color: colors.textMuted }]}>
                          {sub.currency ?? 'USD'} {(sub.amount ?? 0).toFixed(2)}{periodMap[sub.billingPeriod ?? 'MONTHLY'] ?? ''}
                          {sub.category ? `  ·  ${sub.category.toLowerCase()}` : ''}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Action buttons row */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, paddingLeft: 34 }}>
                      <TouchableOpacity
                        onPress={() => {
                          if (ui.kind === 'bulk') {
                            fade(() => setUi({ kind: 'bulk-edit', subs: ui.subs, checked: ui.checked, editIdx: i }));
                          }
                        }}
                        style={{ padding: 8, borderRadius: 8, backgroundColor: colors.primary + '12' }}
                      >
                        <Ionicons name="pencil" size={16} color={colors.primary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          const newSubs = ui.subs.filter((_, j) => j !== i);
                          const newChecked = ui.checked.filter((_, j) => j !== i);
                          if (newSubs.length === 0) { reset(); return; }
                          setUi({ ...ui, subs: newSubs, checked: newChecked });
                          if (editingIndex === i) setEditingIndex(null);
                        }}
                        style={{ padding: 8, borderRadius: 8, backgroundColor: '#EF444412' }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Bulk-edit detail screen ────────────────────────────────────── */}
        {ui.kind === 'bulk-edit' && (() => {
          const sub = ui.subs[ui.editIdx];
          if (!sub) return null;
          const updateSub = (patch: Partial<ParsedSub>) => {
            const next = [...ui.subs];
            next[ui.editIdx] = { ...next[ui.editIdx], ...patch };
            setUi({ ...ui, subs: next });
          };
          const inputStyle = {
            borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 10 : 6,
            fontSize: 15, fontWeight: '500' as const,
            color: colors.text, borderColor: colors.border,
            backgroundColor: colors.background,
          };
          const PERIODS = ['MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY'] as const;
          const periodLabel = (p: string) => ({ MONTHLY: '/мес', YEARLY: '/год', WEEKLY: '/нед', QUARTERLY: '/квар' }[p] ?? p);
          return (
            <View style={{ flex: 1 }}>
              {/* Back button */}
              <TouchableOpacity
                onPress={() => fade(() => setUi({ kind: 'bulk', subs: ui.subs, checked: ui.checked }))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}
              >
                <Ionicons name="arrow-back" size={20} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>{t('common.back', 'Назад к списку')}</Text>
              </TouchableOpacity>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                contentInsetAdjustmentBehavior="automatic"
              >
                {/* Service name with icon */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  {sub.iconUrl
                    ? <Image source={{ uri: sub.iconUrl }} style={{ width: 36, height: 36, borderRadius: 9 }} />
                    : <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{(sub.name || '?')[0].toUpperCase()}</Text>
                      </View>
                  }
                  <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{sub.name}</Text>
                </View>

                {/* Name */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t('add.name', 'Название')}</Text>
                <TextInput style={[inputStyle, { marginBottom: 12 }]} value={sub.name ?? ''} onChangeText={(v) => updateSub({ name: v })} placeholder={t('add.name_placeholder', 'Название')} placeholderTextColor={colors.textMuted} />

                {/* Amount + Currency */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t('add.amount', 'Сумма')}</Text>
                    <TextInput style={inputStyle} value={String(sub.amount ?? '')} keyboardType="decimal-pad" onChangeText={(v) => updateSub({ amount: parseFloat(v) || 0 })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t('add.currency', 'Валюта')}</Text>
                    <TextInput style={inputStyle} value={sub.currency ?? 'USD'} autoCapitalize="characters" maxLength={3} onChangeText={(v) => updateSub({ currency: v.toUpperCase() })} />
                  </View>
                </View>

                {/* Period */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t('add.billing_cycle', 'Период')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {PERIODS.map((p) => (
                    <TouchableOpacity key={p} onPress={() => updateSub({ billingPeriod: p })}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
                        backgroundColor: sub.billingPeriod === p ? colors.primary : colors.surface2,
                        borderColor: sub.billingPeriod === p ? colors.primary : colors.border }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: sub.billingPeriod === p ? '#fff' : colors.textSecondary }}>{periodLabel(p)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Category */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t('add.category', 'Категория')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {['STREAMING', 'AI_SERVICES', 'INFRASTRUCTURE', 'PRODUCTIVITY', 'MUSIC', 'GAMING', 'DEVELOPER', 'EDUCATION', 'HEALTH', 'OTHER'].map((cat) => (
                    <TouchableOpacity key={cat} onPress={() => updateSub({ category: cat })}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
                        backgroundColor: sub.category === cat ? colors.primary : colors.surface2,
                        borderColor: sub.category === cat ? colors.primary : colors.border }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: sub.category === cat ? '#fff' : colors.textMuted }}>{cat.replace('_', ' ').toLowerCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Service URL */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t('add.service_url', 'Сайт сервиса')}</Text>
                <TextInput style={[inputStyle, { marginBottom: 12 }]} value={sub.serviceUrl ?? ''} onChangeText={(v) => updateSub({ serviceUrl: v })} placeholder="https://..." placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />

                {/* Cancel URL */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t('add.cancel_url', 'Ссылка для отмены')}</Text>
                <TextInput style={[inputStyle, { marginBottom: 16 }]} value={sub.cancelUrl ?? ''} onChangeText={(v) => updateSub({ cancelUrl: v })} placeholder="https://..." placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />

                {/* Done → back to list */}
                <TouchableOpacity
                  onPress={() => fade(() => setUi({ kind: 'bulk', subs: ui.subs, checked: ui.checked }))}
                  style={{ backgroundColor: colors.primary, borderRadius: 14, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 }}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('common.done', 'Готово')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          );
        })()}

        {/* ── Confirm screen ───────────────────────────────────────────── */}
        {ui.kind === 'confirm' && (() => {
          const s = ui.subscription;
          const quick = QUICK.find(q => q.name.toLowerCase() === (s.name ?? '').toLowerCase());
          return (
            <View style={{ flex: 1 }}>
              <Text style={[styles.question, { color: colors.text }]}>
                {t('add.ai_q_confirm', 'Всё верно?')}
              </Text>
              <View style={[styles.confirmCard, { backgroundColor: card, borderColor: colors.border }]}>
                <View style={styles.confirmIcon}>
                  {quick
                    ? <quick.Icon size={52} />
                    : s.iconUrl
                      ? <Image source={{ uri: s.iconUrl }} style={{ width: 52, height: 52, borderRadius: 13 }} />
                      : (
                        <View style={[styles.fallbackIcon, { backgroundColor: colors.primary }]}>
                          <Text style={styles.fallbackLetter}>{(s.name ?? '?')[0].toUpperCase()}</Text>
                        </View>
                      )}
                </View>
                <Text style={[styles.confirmName,   { color: colors.text }]}>{s.name}</Text>
                <Text style={[styles.confirmAmount, { color: colors.primary }]}>
                  {s.currency ?? 'USD'} {(s.amount ?? 0).toFixed(2)}
                  <Text style={[styles.confirmPer, { color: colors.textSecondary }]}>
                    {'  ·  '}{(s.billingPeriod ?? 'MONTHLY').toLowerCase()}
                  </Text>
                </Text>
                {!!s.cancelUrl && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ExternalLinkIcon size={14} color={colors.primary} />
                    <Text style={[styles.confirmMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {s.cancelUrl}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })()}

        {/* ── Input / Question screen ───────────────────────────────────── */}
        {ui.kind !== 'confirm' && ui.kind !== 'plans' && ui.kind !== 'bulk' && ui.kind !== 'bulk-edit' && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.question, { color: colors.text }]}>{questionText}</Text>
            {!!hintText && !loadingStage && <Text style={[styles.hint, { color: colors.textSecondary }]}>{hintText}</Text>}

            {/* Loading stages indicator — shown for both voice and text */}
            {loadingStage ? (
              <LoadingIndicator stage={loadingStage} colors={colors} lang={i18n.language ?? 'en'} />
            ) : (
              <>
                {/* Big mic */}
                <MicButton onVoice={handleVoice} loadingStage={null} colors={colors} t={t} lang={i18n.language ?? 'en'} />

                {/* OR divider */}
                <View style={styles.orRow}>
                  <View style={[styles.line, { backgroundColor: colors.border }]} />
                  <Text style={[styles.orText, { color: colors.textMuted }]}>{t('common.or')}</Text>
                  <View style={[styles.line, { backgroundColor: colors.border }]} />
                </View>
              </>
            )}

            {/* Text input + chips — hidden during loading */}
            {!loadingStage && (
              <>
                <TextInput
                  testID="ai-wizard-input"
                  style={[styles.textInput, {
                    backgroundColor: bg,
                    color: colors.text,
                    borderColor: colors.border,
                    minHeight: 56,
                    maxHeight: 120,
                    textAlignVertical: 'top',
                    paddingTop: 14,
                  }]}
                  value={input}
                  onChangeText={setInput}
                  placeholder={ui.kind === 'idle' ? 'Netflix, Spotify, ChatGPT...' : ''}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={2}
                  blurOnSubmit={true}
                  returnKeyType="send"
                  onSubmitEditing={() => { if (input.trim()) { Keyboard.dismiss(); callWizard(input.trim()); } }}
                />

                {/* Quick chips — only on idle */}
                {ui.kind === 'idle' && (
                  <>
                    <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>{t('ai.popular_services')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {QUICK.map(svc => (
                        <TouchableOpacity
                          key={svc.name}
                          style={[styles.chip, { backgroundColor: card, borderColor: colors.border }]}
                          onPress={() => handleQuick(svc)}
                        >
                          <svc.Icon size={20} />
                          <Text style={[styles.chipText, { color: colors.text }]}>{svc.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            )}
          </View>
        )}

      </Animated.View>

      {/* ── Footer button ─────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        {/* bulk-edit screen has its own Done button — hide footer */}
        {ui.kind === 'bulk-edit' ? null : ui.kind === 'bulk' ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }, saving && { opacity: 0.6 }]}
            onPress={async () => {
              const selected = ui.subs.filter((_, i) => ui.checked[i]);
              if (!selected.length) {
                Alert.alert('', t('add.bulk_select_at_least_one', 'Выбери хотя бы одну'));
                return;
              }
              // Check limit for selected count
              if (!isPro) {
                const remaining = maxSubscriptions - activeCount;
                const toAdd = Math.min(selected.length, remaining);
                if (toAdd < selected.length) {
                  const trimmed = selected.slice(0, toAdd);
                  setSaving(true);
                  try { if (onSaveBulk) await onSaveBulk(trimmed); } catch {}
                  setSaving(false);
                  reset();
                  return;
                }
              }
              setSaving(true);
              try {
                if (onSaveBulk) await onSaveBulk(selected);
              } catch (err: any) {
                const errorData = err?.response?.data?.error || err?.response?.data;
                const msg = typeof errorData === 'string' ? errorData : errorData?.message || errorData?.message_key || err?.message || '';
                Alert.alert(t('common.error'), String(msg));
              } finally {
                setSaving(false);
              }
              reset();
            }}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-done" size={18} color="#fff" />
                <Text style={styles.actionTxt}>
                  {t('add.bulk_save', { count: ui.checked.filter(Boolean).length, defaultValue: `Добавить ${ui.checked.filter(Boolean).length}` })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : ui.kind === 'plans' ? (
          <TouchableOpacity
            style={{ alignItems: 'center', paddingVertical: 14 }}
            onPress={() => {
              onEdit({
                name: ui.serviceName,
                iconUrl: ui.iconUrl,
                serviceUrl: ui.serviceUrl,
                cancelUrl: ui.cancelUrl,
                category: ui.category,
              });
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <PencilIcon size={14} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
                {t('add.enter_manually', 'Ввести вручную')}
              </Text>
            </View>
          </TouchableOpacity>
        ) : ui.kind === 'confirm' ? (
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10B981' }, saving && { opacity: 0.6 }]}
              onPress={async () => {
                setSaving(true);
                try {
                  await onSave(ui.subscription);
                } catch (err: any) {
                  const errorData = err?.response?.data?.error || err?.response?.data;
                  const code = errorData?.code || '';
                  if (code === 'SUBSCRIPTION_LIMIT_REACHED' || err?.response?.status === 429) {
                    router.push('/paywall' as any);
                  } else {
                    const msg = typeof errorData === 'string' ? errorData : errorData?.message || errorData?.message_key || err?.message || 'Error';
                    Alert.alert(t('common.error'), String(msg));
                  }
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                )}
                <Text style={styles.actionTxt}>{t('add.ai_add', 'Добавить')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ alignItems: 'center', paddingVertical: 10 }}
              onPress={() => onEdit(ui.subscription)}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
                {t('add.edit_details', 'Редактировать детали')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }, (!input.trim() || loading) && { opacity: 0.4 }]}
            onPress={() => callWizard(input)}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.actionTxt}>{t('add.ai_next', 'Далее →')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  question:     { fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 2 },
  hint:         { fontSize: 14, marginBottom: 8 },
  micArea:      { alignItems: 'center', marginVertical: 18, position: 'relative' },
  micRing:      { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  micBtn:       { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', shadowColor: '#6C3BDB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  micHint:      { marginTop: 10, fontSize: 13 },
  orRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  line:         { flex: 1, height: 1 },
  orText:       { fontSize: 13 },
  textInput:    { borderRadius: 14, padding: 16, fontSize: 17, borderWidth: 1.5, marginBottom: 12 },
  quickLabel:   { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 30, borderWidth: 1, marginRight: 8 },
  chipText:     { fontSize: 13, fontWeight: '600' },
  confirmCard:  { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', gap: 10, marginTop: 8 },
  confirmIcon:  { marginBottom: 2 },
  fallbackIcon: { width: 52, height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fallbackLetter: { color: '#fff', fontSize: 24, fontWeight: '800' },
  confirmName:  { fontSize: 22, fontWeight: '800' },
  confirmAmount:{ fontSize: 26, fontWeight: '800' },
  confirmPer:   { fontSize: 15, fontWeight: '400' },
  confirmMeta:  { fontSize: 12, maxWidth: 260 },
  plansHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  plansLogo:    { width: 44, height: 44, borderRadius: 11 },
  plansTitle:   { fontSize: 24, fontWeight: '800' },
  plansSubtitle:{ fontSize: 14, marginBottom: 12 },
  planCard:     { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  planName:     { fontSize: 16, fontWeight: '700' },
  planPeriod:   { fontSize: 13, marginTop: 2 },
  planPrice:    { fontSize: 18, fontWeight: '800', marginRight: 8 },
  editLink:     { alignItems: 'center', marginTop: 14, padding: 8 },
  footer:       { paddingTop: 12 },
  actionBtn:    { borderRadius: 18, padding: 18, alignItems: 'center' },
  actionTxt:    { color: '#fff', fontSize: 17, fontWeight: '800' },
});

const bulkStyles = StyleSheet.create({
  card:        { borderRadius: 14, borderWidth: 1.5, padding: 12, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  iconBox:     { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconLetter:  { fontSize: 18, fontWeight: '800' },
  name:        { fontSize: 15, fontWeight: '700' },
  meta:        { fontSize: 12, marginTop: 2 },
  check:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  editPanel:   { width: '100%', marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.15)', gap: 10 },
  editRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editLabel:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  editInput:   { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6, fontSize: 15, fontWeight: '500' },
  periodChip:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
  doneBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
});
