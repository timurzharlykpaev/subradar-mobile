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
  Animated, StyleSheet, ScrollView, Easing,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { aiApi } from '../api/ai';
import { VoiceRecorder } from './VoiceRecorder';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { Pressable } from 'react-native';

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
  onDone: (sub: ParsedSub) => void;
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
  { name: 'Netflix',   Icon: NetflixIcon,  amount: 15.99, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://www.netflix.com/cancelplan',   serviceUrl: 'https://netflix.com',    iconUrl: 'https://logo.clearbit.com/netflix.com' },
  { name: 'Spotify',   Icon: SpotifyIcon,  amount: 9.99,  currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://www.spotify.com/account/subscription/cancel', serviceUrl: 'https://spotify.com', iconUrl: 'https://logo.clearbit.com/spotify.com' },
  { name: 'iCloud',    Icon: ICloudIcon,   amount: 2.99,  currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://support.apple.com/billing',   serviceUrl: 'https://icloud.com',     iconUrl: 'https://logo.clearbit.com/apple.com' },
  { name: 'YouTube',   Icon: YouTubeIcon,  amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://youtube.com/paid_memberships', serviceUrl: 'https://youtube.com',    iconUrl: 'https://logo.clearbit.com/youtube.com' },
  { name: 'ChatGPT',   Icon: ChatGPTIcon,  amount: 20.00, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://help.openai.com/en/articles/7232013', serviceUrl: 'https://chat.openai.com', iconUrl: 'https://logo.clearbit.com/openai.com' },
  { name: 'Amazon',    Icon: AmazonIcon,   amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://www.amazon.com/mc/cancel',    serviceUrl: 'https://amazon.com',     iconUrl: 'https://logo.clearbit.com/amazon.com' },
  { name: 'Apple TV+', Icon: AppleTVIcon,  amount: 9.99,  currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://support.apple.com/billing',   serviceUrl: 'https://tv.apple.com',   iconUrl: 'https://logo.clearbit.com/apple.com' },
  { name: 'Disney+',   Icon: DisneyIcon,   amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY', cancelUrl: 'https://www.disneyplus.com/account/subscription', serviceUrl: 'https://disneyplus.com', iconUrl: 'https://logo.clearbit.com/disneyplus.com' },
] as const;

// ── MicButton ────────────────────────────────────────────────────────────────

function MicButton({ onVoice, loading, colors, t }: { onVoice: (uri: string) => void; loading: boolean; colors: any; t: any }) {
  const { isRecording, durationFmt, start, stop } = useVoiceRecorder(onVoice);

  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;

  // Пульс в покое
  React.useEffect(() => {
    if (isRecording) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ring1, { toValue: 1.18, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(ring1, { toValue: 1,    duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isRecording]);

  // Пульс при записи — быстрее и с двумя кольцами
  React.useEffect(() => {
    if (!isRecording) { ring1.setValue(1); ring2.setValue(1); return; }
    const l1 = Animated.loop(Animated.sequence([
      Animated.timing(ring1, { toValue: 1.35, duration: 600, useNativeDriver: true }),
      Animated.timing(ring1, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    const l2 = Animated.loop(Animated.sequence([
      Animated.timing(ring2, { toValue: 0,    duration: 0,   useNativeDriver: true }),
      Animated.timing(ring2, { toValue: 1.55, duration: 1200, useNativeDriver: true }),
      Animated.timing(ring2, { toValue: 0,    duration: 0,   useNativeDriver: true }),
    ]));
    l1.start(); l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, [isRecording]);

  const bg = isRecording ? '#EF4444' : colors.primary;

  return (
    <View style={micStyles.wrap}>
      {/* Фоновые кольца */}
      <Animated.View style={[micStyles.ring, { backgroundColor: bg + '18', transform: [{ scale: ring2 }] }]} />
      <Animated.View style={[micStyles.ring, { backgroundColor: bg + '25', transform: [{ scale: ring1 }] }]} />

      <Pressable onPressIn={start} onPressOut={stop} style={micStyles.pressable}>
        <View style={[micStyles.btn, { backgroundColor: bg, shadowColor: bg }]}>
          {loading
            ? <ActivityIndicator color="#fff" size="large" />
            : isRecording
              ? <StopSvg />
              : <MicSvg size={34} />}
        </View>
      </Pressable>

      <Text style={[micStyles.label, { color: colors.textSecondary }]}>
        {loading
          ? t('common.loading', 'Распознаю...')
          : isRecording
            ? durationFmt
            : t('add.hold_to_record', 'Держи и говори')}
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
  wrap:      { alignItems: 'center', marginVertical: 20 },
  ring:      { position: 'absolute', width: 110, height: 110, borderRadius: 55, top: '50%', marginTop: -55 },
  pressable: { zIndex: 2 },
  btn:       { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 10 },
  label:     { marginTop: 52, fontSize: 13, fontWeight: '500' },
});

// ── Component ────────────────────────────────────────────────────────────────

type UIState =
  | { kind: 'idle' }
  | { kind: 'question'; text: string; field: string }
  | { kind: 'confirm'; subscription: ParsedSub };

export function AIWizard({ onDone }: Props) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();

  const [ui, setUi] = useState<UIState>({ kind: 'idle' });
  const [input, setInput] = useState('');
  const [context, setContext] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

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

  // ── Call backend wizard ──────────────────────────────────────────────────
  const callWizard = async (message: string) => {
    if (!message.trim()) return;
    setLoading(true);
    try {
      const res = await aiApi.wizard(message, context, i18n.language ?? 'en');
      const data = res.data;
      if (data.done && data.subscription) {
        const newCtx = { ...context, ...data.partialContext };
        setContext(newCtx);
        fade(() => setUi({ kind: 'confirm', subscription: data.subscription }));
      } else if (!data.done && data.question) {
        const newCtx = { ...context, ...(data.partialContext ?? {}) };
        setContext(newCtx);
        fade(() => setUi({ kind: 'question', text: data.question, field: data.field ?? 'clarify' }));
      }
    } catch {
      // fallback: treat input as name, proceed manually
      fade(() => setUi({ kind: 'confirm', subscription: { name: message.trim(), amount: 0, currency: 'USD', billingPeriod: 'MONTHLY' } }));
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  // ── Voice handler ────────────────────────────────────────────────────────
  const handleVoice = async (uri: string) => {
    if (!uri) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('audio', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
      const res = await aiApi.parseAudio(fd);
      const text: string = res.data?.text ?? '';
      if (text.trim()) {
        setInput(text);
        await callWizard(text);
      }
    } catch {
      // ignore
    } finally {
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
    <View style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

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
                  <Text style={[styles.confirmMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    🔗 {s.cancelUrl}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={reset} style={styles.editLink}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                  ✏️  {t('add.ai_edit', 'Изменить')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── Input / Question screen ───────────────────────────────────── */}
        {ui.kind !== 'confirm' && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.question, { color: colors.text }]}>{questionText}</Text>
            {!!hintText && <Text style={[styles.hint, { color: colors.textSecondary }]}>{hintText}</Text>}

            {/* Big mic */}
            <MicButton onVoice={handleVoice} loading={loading} colors={colors} t={t} />

            {/* OR divider */}
            <View style={styles.orRow}>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textMuted }]}>или</Text>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            </View>

            {/* Text input */}
            <TextInput
              style={[styles.textInput, { backgroundColor: bg, color: colors.text, borderColor: colors.border }]}
              value={input}
              onChangeText={setInput}
              placeholder={ui.kind === 'idle' ? 'Netflix, Spotify...' : ''}
              placeholderTextColor={colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={() => callWizard(input)}
            />

            {/* Quick chips — only on idle */}
            {ui.kind === 'idle' && (
              <>
                <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>Популярные</Text>
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
        {ui.kind === 'confirm' ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={() => onDone(ui.subscription)}
          >
            <Text style={styles.actionTxt}>✓  {t('add.ai_add', 'Добавить')}</Text>
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
    </View>
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
  editLink:     { alignItems: 'center', marginTop: 14, padding: 8 },
  footer:       { paddingTop: 12 },
  actionBtn:    { borderRadius: 18, padding: 18, alignItems: 'center' },
  actionTxt:    { color: '#fff', fontSize: 17, fontWeight: '800' },
});
