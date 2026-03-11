import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Animated, StyleSheet, ScrollView, Easing,
} from 'react-native';
import Svg, { Circle, Path, Rect, G, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { aiApi } from '../api/ai';
import { VoiceRecorder } from './VoiceRecorder';

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

// SVG иконки популярных сервисов
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
      <Path d="M22.5 21.5c-.3 0-.5-.1-.7-.2-3.2-1.9-7.2-2.4-11.9-1.3-.5.1-1-.2-1.1-.7-.1-.5.2-1 .7-1.1 5.2-1.2 9.6-.7 13.2 1.5.4.3.6.8.3 1.3-.1.3-.3.5-.5.5zm1.5-3.3c-.3 0-.6-.1-.8-.3-3.6-2.2-9.1-2.9-13.4-1.6-.6.2-1.2-.2-1.3-.7-.2-.6.2-1.2.7-1.3 4.9-1.5 10.9-.8 15.1 1.8.5.3.7.9.4 1.5-.3.4-.5.6-.7.6zm.2-3.4c-.3 0-.6-.1-.9-.3-3.9-2.3-10.3-2.5-14-.8-.7.2-1.4-.1-1.6-.8-.2-.7.1-1.4.8-1.6 4.3-1.8 11.3-1.5 15.8 1 .6.4.8 1.1.5 1.7-.2.5-.6.8-.6.8z" fill="white" />
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
      <Path d="M16 7a9 9 0 000 18 9 9 0 000-18zm0 2a7 7 0 110 14A7 7 0 0116 9zm-3 7l2-3.5 2 3.5H13zm3 1.5l-2 3.5h4l-2-3.5z" fill="white" opacity="0.9" />
    </Svg>
  );
}

function AmazonIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#FF9900" />
      <Path d="M8 20c4 2.5 10 2.5 14-1" stroke="#232F3E" strokeWidth="2" strokeLinecap="round" />
      <Path d="M20 21l2-1-2 3" fill="#232F3E" />
      <Rect x="10" y="10" width="12" height="7" rx="2" fill="white" />
    </Svg>
  );
}

function AppleTVIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#1C1C1E" />
      <Path d="M12 12l4 8 4-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M16 12V8" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function MicIcon({ size = 28, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="2" width="6" height="11" rx="3" fill={color} />
      <Path d="M5 11a7 7 0 0014 0" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M12 18v4M9 22h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

const QUICK_SERVICES = [
  { name: 'Netflix',  Icon: NetflixIcon,  amount: 15.99, currency: 'USD', period: 'MONTHLY' },
  { name: 'Spotify',  Icon: SpotifyIcon,  amount: 9.99,  currency: 'USD', period: 'MONTHLY' },
  { name: 'iCloud',   Icon: ICloudIcon,   amount: 2.99,  currency: 'USD', period: 'MONTHLY' },
  { name: 'YouTube',  Icon: YouTubeIcon,  amount: 13.99, currency: 'USD', period: 'MONTHLY' },
  { name: 'ChatGPT',  Icon: ChatGPTIcon,  amount: 20.00, currency: 'USD', period: 'MONTHLY' },
  { name: 'Amazon',   Icon: AmazonIcon,   amount: 14.99, currency: 'USD', period: 'MONTHLY' },
  { name: 'Apple TV', Icon: AppleTVIcon,  amount: 9.99,  currency: 'USD', period: 'MONTHLY' },
] as const;

const PERIODS = [
  { key: 'MONTHLY',   label: 'Monthly' },
  { key: 'YEARLY',    label: 'Yearly' },
  { key: 'WEEKLY',    label: 'Weekly' },
  { key: 'QUARTERLY', label: 'Quarterly' },
] as const;

type Step = 'input' | 'amount' | 'confirm';

export function AIWizard({ onDone }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('input');
  const [sub, setSub] = useState<ParsedSub>({});
  const [nameInput, setNameInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY'>('MONTHLY');
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Pulse анимация для кнопки микрофона
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const transition = (fn: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setTimeout(fn, 120);
  };

  // Быстрый выбор популярного сервиса
  const handleQuickPick = (svc: typeof QUICK_SERVICES[number]) => {
    transition(() => {
      setSub({ name: svc.name, amount: svc.amount, currency: svc.currency, billingPeriod: svc.period as any });
      setStep('confirm');
    });
  };

  // Голос на шаге "input" — Whisper → lookup
  const handleVoiceInput = async (uri: string) => {
    if (!uri) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('audio', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
      const res = await aiApi.parseAudio(fd);
      const text = res.data?.text ?? '';
      setTranscript(text);
      const parsed = res.data?.subscriptions?.[0] ?? {};
      const name = parsed.name ?? text.trim();
      setNameInput(name);

      // Если AI сразу вернул сумму — переходим к confirm
      if (parsed.amount && parsed.amount > 0) {
        transition(() => {
          setSub({
            name,
            amount: parsed.amount,
            currency: parsed.currency ?? 'USD',
            billingPeriod: (parsed.billingPeriod ?? 'MONTHLY') as any,
            category: parsed.category,
          });
          setStep('confirm');
        });
      } else if (name) {
        // Иначе → шаг ввода суммы
        transition(() => {
          setSub({ name });
          setStep('amount');
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Голос на шаге "amount"
  const handleVoiceAmount = async (uri: string) => {
    if (!uri) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('audio', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
      const res = await aiApi.parseAudio(fd);
      const text = res.data?.text ?? '';
      const parsed = res.data?.subscriptions?.[0] ?? {};
      if (parsed.amount != null) {
        setAmountInput(String(parsed.amount));
      } else {
        const match = text.match(/[\d.,]+/);
        if (match) setAmountInput(match[0].replace(',', '.'));
      }
      if (parsed.billingPeriod) setPeriod(parsed.billingPeriod as any);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleNameNext = () => {
    if (!nameInput.trim()) return;
    transition(() => {
      setSub({ name: nameInput.trim() });
      setStep('amount');
    });
  };

  const handleAmountNext = () => {
    transition(() => {
      setSub(s => ({ ...s, amount: parseFloat(amountInput) || 0, currency: 'USD', billingPeriod: period }));
      setStep('confirm');
    });
  };

  const s = {
    bg: isDark ? '#1C1C2E' : '#F5F5F7',
    card: isDark ? '#252538' : '#FFFFFF',
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>

        {/* ── Шаг 1: Ввод названия ── */}
        {step === 'input' && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.question, { color: colors.text }]}>
              {t('add.ai_q_name', 'Что за подписка?')}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('add.ai_q_name_hint', 'Скажи или напечатай название сервиса')}
            </Text>

            {/* Большая кнопка микрофона */}
            <View style={styles.micWrap}>
              <Animated.View style={[styles.micPulse, { backgroundColor: colors.primary + '22', transform: [{ scale: pulseAnim }] }]} />
              <VoiceRecorder
                onRecordingComplete={handleVoiceInput}
                customButton={
                  <View style={[styles.micBtn, { backgroundColor: colors.primary }]}>
                    {loading
                      ? <ActivityIndicator color="#fff" size="large" />
                      : <MicIcon size={34} />}
                  </View>
                }
              />
              <Text style={[styles.micLabel, { color: colors.textSecondary }]}>
                {t('add.hold_to_record', 'Держи и говори')}
              </Text>
            </View>

            {/* Разделитель */}
            <View style={styles.orRow}>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textMuted }]}>или</Text>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            </View>

            {/* Текстовый ввод */}
            <TextInput
              style={[styles.input, { backgroundColor: s.bg, color: colors.text, borderColor: colors.border }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Netflix, Spotify..."
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              onSubmitEditing={handleNameNext}
            />

            {/* Популярные чипы */}
            <Text style={[styles.popularLabel, { color: colors.textSecondary }]}>Популярные</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {QUICK_SERVICES.map(svc => (
                <TouchableOpacity
                  key={svc.name}
                  style={[styles.chip, { backgroundColor: s.card, borderColor: colors.border }]}
                  onPress={() => handleQuickPick(svc)}
                >
                  <svc.Icon size={22} />
                  <Text style={[styles.chipText, { color: colors.text }]}>{svc.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Шаг 2: Сумма + период ── */}
        {step === 'amount' && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => setStep('input')} style={styles.backBtn}>
              <Text style={{ color: colors.primary, fontSize: 15 }}>← {sub.name}</Text>
            </TouchableOpacity>
            <Text style={[styles.question, { color: colors.text }]}>
              {t('add.ai_q_amount', 'Сколько платишь?')}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('add.ai_q_amount_hint', 'Скажи сумму или введи вручную')}
            </Text>

            <View style={styles.micWrap}>
              <Animated.View style={[styles.micPulse, { backgroundColor: colors.primary + '22', transform: [{ scale: pulseAnim }] }]} />
              <VoiceRecorder
                onRecordingComplete={handleVoiceAmount}
                customButton={
                  <View style={[styles.micBtn, { backgroundColor: colors.primary }]}>
                    {loading
                      ? <ActivityIndicator color="#fff" size="large" />
                      : <MicIcon size={34} />}
                  </View>
                }
              />
              <Text style={[styles.micLabel, { color: colors.textSecondary }]}>
                {t('add.hold_to_record', 'Держи и говори')}
              </Text>
            </View>

            <View style={styles.orRow}>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textMuted }]}>или</Text>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: s.bg, color: colors.text, borderColor: colors.border }]}
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder="15.99"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="next"
              autoFocus
            />

            <View style={styles.periodRow}>
              {PERIODS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodChip, { borderColor: colors.border, backgroundColor: s.bg },
                    period === p.key && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setPeriod(p.key as any)}
                >
                  <Text style={[styles.periodText, { color: period === p.key ? '#fff' : colors.text }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Шаг 3: Подтверждение ── */}
        {step === 'confirm' && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.question, { color: colors.text }]}>
              {t('add.ai_q_confirm', 'Всё верно?')}
            </Text>

            <View style={[styles.confirmCard, { backgroundColor: s.card, borderColor: colors.border }]}>
              {/* Иконка сервиса */}
              <View style={styles.confirmIcon}>
                {(() => {
                  const svc = QUICK_SERVICES.find(s => s.name.toLowerCase() === (sub.name ?? '').toLowerCase());
                  return svc ? <svc.Icon size={48} /> : (
                    <View style={[styles.confirmIconFallback, { backgroundColor: colors.primary }]}>
                      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
                        {(sub.name ?? '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <Text style={[styles.confirmName, { color: colors.text }]}>{sub.name}</Text>
              <Text style={[styles.confirmAmount, { color: colors.primary }]}>
                {sub.currency ?? 'USD'} {sub.amount?.toFixed(2) ?? '0.00'}
                <Text style={[styles.confirmPeriod, { color: colors.textSecondary }]}>
                  {' '}/ {(sub.billingPeriod ?? 'MONTHLY').toLowerCase()}
                </Text>
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.editLink]}
              onPress={() => setStep(sub.amount ? 'amount' : 'input')}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                ✏️  {t('add.ai_edit', 'Изменить')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </Animated.View>

      {/* ── Кнопка действия ── */}
      <View style={styles.footer}>
        {step === 'input' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }, !nameInput.trim() && { opacity: 0.4 }]}
            onPress={handleNameNext}
            disabled={!nameInput.trim()}
          >
            <Text style={styles.actionBtnText}>Далее →</Text>
          </TouchableOpacity>
        )}
        {step === 'amount' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }, !amountInput.trim() && { opacity: 0.4 }]}
            onPress={handleAmountNext}
            disabled={!amountInput.trim()}
          >
            <Text style={styles.actionBtnText}>Далее →</Text>
          </TouchableOpacity>
        )}
        {step === 'confirm' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={() => onDone(sub)}
          >
            <Text style={styles.actionBtnText}>✓  Добавить</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  question:    { fontSize: 26, fontWeight: '800', lineHeight: 32, marginBottom: 4 },
  hint:        { fontSize: 14, marginBottom: 12 },
  micWrap:     { alignItems: 'center', marginVertical: 20, position: 'relative' },
  micPulse:    { position: 'absolute', width: 90, height: 90, borderRadius: 45 },
  micBtn:      { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#6C3BDB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
  micLabel:    { marginTop: 10, fontSize: 13 },
  orRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  line:        { flex: 1, height: 1 },
  orText:      { fontSize: 13 },
  input:       { borderRadius: 14, padding: 16, fontSize: 17, borderWidth: 1.5, marginBottom: 14 },
  popularLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chipsScroll: { marginHorizontal: -4 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 30, borderWidth: 1, marginRight: 8 },
  chipText:    { fontSize: 14, fontWeight: '600' },
  backBtn:     { marginBottom: 16 },
  periodRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  periodChip:  { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1.5 },
  periodText:  { fontSize: 14, fontWeight: '600' },
  confirmCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8, marginTop: 8 },
  confirmIcon: { marginBottom: 4 },
  confirmIconFallback: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confirmName: { fontSize: 22, fontWeight: '800' },
  confirmAmount: { fontSize: 28, fontWeight: '800' },
  confirmPeriod: { fontSize: 16, fontWeight: '400' },
  editLink:    { alignItems: 'center', marginTop: 16, padding: 8 },
  footer:      { paddingTop: 12 },
  actionBtn:   { borderRadius: 18, padding: 18, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
