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
  Animated, StyleSheet, ScrollView, Easing, Keyboard, TouchableWithoutFeedback, Alert, Image,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { ExternalLinkIcon, PencilIcon } from './icons';
import { aiApi } from '../api/ai';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { Pressable } from 'react-native';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';

export interface ParsedSub {
  name?: string;
  amount?: number;
  currency?: string;
  billingPeriod?: 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY';
  category?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  iconUrl?: string;
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

// ── MicButton ────────────────────────────────────────────────────────────────

function MicButton({ onVoice, loading, colors, t }: { onVoice: (uri: string) => void; loading: boolean; colors: any; t: any }) {
  const { isRecording, durationFmt, start, stop } = useVoiceRecorder(onVoice);
  const ring1 = useRef(new Animated.Value(1)).current;

  // Single gentle pulse — no heavy dual-ring animation
  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ring1, { toValue: isRecording ? 1.3 : 1.15, duration: isRecording ? 500 : 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(ring1, { toValue: 1, duration: isRecording ? 500 : 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isRecording]);

  const bg = isRecording ? '#EF4444' : colors.primary;

  const toggle = () => {
    if (isRecording) stop();
    else start();
  };

  return (
    <View style={micStyles.wrap}>
      <Animated.View style={[micStyles.ring, { backgroundColor: bg + '20', transform: [{ scale: ring1 }] }]} />

      <Pressable onPress={toggle} style={micStyles.pressable}>
        <View style={[micStyles.btn, { backgroundColor: bg, shadowColor: bg }]}>
          {loading
            ? <ActivityIndicator color="#fff" size="large" />
            : isRecording
              ? <StopSvg />
              : <MicSvg size={34} />}
        </View>
      </Pressable>

      <Text style={[micStyles.label, { color: isRecording ? '#EF4444' : colors.textSecondary }]}>
        {loading
          ? t('common.loading', 'Распознаю...')
          : isRecording
            ? durationFmt
            : t('add.tap_to_record', 'Нажми для записи')}
      </Text>
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

const micStyles = StyleSheet.create({
  wrap:      { alignItems: 'center', justifyContent: 'center', marginVertical: 16, height: 150 },
  ring:      { position: 'absolute', width: 120, height: 120, borderRadius: 60, top: 15, alignSelf: 'center' },
  pressable: { zIndex: 2 },
  btn:       { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 10 },
  label:     { position: 'absolute', bottom: -4, fontSize: 13, fontWeight: '500' },
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
  | { kind: 'plans'; plans: PlanOption[]; serviceName: string; iconUrl?: string; serviceUrl?: string; cancelUrl?: string; category?: string };

export function AIWizard({ onSave, onSaveBulk, onEdit }: Props) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const userCurrency = require('../stores/settingsStore').useSettingsStore((s: any) => s.currency) ?? 'USD';
  const { isPro, activeCount, maxSubscriptions } = usePlanLimits();
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);

  const [ui, setUi] = useState<UIState>({ kind: 'idle' });
  const [input, setInput] = useState('');
  const [context, setContext] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      Alert.alert(
        t('add.limit_reached_title', 'Лимит подписок'),
        t('add.limit_reached_msg', `Бесплатный план — максимум ${maxSubscriptions} подписки. Обнови до Pro для безлимита.`),
        [{ text: t('subscription_plan.upgrade_pro', 'Upgrade to Pro') }, { text: t('common.cancel', 'Закрыть'), style: 'cancel' }]
      );
      return false;
    }
    if (needed > remaining) {
      Alert.alert(
        t('add.limit_partial_title', 'Частичное добавление'),
        t('add.limit_partial_msg', `Лимит: осталось ${remaining} из ${maxSubscriptions}. Добавим первые ${remaining}.`),
        [{ text: 'OK' }]
      );
    }
    return true;
  };

  // ── Call backend wizard ──────────────────────────────────────────────────
  const callWizard = async (message: string) => {
    if (!message.trim()) return;

    // Auto-detect bulk: if message looks like a list (commas/newlines/multiple amounts)
    const looksLikeBulk = /[,\n]/.test(message) && (message.match(/\d+/g) || []).length >= 2;

    if (looksLikeBulk) {
      setLoading(true);
      try {
        const res = await aiApi.parseBulkText(message, i18n.language ?? 'ru');
        const data = res.data;
        const subs: ParsedSub[] = Array.isArray(data) ? data : (data.subscriptions ?? []);
        if (subs.length > 1) {
          if (!checkLimit(subs.length)) { setLoading(false); setInput(''); return; }
          fade(() => setUi({ kind: 'bulk', subs, checked: subs.map(() => true) }));
          setLoading(false);
          setInput('');
          return;
        }
        // Only 1 result — fall through to wizard below
      } catch {
        // fall through to wizard
      } finally {
        setLoading(false);
      }
    }

    // Single subscription wizard flow
    if (!checkLimit(1)) { setInput(''); return; }

    setLoading(true);
    const newHistory = [...history, { role: 'user' as const, content: message }];
    setHistory(newHistory);
    try {
      const contextWithCurrency = { ...context, preferredCurrency: userCurrency };
      const res = await aiApi.wizard(message, contextWithCurrency, i18n.language ?? 'en', newHistory);
      const data = res.data;
      if (data.done && data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
        const newCtx = { ...context, ...data.partialContext };
        setContext(newCtx);
        setHistory((h) => [...h, { role: 'assistant', content: JSON.stringify(data) }]);
        fade(() => setUi({
          kind: 'plans',
          plans: data.plans,
          serviceName: data.serviceName ?? '',
          iconUrl: data.iconUrl,
          serviceUrl: data.serviceUrl,
          cancelUrl: data.cancelUrl,
          category: data.category,
        }));
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
    } catch {
      fade(() => setUi({ kind: 'question', text: t('ai.could_not_parse'), field: 'clarify' }));
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  // ── Voice handler ────────────────────────────────────────────────────────
  const handleVoice = async (uri: string) => {
    if (!uri) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
      fd.append('locale', i18n.language ?? 'en');
      const transcribeRes = await aiApi.parseAudio(fd);
      const text: string = transcribeRes.data?.text ?? '';
      if (!text.trim()) {
        Alert.alert(t('ai.voice_error_title'), t('ai.voice_empty'));
        setLoading(false);
        return;
      }
      setInput(text);
      await callWizard(text);
    } catch (err) {
      console.warn('AIWizard voice error:', err);
      Alert.alert(t('ai.voice_error_title'), t('ai.voice_error'));
      setLoading(false);
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
                        <Text style={[styles.fallbackLetter, { fontSize: 20 }]}>{(ui.serviceName ?? '?')[0].toUpperCase()}</Text>
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
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {ui.subs.map((sub, i) => {
                const isChecked = ui.checked[i] ?? true;
                const periodMap: Record<string, string> = { MONTHLY: '/мес', YEARLY: '/год', WEEKLY: '/нед', QUARTERLY: '/квар' };
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      const next = [...ui.checked];
                      next[i] = !next[i];
                      setUi({ ...ui, checked: next });
                    }}
                    style={[bulkStyles.card, {
                      backgroundColor: isChecked ? colors.primary + '12' : (isDark ? '#1C1C2E' : '#F5F5F7'),
                      borderColor: isChecked ? colors.primary : colors.border,
                    }]}
                    activeOpacity={0.75}
                  >
                    <View style={[bulkStyles.iconBox, { backgroundColor: colors.primary + '18' }]}>
                      <Text style={[bulkStyles.iconLetter, { color: colors.primary }]}>
                        {(sub.name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[bulkStyles.name, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
                      <Text style={[bulkStyles.meta, { color: colors.textMuted }]}>
                        {sub.currency ?? 'USD'} {(sub.amount ?? 0).toFixed(2)}{periodMap[sub.billingPeriod ?? 'MONTHLY'] ?? ''}
                      </Text>
                    </View>
                    <View style={[bulkStyles.check, { borderColor: isChecked ? colors.primary : colors.border, backgroundColor: isChecked ? colors.primary : 'transparent' }]}>
                      {isChecked && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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
        {ui.kind !== 'confirm' && ui.kind !== 'plans' && ui.kind !== 'bulk' && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.question, { color: colors.text }]}>{questionText}</Text>
            {!!hintText && <Text style={[styles.hint, { color: colors.textSecondary }]}>{hintText}</Text>}

            {/* Big mic */}
            <MicButton onVoice={handleVoice} loading={loading} colors={colors} t={t} />

            {/* OR divider */}
            <View style={styles.orRow}>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textMuted }]}>{t('common.or')}</Text>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            </View>

            {/* Text input — multiline textarea */}
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
          </View>
        )}

      </Animated.View>

      {/* ── Footer button ─────────────────────────────────────────────────── */}
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
                Alert.alert(t('common.error'), err?.response?.data?.message || err?.message || '');
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
                  {t('add.bulk_save', `Добавить ${ui.checked.filter(Boolean).length}`)}
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
                  const msg = err?.response?.data?.message || err?.message || 'Error';
                  Alert.alert(t('common.error'), msg);
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
  card:     { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, padding: 12, marginBottom: 8 },
  iconBox:  { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconLetter: { fontSize: 18, fontWeight: '800' },
  name:     { fontSize: 15, fontWeight: '700' },
  meta:     { fontSize: 12, marginTop: 2 },
  check:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
