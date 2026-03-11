import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Animated, StyleSheet,
} from 'react-native';
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

const PERIODS = [
  { key: 'MONTHLY', label: 'Monthly' },
  { key: 'YEARLY', label: 'Yearly' },
  { key: 'WEEKLY', label: 'Weekly' },
  { key: 'QUARTERLY', label: 'Quarterly' },
] as const;

const TOTAL_STEPS = 4;

export function AIWizard({ onDone }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY'>('MONTHLY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Анимация перехода между шагами
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goNext = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setError('');
    setStep(s => s + 1);
  };

  // Голос → Whisper → заполняем поле + авто-переход
  const handleVoice = async (uri: string) => {
    if (!uri) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('audio', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
      const res = await aiApi.parseAudio(fd);
      const transcript: string = res.data?.text ?? '';

      if (step === 0) {
        // Из транскрипта вытаскиваем имя сервиса
        const parsed = res.data?.subscriptions?.[0];
        setName(parsed?.name ?? transcript.trim());
        goNext();
      } else if (step === 1) {
        // Вытаскиваем сумму — берём первое число
        const parsed = res.data?.subscriptions?.[0];
        if (parsed?.amount != null) {
          setAmount(String(parsed.amount));
        } else {
          const match = transcript.match(/[\d.,]+/);
          setAmount(match ? match[0].replace(',', '.') : transcript.trim());
        }
        goNext();
      } else if (step === 2) {
        // Определяем период из голоса
        const lower = transcript.toLowerCase();
        if (lower.includes('year') || lower.includes('год') || lower.includes('annual')) setPeriod('YEARLY');
        else if (lower.includes('week') || lower.includes('недел')) setPeriod('WEEKLY');
        else if (lower.includes('quarter') || lower.includes('кварт')) setPeriod('QUARTERLY');
        else setPeriod('MONTHLY');
        goNext();
      }
    } catch {
      setError('Не удалось распознать голос. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    onDone({
      name,
      amount: parseFloat(amount) || 0,
      currency: 'USD',
      billingPeriod: period,
    });
  };

  const inputStyle = {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 8,
    minHeight: 54,
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Прогресс */}
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[
            styles.progressDot,
            { backgroundColor: i <= step ? colors.primary : colors.border },
            i < step && { width: 24 },
          ]} />
        ))}
      </View>

      <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>

        {/* Шаг 0: Название */}
        {step === 0 && (
          <View>
            <Text style={[styles.question, { color: colors.text }]}>
              {t('add.ai_q_name', 'Что за подписка?')}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('add.ai_q_name_hint', 'Например: Netflix, Spotify, ChatGPT...')}
            </Text>
            <TextInput
              style={inputStyle}
              value={name}
              onChangeText={setName}
              placeholder="Netflix"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => name.trim() && goNext()}
            />
            <VoiceRecorder onRecordingComplete={handleVoice} />
          </View>
        )}

        {/* Шаг 1: Сумма */}
        {step === 1 && (
          <View>
            <Text style={[styles.question, { color: colors.text }]}>
              {t('add.ai_q_amount', 'Сколько платишь?')}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('add.ai_q_amount_hint', 'Например: 15, 9.99, 300...')}
            </Text>
            <TextInput
              style={inputStyle}
              value={amount}
              onChangeText={setAmount}
              placeholder="15"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => amount.trim() && goNext()}
            />
            <VoiceRecorder onRecordingComplete={handleVoice} />
          </View>
        )}

        {/* Шаг 2: Период */}
        {step === 2 && (
          <View>
            <Text style={[styles.question, { color: colors.text }]}>
              {t('add.ai_q_period', 'Как часто платишь?')}
            </Text>
            <View style={styles.periodGrid}>
              {PERIODS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.periodChip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    period === p.key && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setPeriod(p.key)}
                >
                  <Text style={[
                    styles.periodChipText,
                    { color: period === p.key ? '#fff' : colors.text },
                  ]}>
                    {t(`add.period_${p.key.toLowerCase()}`, p.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <VoiceRecorder onRecordingComplete={handleVoice} />
          </View>
        )}

        {/* Шаг 3: Подтверждение */}
        {step === 3 && (
          <View>
            <Text style={[styles.question, { color: colors.text }]}>
              {t('add.ai_q_confirm', 'Всё верно?')}
            </Text>
            <View style={[styles.confirmCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Row label="Сервис" value={name} colors={colors} />
              <Row label="Сумма" value={`${amount} USD`} colors={colors} />
              <Row label="Период" value={period} colors={colors} />
            </View>
            <TouchableOpacity
              style={[styles.editBtn, { borderColor: colors.border }]}
              onPress={() => setStep(0)}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                ✏️  {t('add.ai_edit', 'Изменить')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ошибка */}
        {!!error && (
          <Text style={[styles.error, { color: '#EF4444' }]}>{error}</Text>
        )}

      </Animated.View>

      {/* Кнопка действия */}
      <View style={styles.footer}>
        {step < 3 ? (
          <TouchableOpacity
            style={[
              styles.nextBtn,
              { backgroundColor: colors.primary },
              ((step === 0 && !name.trim()) || (step === 1 && !amount.trim()) || loading) && { opacity: 0.45 },
            ]}
            onPress={goNext}
            disabled={loading || (step === 0 && !name.trim()) || (step === 1 && !amount.trim())}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.nextBtnText}>{t('add.ai_next', 'Далее →')}</Text>
            }
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: '#10B981' }]}
            onPress={handleConfirm}
          >
            <Text style={styles.nextBtnText}>✓  {t('add.ai_add', 'Добавить')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 28, alignItems: 'center' },
  progressDot: { width: 8, height: 8, borderRadius: 4 },
  stepContainer: { flex: 1 },
  question: { fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 4 },
  hint: { fontSize: 14, marginBottom: 4 },
  periodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  periodChip: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 30,
    borderWidth: 1.5,
  },
  periodChipText: { fontSize: 15, fontWeight: '600' },
  confirmCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, marginTop: 8,
  },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editBtn: {
    marginTop: 12, borderRadius: 12, borderWidth: 1,
    padding: 14, alignItems: 'center',
  },
  footer: { paddingTop: 16 },
  nextBtn: {
    borderRadius: 16, padding: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  error: { marginTop: 8, fontSize: 13 },
});
