/**
 * BulkAddSheet — add multiple subscriptions at once via:
 *   • Voice: "Netflix 15 dollars monthly, Spotify 10, iCloud 3"
 *   • Text:  free-form, e.g. "Netflix $15/mo, Spotify $10, ChatGPT $20"
 *   • Screenshot: photo of Apple/Google subscriptions list
 *
 * After parsing → shows checklist of detected subscriptions → user confirms → batch save.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, Animated,
  Dimensions, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, PanResponder,
} from 'react-native';
import { DoneAccessoryInput } from './primitives/DoneAccessoryInput';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { aiApi } from '../api/ai';
import { subscriptionsApi } from '../api/subscriptions';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { useRouter } from 'expo-router';
import { prefetchImage } from '../utils/imagePrefetch';
import { TextInputMode } from './bulk-add/TextInputMode';
import { VoiceMode } from './bulk-add/VoiceMode';
import { ScreenshotMode } from './bulk-add/ScreenshotMode';
import { SelectMode } from './bulk-add/SelectMode';
import { ReviewMode } from './bulk-add/ReviewMode';
import type { BulkSub } from './bulk-add/types';

// Re-export so existing imports of `BulkSub` from this module keep working.
export type { BulkSub };

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Types ────────────────────────────────────────────────────────────────────

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

  const parseText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await aiApi.parseBulkText(trimmed, i18n.language || 'ru', currency, country);
      const data = res.data;
      const subs: BulkSub[] = Array.isArray(data) ? data : (data.subscriptions ?? []);
      showReview(subs);
    } catch {
      Alert.alert(t('common.error'), t('add.parse_failed'));
    } finally {
      setLoading(false);
    }
    // showReview/Alert/t are stable enough; intentionally narrow deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, country, i18n.language]);

  const handleBackToSelect = useCallback(() => setMode('select'), []);
  const handlePickVoice = useCallback(() => setMode('voice'), []);
  const handlePickText = useCallback(() => setMode('text'), []);

  const toggleChecked = useCallback((index: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setChecked((prev) => prev.map(() => true));
  }, []);

  const deselectAll = useCallback(() => {
    setChecked((prev) => prev.map(() => false));
  }, []);

  const parseVoice = useCallback(async (uri: string) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, country, i18n.language]);

  const parseScreenshot = useCallback(async (uri: string) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, country, i18n.language]);

  const pickScreenshot = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!res.canceled && res.assets[0]) {
      const uri = res.assets[0].uri;
      setScreenshotUri(uri);
      setMode('screenshot');
      parseScreenshot(uri);
    }
  }, [parseScreenshot]);

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
          // Use the user's chosen billingDay/startDate when the inline
          // editor exposed them — fall back to the old hardcoded "today,
          // day 1" only when the bulk row has no values at all.
          billingDay: sub.billingDay ?? 1,
          status: 'ACTIVE',
          serviceUrl: sub.serviceUrl || undefined,
          cancelUrl: sub.cancelUrl || undefined,
          iconUrl: iconUrl,
          startDate: sub.startDate || new Date().toISOString().split('T')[0],
          nextPaymentDate: sub.nextPaymentDate || undefined,
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
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            contentInsetAdjustmentBehavior="automatic"
          >

            {/* ── Mode: select ─────────────────────────────────────────── */}
            {mode === 'select' && (
              <SelectMode
                onPickVoice={handlePickVoice}
                onPickText={handlePickText}
                onPickScreenshot={pickScreenshot}
              />
            )}

            {/* ── Mode: voice ──────────────────────────────────────────── */}
            {mode === 'voice' && (
              <VoiceMode
                loading={loading}
                onVoice={parseVoice}
                onBack={handleBackToSelect}
              />
            )}

            {/* ── Mode: text ───────────────────────────────────────────── */}
            {mode === 'text' && (
              <TextInputMode
                loading={loading}
                onSubmit={parseText}
                onBack={handleBackToSelect}
              />
            )}

            {/* ── Mode: screenshot (parsing) ───────────────────────────── */}
            {mode === 'screenshot' && (
              <ScreenshotMode
                screenshotUri={screenshotUri}
                loading={loading}
                onBack={handleBackToSelect}
              />
            )}

            {/* ── Mode: review ─────────────────────────────────────────── */}
            {mode === 'review' && (
              <ReviewMode
                parsedSubs={parsedSubs}
                checked={checked}
                saving={saving}
                onToggle={toggleChecked}
                onEdit={setEditingIndex}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onSave={saveSelected}
                onRetry={handleBackToSelect}
              />
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
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              contentInsetAdjustmentBehavior="automatic"
            >
              {/* Name */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.service_name', 'Name')}</Text>
                <DoneAccessoryInput
                  style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card }}
                  value={sub.name}
                  onChangeText={(v) => { sub.name = v; setParsedSubs([...parsedSubs]); }}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              {/* Amount + Currency */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.amount', 'Amount')}</Text>
                  <DoneAccessoryInput
                    style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card }}
                    value={String(sub.amount)}
                    onChangeText={(v) => { sub.amount = parseFloat(v) || 0; setParsedSubs([...parsedSubs]); }}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ width: 80, gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{t('add.currency', 'Currency')}</Text>
                  <DoneAccessoryInput
                    style={{ fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.card, textAlign: 'center' }}
                    value={sub.currency}
                    onChangeText={(v) => { sub.currency = v.toUpperCase(); setParsedSubs([...parsedSubs]); }}
                    maxLength={3}
                    autoCapitalize="characters"
                    placeholderTextColor={colors.textMuted}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.88, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 13, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
