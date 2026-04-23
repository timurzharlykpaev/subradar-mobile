/**
 * BulkAddSheet — add multiple subscriptions at once via:
 *   • Voice: "Netflix 15 dollars monthly, Spotify 10, iCloud 3"
 *   • Text:  free-form, e.g. "Netflix $15/mo, Spotify $10, ChatGPT $20"
 *   • Screenshot: photo of Apple/Google subscriptions list
 *
 * After parsing → shows checklist of detected subscriptions → user confirms → batch save.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Modal, Animated,
  Dimensions, KeyboardAvoidingView, Platform, Image,
  TouchableWithoutFeedback, Keyboard, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { aiApi } from '../api/ai';
import { subscriptionsApi } from '../api/subscriptions';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useSettingsStore } from '../stores/settingsStore';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { useRouter } from 'expo-router';
import { prefetchImage } from '../utils/imagePrefetch';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Types ────────────────────────────────────────────────────────────────────

export interface BulkSub {
  name: string;
  amount: number;
  currency: string;
  billingPeriod: 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY';
  category?: string;
  iconUrl?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  isDuplicate?: boolean;
}

type Mode = 'select' | 'voice' | 'text' | 'screenshot' | 'review';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDone: (count: number) => void;
}

const VALID_CATEGORIES = [
  'STREAMING', 'AI_SERVICES', 'INFRASTRUCTURE', 'DEVELOPER',
  'PRODUCTIVITY', 'MUSIC', 'GAMING', 'EDUCATION', 'FINANCE',
  'DESIGN', 'SECURITY', 'HEALTH', 'SPORT', 'NEWS', 'BUSINESS', 'OTHER',
];
const VALID_BILLING = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'ONE_TIME'];

function normalizeCategory(c?: string) {
  const up = (c || 'OTHER').toUpperCase().replace(/\s+/g, '_');
  return VALID_CATEGORIES.includes(up) ? up : 'OTHER';
}
function normalizeBilling(b?: string) {
  const up = (b || 'MONTHLY').toUpperCase();
  return VALID_BILLING.includes(up) ? up : 'MONTHLY';
}

// ── Voice button ──────────────────────────────────────────────────────────────

function VoiceBtn({ onVoice, loading, colors }: { onVoice: (uri: string) => void; loading: boolean; colors: any }) {
  const { t } = useTranslation();
  const { isRecording, durationFmt, start, stop } = useVoiceRecorder(onVoice);
  const pulse = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const mountedRef = useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Make sure any in-flight loop is stopped when component unmounts
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    // Stop any previous loop before starting a new one
    if (loopRef.current) {
      loopRef.current.stop();
      loopRef.current = null;
    }
    if (!mountedRef.current) return;

    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: isRecording ? 1.4 : 1.15, duration: 500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    loopRef.current = loop;
    loop.start();
    return () => {
      // Guard against race on unmount — only stop if this loop is still the active one
      if (loopRef.current === loop) {
        loop.stop();
        loopRef.current = null;
      }
    };
  }, [isRecording]);

  const bg = isRecording ? '#EF4444' : colors.primary;

  return (
    <View style={vStyles.wrap}>
      <Animated.View style={[vStyles.ring, { backgroundColor: bg + '22', transform: [{ scale: pulse }] }]} />
      <TouchableOpacity
        onPress={() => (isRecording ? stop() : start())}
        style={[vStyles.btn, { backgroundColor: bg, shadowColor: bg }]}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : isRecording ? (
          <Ionicons name="stop" size={32} color="#fff" />
        ) : (
          <Ionicons name="mic" size={36} color="#fff" />
        )}
      </TouchableOpacity>
      <Text style={[vStyles.label, { color: isRecording ? '#EF4444' : colors.textSecondary }]}>
        {loading ? t('common.loading') : isRecording ? durationFmt : t('add.tap_to_record')}
      </Text>
    </View>
  );
}

const vStyles = StyleSheet.create({
  wrap:  { alignItems: 'center', justifyContent: 'center', height: 160, marginVertical: 8 },
  ring:  { position: 'absolute', width: 130, height: 130, borderRadius: 65, top: 15, alignSelf: 'center' },
  btn:   { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 10 },
  label: { position: 'absolute', bottom: -2, fontSize: 13, fontWeight: '500' },
});

// ── SubCard ──────────────────────────────────────────────────────────────────

function SubCard({ sub, checked, onToggle, onEdit, colors }: { sub: BulkSub; checked: boolean; onToggle: () => void; onEdit: () => void; colors: any }) {
  const { t } = useTranslation();
  const periodLabels: Record<string, string> = {
    MONTHLY: t('add.monthly', 'monthly'),
    YEARLY: t('add.yearly', 'yearly'),
    WEEKLY: t('add.weekly', 'weekly'),
    QUARTERLY: t('add.quarterly', 'quarterly'),
  };

  return (
    <View style={[cStyles.card, {
      backgroundColor: checked ? colors.primary + '12' : colors.surface2,
      borderColor: checked ? colors.primary : colors.border,
    }]}>
      <TouchableOpacity onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} activeOpacity={0.75}>
        {sub.iconUrl ? (
          <Image source={{ uri: sub.iconUrl }} style={cStyles.icon} />
        ) : (
          <View style={[cStyles.iconFallback, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[cStyles.iconLetter, { color: colors.primary }]}>{(sub.name || '?')[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[cStyles.name, { color: colors.text }]} numberOfLines={1}>{sub.name}</Text>
          <Text style={[cStyles.meta, { color: colors.textMuted }]}>
            {sub.currency} {sub.amount.toFixed(2)} / {periodLabels[sub.billingPeriod] ?? sub.billingPeriod.toLowerCase()}
            {sub.category ? ` · ${sub.category}` : ''}
          </Text>
          {sub.isDuplicate && (
            <Text style={{ fontSize: 10, color: '#FBBF24', marginTop: 2 }}>{t('add.already_exists', 'Already added')}</Text>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 6 }}>
        <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggle}>
        <View style={[cStyles.checkbox, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : 'transparent' }]}>
          {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const cStyles = StyleSheet.create({
  card:        { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  icon:        { width: 44, height: 44, borderRadius: 11 },
  iconFallback:{ width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  iconLetter:  { fontSize: 20, fontWeight: '800' },
  name:        { fontSize: 16, fontWeight: '700' },
  meta:        { fontSize: 13, marginTop: 2 },
  checkbox:    { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});

// ── TEXT EXAMPLES ─────────────────────────────────────────────────────────────
const TEXT_EXAMPLES = [
  'Netflix $15/mo, Spotify $10, iCloud+ $3',
  'ChatGPT Plus 20 USD monthly, Notion 16 USD/year',
  'Adobe Creative Cloud 600 rubles per month',
  'YouTube Premium 169₽, Apple Music 169₽, 2GIS Pro 99₽',
];

// ── Main component ────────────────────────────────────────────────────────────

export function BulkAddSheet({ visible, onClose, onDone }: Props) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const { subscriptions, setSubscriptions } = useSubscriptionsStore();
  const currency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');
  const country = useSettingsStore((s) => s.region || s.country || 'US');
  const access = useEffectiveAccess();
  const isPro = access?.isPro ?? false;
  const activeCount = access?.limits.subscriptions.used ?? 0;
  const maxSubscriptions =
    access && access.limits.subscriptions.limit !== null
      ? access.limits.subscriptions.limit
      : Infinity;
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('select');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [parsedSubs, setParsedSubs] = useState<BulkSub[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideAnim.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (visible) {
      setMode('select');
      setTextInput('');
      setParsedSubs([]);
      setChecked([]);
      setScreenshotUri(null);
      Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 260, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }).start(onClose);
  };

  // ── Parse helpers ────────────────────────────────────────────────────────

  const showReview = (subs: BulkSub[]) => {
    if (!subs.length) {
      Alert.alert(t('add.bulk_no_subs', 'Не нашли подписок'), t('add.bulk_try_again', 'Попробуй другой текст или скриншот'));
      return;
    }
    const existingNames = new Set(subscriptions.map(s => s.name.toLowerCase()));
    const enriched = subs.map((s) => ({
      ...s,
      isDuplicate: existingNames.has(s.name.toLowerCase()),
      currency: s.currency || currency,
      billingPeriod: normalizeBilling(s.billingPeriod) as BulkSub['billingPeriod'],
      category: normalizeCategory(s.category),
      iconUrl: s.iconUrl || (s.name
        ? `https://icon.horse/icon/${s.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
        : undefined),
    }));
    setParsedSubs(enriched);
    setChecked(enriched.map((s) => !s.isDuplicate));
    setMode('review');
  };

  const parseText = async () => {
    const text = textInput.trim();
    if (!text) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const res = await aiApi.parseBulkText(text, i18n.language || 'ru', currency, country);
      const data = res.data;
      const subs: BulkSub[] = Array.isArray(data) ? data : (data.subscriptions ?? []);
      showReview(subs);
    } catch {
      Alert.alert(t('common.error'), t('add.parse_failed'));
    } finally {
      setLoading(false);
    }
  };

  const parseVoice = async (uri: string) => {
    if (!uri) return;
    setLoading(true);
    try {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as const });
      const res = await aiApi.parseBulkVoice({ audioBase64, locale: i18n.language || 'ru', currency, country });
      const data = res.data;
      const subs: BulkSub[] = Array.isArray(data) ? data : (data.subscriptions ?? []);
      showReview(subs);
    } catch {
      Alert.alert(t('common.error'), t('add.parse_failed'));
    } finally {
      setLoading(false);
    }
  };

  const parseScreenshot = async (uri: string) => {
    setLoading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as const });
      const formData = new FormData();
      formData.append('image', base64);
      const res = await aiApi.parseScreenshot(formData, { locale: i18n.language || 'ru', currency, country });
      const data = res.data;
      // screenshot endpoint returns single or array
      const subs: BulkSub[] = Array.isArray(data)
        ? data
        : data.subscriptions
          ? data.subscriptions
          : data.name
            ? [data]
            : [];
      showReview(subs);
    } catch {
      Alert.alert(t('common.error'), t('add.parse_failed'));
    } finally {
      setLoading(false);
    }
  };

  const pickScreenshot = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!res.canceled && res.assets[0]) {
      const uri = res.assets[0].uri;
      setScreenshotUri(uri);
      setMode('screenshot');
      parseScreenshot(uri);
    }
  };

  // ── Save selected ────────────────────────────────────────────────────────

  const saveSelected = async () => {
    const selected = parsedSubs.filter((_, i) => checked[i]);
    if (!selected.length) {
      Alert.alert('', t('add.bulk_select_at_least_one', 'Выбери хотя бы одну'));
      return;
    }

    // Determine how many we can add
    const remaining = isPro || maxSubscriptions === Infinity
      ? selected.length
      : Math.max(0, maxSubscriptions - activeCount);

    const toAdd = selected.slice(0, remaining);
    const overflow = selected.slice(remaining);

    setSaving(true);
    let saved = 0;
    for (const sub of toAdd) {
      try {
        const iconUrl = sub.iconUrl || (sub.name
          ? `https://icon.horse/icon/${sub.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
          : undefined);
        const res = await subscriptionsApi.create({
          name: sub.name || 'Subscription',
          category: normalizeCategory(sub.category),
          amount: sub.amount || 0,
          currency: sub.currency || currency,
          billingPeriod: normalizeBilling(sub.billingPeriod) as any,
          billingDay: 1,
          status: 'ACTIVE',
          serviceUrl: sub.serviceUrl || undefined,
          cancelUrl: sub.cancelUrl || undefined,
          iconUrl: iconUrl,
          startDate: new Date().toISOString().split('T')[0],
          addedVia: 'AI_TEXT',
        });
        if (res.data?.iconUrl) prefetchImage(res.data.iconUrl);
        saved++;
      } catch {
        // continue with others
      }
    }
    // Refresh store
    try {
      const r = await subscriptionsApi.getAll({ displayCurrency: useSettingsStore.getState().displayCurrency });
      setSubscriptions(r.data || []);
    } catch {}
    setSaving(false);

    if (overflow.length > 0) {
      // Some subscriptions couldn't be added — show what was lost
      const overflowNames = overflow.map((s) => s.name || 'Subscription').join(', ');
      Alert.alert(
        t('add.bulk_partial_title', 'Added {{saved}} of {{total}}', { saved, total: selected.length }),
        t('add.bulk_partial_msg', 'These couldn\'t be added (Free limit {{max}}):\n\n{{names}}\n\nUpgrade to Pro to add them all.', {
          max: maxSubscriptions,
          names: overflowNames,
        }),
        [
          {
            text: t('subscription_plan.upgrade_pro', 'Upgrade to Pro'),
            onPress: () => {
              handleClose();
              router.push('/paywall' as any);
            },
          },
          {
            text: t('common.ok', 'OK'),
            style: 'cancel',
            onPress: () => {
              onDone(saved);
              handleClose();
            },
          },
        ],
      );
    } else {
      onDone(saved);
      handleClose();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const bg = isDark ? '#12122A' : '#F5F5F7';

  return (
    <>
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] }]}>
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={{ paddingVertical: 12, alignItems: 'center' }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {mode === 'review'
                  ? t('add.bulk_review', 'Выбери подписки')
                  : t('add.bulk_title', 'Добавить несколько')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {mode === 'review'
                  ? t('add.bulk_review_sub', `Найдено: ${parsedSubs.length}`)
                  : t('add.bulk_subtitle', 'Голос, текст или скриншот')}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: bg }]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            contentInsetAdjustmentBehavior="automatic"
          >

            {/* ── Mode: select ─────────────────────────────────────────── */}
            {mode === 'select' && (
              <View style={{ gap: 12 }}>
                <ModeCard
                  icon="mic"
                  color="#8B5CF6"
                  title={t('add.bulk_voice', 'Голосом')}
                  desc={t('add.bulk_voice_desc', '"Netflix 15 долларов, Spotify 10, iCloud 3"')}
                  onPress={() => setMode('voice')}
                  colors={colors}
                />
                <ModeCard
                  icon="text"
                  color="#06B6D4"
                  title={t('add.bulk_text', 'Текстом')}
                  desc={t('add.bulk_text_desc', 'Напиши список — AI распознает всё сразу')}
                  onPress={() => setMode('text')}
                  colors={colors}
                />
                <ModeCard
                  icon="camera"
                  color="#10B981"
                  title={t('add.bulk_screenshot', 'Скриншот')}
                  desc={t('add.bulk_screenshot_desc', 'Скриншот Apple/Google подписок — распознаем автоматически')}
                  onPress={pickScreenshot}
                  colors={colors}
                />
              </View>
            )}

            {/* ── Mode: voice ──────────────────────────────────────────── */}
            {mode === 'voice' && (
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.modeTitle, { color: colors.text }]}>
                  {t('add.bulk_voice_hint', 'Перечисли подписки голосом')}
                </Text>
                <Text style={[styles.modeExample, { color: colors.textMuted }]}>
                  {t('add.bulk_voice_example', 'Например: "Netflix 15 долларов в месяц, Spotify 10, ChatGPT 20"')}
                </Text>
                <VoiceBtn onVoice={parseVoice} loading={loading} colors={colors} />
                <TouchableOpacity onPress={() => setMode('select')} style={{ marginTop: 8 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>← {t('common.back', 'Назад')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Mode: text ───────────────────────────────────────────── */}
            {mode === 'text' && (
              <View>
                <Text style={[styles.modeTitle, { color: colors.text }]}>
                  {t('add.bulk_text_hint', 'Список подписок текстом')}
                </Text>

                {/* Examples */}
                <View style={[styles.examplesBox, { backgroundColor: isDark ? '#1C1C2E' : '#F0EFF8', borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="bulb-outline" size={14} color={colors.primary} />
                    <Text style={[styles.examplesLabel, { color: colors.primary }]}>
                      {t('add.bulk_examples', 'Примеры')}
                    </Text>
                  </View>
                  {TEXT_EXAMPLES.map((ex, i) => (
                    <TouchableOpacity key={i} onPress={() => setTextInput(ex)} style={styles.exampleRow}>
                      <Text style={[styles.exampleText, { color: colors.textSecondary }]}>• {ex}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.textArea, { backgroundColor: bg, color: colors.text, borderColor: colors.border }]}
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder={t('add.bulk_text_placeholder', 'Netflix $15/mo, Spotify $10, iCloud $3...')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: (!textInput.trim() || loading) ? 0.5 : 1 }]}
                  onPress={parseText}
                  disabled={!textInput.trim() || loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.actionTxt}>{t('add.bulk_parse', 'Распознать →')}</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('select')} style={{ alignItems: 'center', marginTop: 12 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>← {t('common.back', 'Назад')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Mode: screenshot (parsing) ───────────────────────────── */}
            {mode === 'screenshot' && (
              <View style={{ alignItems: 'center', gap: 16 }}>
                {screenshotUri && (
                  <Image source={{ uri: screenshotUri }} style={styles.screenshotPreview} resizeMode="contain" />
                )}
                {loading ? (
                  <>
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text style={{ color: colors.textSecondary }}>
                      {t('add.bulk_parsing', 'AI распознаёт подписки...')}
                    </Text>
                  </>
                ) : null}
                <TouchableOpacity onPress={() => setMode('select')} style={{ marginTop: 4 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>← {t('common.back', 'Назад')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Mode: review ─────────────────────────────────────────── */}
            {mode === 'review' && (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                  <TouchableOpacity onPress={() => setChecked(parsedSubs.map(() => true))}>
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
                      {t('add.bulk_select_all', 'Выбрать все')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setChecked(parsedSubs.map(() => false))}>
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                      {t('add.bulk_deselect_all', 'Снять все')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {parsedSubs.map((sub, i) => (
                  <SubCard
                    key={i}
                    sub={sub}
                    checked={checked[i] ?? true}
                    onToggle={() => setChecked((prev) => {
                      const next = [...prev];
                      next[i] = !next[i];
                      return next;
                    })}
                    onEdit={() => setEditingIndex(i)}
                    colors={colors}
                  />
                ))}

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 8, opacity: saving ? 0.6 : 1 }]}
                  onPress={saveSelected}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.actionTxt}>
                      {t('add.bulk_save', `Добавить ${checked.filter(Boolean).length}`)}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('select')} style={{ alignItems: 'center', marginTop: 12 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>← {t('add.bulk_retry', 'Попробовать снова')}</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>

    {/* ── Edit Subscription Modal ─────────────────────────────────────────── */}
    {editingIndex !== null && parsedSubs[editingIndex] && (() => {
      const sub = parsedSubs[editingIndex];
      const PERIODS: Array<BulkSub['billingPeriod']> = ['MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY'];
      const CATEGORIES = ['STREAMING', 'AI_SERVICES', 'PRODUCTIVITY', 'MUSIC', 'GAMING', 'DESIGN', 'EDUCATION', 'FINANCE', 'INFRASTRUCTURE', 'SECURITY', 'HEALTH', 'SPORT', 'DEVELOPER', 'NEWS', 'BUSINESS', 'OTHER'];
      return (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEditingIndex(null)}>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, gap: 12 }}>
              <TouchableOpacity onPress={() => setEditingIndex(null)}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 }}>{t('common.edit', 'Edit')}</Text>
              <TouchableOpacity
                onPress={() => {
                  setParsedSubs([...parsedSubs]);
                  setEditingIndex(null);
                }}
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
                  onChangeText={(v) => { sub.name = v; setParsedSubs([...parsedSubs]); }}
                />
              </View>
              {/* Amount + Currency */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.amount', 'Amount')}</Text>
                  <TextInput
                    style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card }}
                    value={String(sub.amount)}
                    onChangeText={(v) => { sub.amount = parseFloat(v) || 0; setParsedSubs([...parsedSubs]); }}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ width: 80, gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.currency', 'Currency')}</Text>
                  <TextInput
                    style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card, textAlign: 'center' }}
                    value={sub.currency}
                    onChangeText={(v) => { sub.currency = v.toUpperCase(); setParsedSubs([...parsedSubs]); }}
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
                      style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: sub.billingPeriod === p ? colors.primary : colors.border, backgroundColor: sub.billingPeriod === p ? colors.primary + '12' : colors.card }}
                      onPress={() => { sub.billingPeriod = p; setParsedSubs([...parsedSubs]); }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: sub.billingPeriod === p ? colors.primary : colors.textSecondary }}>
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
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: (sub.category || 'OTHER') === c ? colors.primary : colors.border, backgroundColor: (sub.category || 'OTHER') === c ? colors.primary + '12' : colors.card }}
                      onPress={() => { sub.category = c; setParsedSubs([...parsedSubs]); }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: (sub.category || 'OTHER') === c ? colors.primary : colors.textSecondary }}>{String(t(`categories.${c.toLowerCase()}`, c))}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Delete */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EF444440', backgroundColor: '#EF444408', marginTop: 8 }}
                onPress={() => {
                  const next = parsedSubs.filter((_, j) => j !== editingIndex);
                  const nextChecked = checked.filter((_, j) => j !== editingIndex);
                  setParsedSubs(next);
                  setChecked(nextChecked);
                  setEditingIndex(null);
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

// ── ModeCard ──────────────────────────────────────────────────────────────────

function ModeCard({ icon, color, title, desc, onPress, colors }: {
  icon: string; color: string; title: string; desc: string; onPress: () => void; colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[mStyles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}
      activeOpacity={0.75}
    >
      <View style={[mStyles.iconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={26} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[mStyles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[mStyles.desc, { color: colors.textMuted }]} numberOfLines={2}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const mStyles = StyleSheet.create({
  card:    { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, padding: 16 },
  iconBox: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  desc:    { fontSize: 13, lineHeight: 18 },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.88, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  title:       { fontSize: 22, fontWeight: '900' },
  subtitle:    { fontSize: 13, marginTop: 2 },
  closeBtn:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  modeTitle:   { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  modeExample: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20, paddingHorizontal: 16 },
  examplesBox: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  examplesLabel:{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleRow:  { paddingVertical: 4 },
  exampleText: { fontSize: 13, lineHeight: 18 },
  textArea:    { borderRadius: 14, padding: 14, fontSize: 15, borderWidth: 1.5, minHeight: 120, marginBottom: 14 },
  actionBtn:   { borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  actionTxt:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  screenshotPreview: { width: '100%', height: 220, borderRadius: 16 },
});
