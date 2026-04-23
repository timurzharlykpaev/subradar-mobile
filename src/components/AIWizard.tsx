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
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Animated, StyleSheet, Keyboard, TouchableWithoutFeedback, Alert,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { reportError } from '../utils/errorReporter';
import { useTranslation } from 'react-i18next';
import { aiApi } from '../api/ai';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { useRouter } from 'expo-router';

// ParsedSub is the canonical draft shape for the AI-driven add-subscription
// pipeline. Definition lives in `add-subscription/types` so all participants
// (wizard, confirm, bulk list, bulk edit) can import without pulling in this
// 1200-line component. Re-exported here for backward compatibility.
export type { ParsedSub } from './add-subscription/types';
import type { ParsedSub } from './add-subscription/types';
import { BulkEditStage } from './ai-wizard/BulkEditStage';
import { BulkListStage } from './ai-wizard/BulkListStage';
import { QuestionStage } from './ai-wizard/QuestionStage';
import { ConfirmStage } from './ai-wizard/ConfirmStage';
import { PlansStage } from './ai-wizard/PlansStage';
import { VoiceInputStage, type QuickServiceRow } from './ai-wizard/VoiceInputStage';
import type { PlanOption as SharedPlanOption, LoadingStage } from './ai-wizard/types';

interface Props {
  onSave: (sub: ParsedSub) => Promise<void>;
  onSaveBulk?: (subs: ParsedSub[]) => Promise<void>;
  onEdit: (sub: ParsedSub) => void;
}

// ── SVG иконки ──────────────────────────────────────────────────────────────
// TODO(perf): extract the 8 inline SVG icon components + the QUICK[] catalog
// into `ai-wizard/quickServices.tsx`. They account for ~70 lines of this
// file, never change per-render, and are only consumed by QUICK.find(...)
// in PlansStage/ConfirmStage and by `quickServices` on VoiceInputStage.
// Left in-place for this cleanup pass per the C5 scope (cleanup-only).

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

// ── Component ────────────────────────────────────────────────────────────────

type PlanOption = SharedPlanOption;

type UIState =
  | { kind: 'idle' }
  | { kind: 'question'; text: string; field: string }
  | { kind: 'confirm'; subscription: ParsedSub }
  | { kind: 'bulk'; subs: ParsedSub[]; checked: boolean[] }
  | { kind: 'bulk-edit'; subs: ParsedSub[]; checked: boolean[]; editIdx: number }
  | { kind: 'plans'; plans: PlanOption[]; serviceName: string; iconUrl?: string; serviceUrl?: string; cancelUrl?: string; category?: string };

export function AIWizard({ onSave, onSaveBulk, onEdit }: Props) {
  const { colors } = useTheme();
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
  const router = useRouter();

  const [ui, setUi] = useState<UIState>({ kind: 'idle' });
  const [input, setInput] = useState('');
  const [context, setContext] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(null);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Cross-stage fade (plans → confirm, bulk → bulk-edit, etc.).
  // The mic pulse animation now lives inside `VoiceInputStage`.
  const fadeAnim = useRef(new Animated.Value(1)).current;

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

  // ── Bulk-list row callbacks ──────────────────────────────────────────────
  // Stable (i: number) => void handlers passed down to each memoized
  // BulkRow. Toggling row i now only re-renders that row — the other
  // rows see the same props and bail out at React.memo.
  const handleBulkToggle = useCallback((i: number) => {
    setUi((prev) => {
      if (prev.kind !== 'bulk') return prev;
      const nextChecked = [...prev.checked];
      nextChecked[i] = !nextChecked[i];
      return { ...prev, checked: nextChecked };
    });
  }, []);

  const handleBulkEdit = useCallback((i: number) => {
    // Preserve the cross-stage fade animation (bulk → bulk-edit).
    // `setUi` inside `fade` runs on the next tick so the new tree
    // fades in together with the state transition.
    fade(() =>
      setUi((prev) => {
        if (prev.kind !== 'bulk') return prev;
        return { kind: 'bulk-edit', subs: prev.subs, checked: prev.checked, editIdx: i };
      }),
    );
  }, []);

  const handleBulkRemove = useCallback((i: number) => {
    setUi((prev) => {
      if (prev.kind !== 'bulk') return prev;
      const newSubs = prev.subs.filter((_, j) => j !== i);
      const newChecked = prev.checked.filter((_, j) => j !== i);
      if (newSubs.length === 0) {
        // Last item removed — bounce back to the idle input stage.
        setInput('');
        setContext({});
        return { kind: 'idle' };
      }
      return { ...prev, subs: newSubs, checked: newChecked };
    });
    setEditingIndex((cur) => (cur === i ? null : cur));
  }, []);

  const handleBulkSelectAll = useCallback(() => {
    setUi((prev) => {
      if (prev.kind !== 'bulk') return prev;
      return { ...prev, checked: prev.subs.map(() => true) };
    });
  }, []);

  const handleBulkDeselectAll = useCallback(() => {
    setUi((prev) => {
      if (prev.kind !== 'bulk') return prev;
      return { ...prev, checked: prev.subs.map(() => false) };
    });
  }, []);

  // ── BulkEditStage callbacks ──────────────────────────────────────────────
  // `BulkEditStage` is `React.memo` — inline closures would defeat it.
  // `onUpdate` applies a partial patch to the currently-edited sub;
  // `exitBulkEdit` fades back to the `bulk` list (used by both Done and
  // Cancel — the distinction lives inside the stage).
  const handleBulkEditUpdate = useCallback((patch: Partial<ParsedSub>) => {
    setUi((prev) => {
      if (prev.kind !== 'bulk-edit') return prev;
      const nextSubs = [...prev.subs];
      nextSubs[prev.editIdx] = { ...nextSubs[prev.editIdx], ...patch };
      return { ...prev, subs: nextSubs };
    });
  }, []);

  const exitBulkEdit = useCallback(() => {
    fade(() =>
      setUi((prev) => {
        if (prev.kind !== 'bulk-edit') return prev;
        return { kind: 'bulk', subs: prev.subs, checked: prev.checked };
      }),
    );
  }, []);

  // ── Stable stage callbacks ───────────────────────────────────────────────
  // `callWizard`, `onEdit`, `onSave`, `handleVoice`, `handleQuick` are
  // recreated on each render. We stash the latest refs in `latestRef` so
  // the useCallback wrappers below stay stable across renders — critical
  // for `React.memo` on the extracted VoiceInputStage / QuestionStage /
  // ConfirmStage / PlansStage to actually skip re-renders.
  const latestRef = useRef({ callWizard, onSave, onEdit, handleVoice, handleQuick });
  latestRef.current = { callWizard, onSave, onEdit, handleVoice, handleQuick };

  const handleAnswer = useCallback((value: string) => {
    latestRef.current.callWizard(value);
  }, []);

  const handleCancel = useCallback(() => {
    setUi({ kind: 'idle' });
    setInput('');
    setContext({});
  }, []);

  const handleConfirmSave = useCallback(async (sub: ParsedSub) => {
    try {
      await latestRef.current.onSave(sub);
    } catch (err: any) {
      const errorData = err?.response?.data?.error || err?.response?.data;
      const code = errorData?.code || '';
      if (code === 'SUBSCRIPTION_LIMIT_REACHED' || err?.response?.status === 429) {
        router.push('/paywall' as any);
      } else {
        const msg =
          typeof errorData === 'string'
            ? errorData
            : errorData?.message || errorData?.message_key || err?.message || 'Error';
        Alert.alert(t('common.error'), String(msg));
      }
    }
  }, [router, t]);

  const handleConfirmEdit = useCallback((sub: ParsedSub) => {
    latestRef.current.onEdit(sub);
  }, []);

  // Mirror of `ui` available inside stable-identity callbacks. We could
  // read `ui` directly if the callback were recreated, but then
  // `React.memo` wouldn't be able to skip the stage re-render.
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const handleSelectPlan = useCallback((plan: PlanOption) => {
    const current = uiRef.current;
    if (current.kind !== 'plans') return;
    const sub: ParsedSub = {
      name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      billingPeriod: plan.billingPeriod as ParsedSub['billingPeriod'],
      category: current.category,
      serviceUrl: current.serviceUrl,
      cancelUrl: current.cancelUrl,
      iconUrl: current.iconUrl,
    };
    // Cross-stage fade so the plans list fades out as the confirm card fades in.
    fade(() => setUi({ kind: 'confirm', subscription: sub }));
  }, []);

  const handleEditManually = useCallback(() => {
    const current = uiRef.current;
    if (current.kind !== 'plans') return;
    latestRef.current.onEdit({
      name: current.serviceName,
      iconUrl: current.iconUrl,
      serviceUrl: current.serviceUrl,
      cancelUrl: current.cancelUrl,
      category: current.category,
    });
  }, []);

  // ── VoiceInputStage callbacks ────────────────────────────────────────────
  // Stable identities so the memoized stage doesn't thrash on parent
  // re-renders (e.g. while `loading` toggles between `false` and `true`).
  const handleVoiceStable = useCallback((uri: string) => {
    latestRef.current.handleVoice(uri);
  }, []);

  const handleSubmitStable = useCallback((value: string) => {
    latestRef.current.callWizard(value);
  }, []);

  const handleQuickStable = useCallback((svc: QuickServiceRow) => {
    // VoiceInputStage widens the row type; cast back to the concrete
    // QUICK entry shape (narrow literal `billingPeriod`, `amount`, etc.)
    // since the parent knows it only renders chips built from QUICK.
    latestRef.current.handleQuick(svc as typeof QUICK[number]);
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View testID="ai-wizard" style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* ── Plans selection screen ──────────────────────────────────────
            Extracted to `ai-wizard/PlansStage`. Each plan row is
            individually memoized so tapping one doesn't re-render the
            others. Footer "Enter manually" lives inside the stage. */}
        {ui.kind === 'plans' && (
          <PlansStage
            plans={ui.plans}
            serviceName={ui.serviceName}
            iconUrl={ui.iconUrl}
            serviceUrl={ui.serviceUrl}
            cancelUrl={ui.cancelUrl}
            category={ui.category}
            QuickIcon={
              QUICK.find((q) => q.name.toLowerCase() === (ui.serviceName ?? '').toLowerCase())
                ?.Icon
            }
            onSelectPlan={handleSelectPlan}
            onEditManually={handleEditManually}
          />
        )}

        {/* ── Bulk confirm screen ───────────────────────────────────────
            Extracted to `ai-wizard/BulkListStage`. Rows are individually
            memoized so toggling one checkbox in a 20-item list doesn't
            cascade re-renders across the whole tree. */}
        {ui.kind === 'bulk' && (
          <BulkListStage
            subs={ui.subs}
            checked={ui.checked}
            editingIndex={editingIndex}
            onToggle={handleBulkToggle}
            onEdit={handleBulkEdit}
            onRemove={handleBulkRemove}
            onSelectAll={handleBulkSelectAll}
            onDeselectAll={handleBulkDeselectAll}
          />
        )}

        {/* ── Bulk-edit detail screen ─────────────────────────────────────
            Extracted to `ai-wizard/BulkEditStage` and wrapped in
            KeyboardAvoidingView — fixes the bug where the keyboard
            covered the input on iOS. */}
        {ui.kind === 'bulk-edit' && ui.subs[ui.editIdx] && (
          <BulkEditStage
            sub={ui.subs[ui.editIdx]}
            index={ui.editIdx}
            onUpdate={handleBulkEditUpdate}
            onDone={exitBulkEdit}
            onCancel={exitBulkEdit}
          />
        )}

        {/* ── Confirm screen ─────────────────────────────────────────────
            Extracted to `ai-wizard/ConfirmStage`. Stage owns its local
            `saving` flag and renders its own Add / Edit footer.
            Paywall-redirect on limit errors lives in `handleConfirmSave`. */}
        {ui.kind === 'confirm' && (
          <ConfirmStage
            subscription={ui.subscription}
            QuickIcon={
              QUICK.find((q) => q.name.toLowerCase() === (ui.subscription.name ?? '').toLowerCase())
                ?.Icon
            }
            onSave={handleConfirmSave}
            onEdit={handleConfirmEdit}
          />
        )}

        {/* ── Question screen ─────────────────────────────────────────────
            Extracted to `ai-wizard/QuestionStage`. Owns its answer buffer
            locally (was piggybacking on the orchestrator's `input` state)
            and ships a DoneAccessoryInput + its own Next / Cancel footer. */}
        {ui.kind === 'question' && (
          <QuestionStage
            text={ui.text}
            field={ui.field}
            onAnswer={handleAnswer}
            onCancel={handleCancel}
          />
        )}

        {/* ── Idle input screen — mic, chips, text input ─────────────────
            Extracted to `ai-wizard/VoiceInputStage`. The stage owns the
            mic pulse animation, `useVoiceRecorder`, and the loading
            indicator; we feed it the controlled text input and stable
            callbacks so `React.memo` can skip unrelated parent re-renders. */}
        {ui.kind === 'idle' && (
          <VoiceInputStage
            loadingStage={loadingStage}
            onVoice={handleVoiceStable}
            input={input}
            onChangeInput={setInput}
            onSubmit={handleSubmitStable}
            onQuickSelect={handleQuickStable}
            quickServices={QUICK}
          />
        )}

      </Animated.View>

      {/* ── Footer button ───────────────────────────────────────────────────
          Only idle and bulk footers live here. The confirm, plans,
          question, and bulk-edit stages each render their own footer
          inside the stage (so the button fades with its content). */}
      {(ui.kind === 'idle' || ui.kind === 'bulk') && (
        <View style={styles.footer}>
          {ui.kind === 'bulk' ? (
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
      )}
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  footer:    { paddingTop: 12 },
  actionBtn: { borderRadius: 18, padding: 18, alignItems: 'center' },
  actionTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
