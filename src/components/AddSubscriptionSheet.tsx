import { useTranslation } from 'react-i18next';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Modal,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  TouchableWithoutFeedback,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { COLORS, CATEGORIES, CURRENCIES, BILLING_PERIODS } from '../constants';
import { subscriptionsApi } from '../api/subscriptions';
import { aiApi } from '../api/ai';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { VoiceRecorder } from './VoiceRecorder';
import { AIWizard, ParsedSub } from './AIWizard';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useTheme } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Tab keys - labels resolved via t() below
// Order: AI first, then Manual, then Screenshot
const TAB_KEYS = ['add.ai_assistant', 'add.manual', 'add.screenshot'] as const;

const POPULAR_SERVICES = [
  { name: 'Netflix', emoji: '🎬' },
  { name: 'Spotify', emoji: '🎵' },
  { name: 'YouTube Premium', emoji: '▶️' },
  { name: 'Apple iCloud', emoji: '☁️' },
  { name: 'Google One', emoji: '🗂️' },
  { name: 'LinkedIn Premium', emoji: '💼' },
  { name: 'Adobe Creative Cloud', emoji: '🎨' },
  { name: 'Microsoft 365', emoji: '📊' },
  { name: 'ChatGPT Plus', emoji: '🤖' },
  { name: 'Notion', emoji: '📝' },
  { name: 'Figma', emoji: '🖌️' },
  { name: 'GitHub', emoji: '🐙' },
  { name: 'DigitalOcean', emoji: '🌊' },
  { name: 'Dropbox', emoji: '📦' },
  { name: 'Disney+', emoji: '✨' },
];

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
};

// FormSection component — groups form fields visually
function FormSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.surface2,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      <Text style={{
        fontSize: 13,
        fontWeight: '700',
        color: colors.textMuted,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>{icon} {title}</Text>
      {children}
    </View>
  );
}

export function AddSubscriptionSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { subsLimitReached } = usePlanLimits();
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [aiText, setAiText] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [foundService, setFoundService] = useState<any>(null);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const { addSubscription } = useSubscriptionsStore();
  const { cards } = usePaymentCardsStore();
  const { currency } = useSettingsStore();

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [onClose]);

  const setF = useCallback((key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (subsLimitReached) {
      onClose();
      router.push('/paywall');
      return;
    }
    if (!form.name || !form.amount) {
      Alert.alert(t('add.required'), t('add.fill_required'));
      return;
    }
    try {
      const res = await subscriptionsApi.create({
        name: form.name,
        category: form.category.toUpperCase(),
        amount: parseFloat(form.amount),
        currency: form.currency,
        billingPeriod: form.billingPeriod,
        billingDay: parseInt(form.billingDay) || 1,
        status: form.isTrial ? 'TRIAL' : 'ACTIVE',
        paymentCardId: form.paymentCardId || undefined,
        currentPlan: form.currentPlan || undefined,
        serviceUrl: form.serviceUrl || undefined,
        cancelUrl: form.cancelUrl || undefined,
        iconUrl: form.iconUrl || undefined,
        notes: form.notes || undefined,
        trialEndDate: form.isTrial && form.trialEndDate ? form.trialEndDate : undefined,
      });
      addSubscription(res.data);
    } catch {
      Alert.alert(t('common.error'), '');
    }
    setForm(emptyForm);
    setFoundService(null);
    setAiQuery('');
    handleClose();
  }, [form, handleClose]);

  const handleAILookup = useCallback(async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const res = await aiApi.lookupService(aiQuery.trim());
      const result = res.data;
      setFoundService(result);
      const firstPlan = result.plans?.[0];
      const planAmount = firstPlan?.amount ?? firstPlan?.price ?? 0;
      const planPeriod = ((firstPlan?.billingCycle ?? firstPlan?.period ?? 'MONTHLY') as string).toUpperCase();
      const iconUrl = result.iconUrl ?? result.logoUrl ?? (result.serviceUrl
        ? `https://www.google.com/s2/favicons?domain=${new URL(result.serviceUrl).hostname}&sz=64`
        : '');
      setForm((f) => ({
        ...f,
        name: result.name ?? f.name,
        category: (result.category as string)?.toLowerCase() ?? f.category,
        amount: planAmount > 0 ? String(planAmount) : f.amount,
        currency: firstPlan?.currency ?? f.currency,
        billingPeriod: planPeriod as any,
        currentPlan: firstPlan?.name ?? f.currentPlan,
        serviceUrl: result.serviceUrl ?? f.serviceUrl,
        cancelUrl: result.cancelUrl ?? f.cancelUrl,
        iconUrl,
      }));
      // Switch to manual tab (index 1) to let user review/confirm
      setTab(1);
    } catch {
      Alert.alert(t('common.error'), t('add.service_not_found'));
    } finally {
      setAiLoading(false);
    }
  }, [aiQuery]);

  const pickScreenshot = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      setScreenshotUri(result.assets[0].uri);
    }
  };

  // Применяем распарсенные подписки от AI
  const applyParsedSubscriptions = (subs: any[]) => {
    if (!subs || subs.length === 0) return;
    const first = subs[0];
    const iconUrl = first.iconUrl ?? first.logoUrl ??
      (first.websiteUrl ? `https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(first.websiteUrl).hostname; } catch { return ''; } })()}&sz=64` : '');
    setForm(f => ({
      ...f,
      name: first.name ?? f.name,
      amount: first.amount != null ? String(first.amount) : f.amount,
      currency: first.currency ?? f.currency,
      billingPeriod: (first.billingPeriod ?? f.billingPeriod) as any,
      category: (first.category as string)?.toLowerCase() ?? f.category,
      serviceUrl: first.websiteUrl ?? first.serviceUrl ?? f.serviceUrl,
      cancelUrl: first.cancelUrl ?? f.cancelUrl,
      iconUrl: iconUrl || f.iconUrl,
    }));
    setTab(1); // переходим на Manual для редактирования
  };

  // Распознать текст через AI
  const handleRecognize = async () => {
    const text = aiText.trim();
    if (!text) return;
    setAiLoading(true);
    try {
      const res = await aiApi.parseText(text);
      const data = res.data;
      // parseText может вернуть массив или объект
      const subs = Array.isArray(data) ? data : (data.subscriptions ?? [data]);
      applyParsedSubscriptions(subs);
    } catch {
      // silent — не ломаем UI
    } finally {
      setAiLoading(false);
    }
  };

  // Распознать голос через AI
  const handleVoiceDone = async (uri: string) => {
    if (!uri) return;
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
      const res = await aiApi.parseAudio(formData);
      const data = res.data;
      // Если сервер вернул транскрипт — показываем его в поле
      if (data.text) setAiText(data.text);
      const subs = Array.isArray(data.subscriptions) ? data.subscriptions : (data.subscriptions ? [data.subscriptions] : []);
      if (subs.length > 0) applyParsedSubscriptions(subs);
    } catch {
      // silent
    } finally {
      setAiLoading(false);
    }
  };

  // Shared input style
  const inputStyle = {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('add.title')}</Text>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.background }]}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {TAB_KEYS.map((tabKey, i) => (
              <TouchableOpacity
                key={tabKey}
                style={[
                  styles.tab,
                  { backgroundColor: colors.background },
                  tab === i && { backgroundColor: colors.primary },
                ]}
                onPress={() => setTab(i)}
              >
                <Text style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  tab === i && styles.tabTextActive,
                ]}>{t(tabKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* tab === 0 → AI Assistant */}
            {tab === 0 && (
              <View style={{ flex: 1, paddingHorizontal: 4, paddingBottom: 16 }}>
                <AIWizard onDone={(sub) => {
                  setForm((f) => ({
                    ...f,
                    name: sub.name ?? f.name,
                    amount: sub.amount != null ? String(sub.amount) : f.amount,
                    currency: sub.currency ?? f.currency,
                    billingPeriod: (sub.billingPeriod ?? f.billingPeriod) as typeof f.billingPeriod,
                    category: sub.category?.toLowerCase() ?? f.category,
                    serviceUrl: sub.serviceUrl ?? f.serviceUrl,
                    cancelUrl: sub.cancelUrl ?? f.cancelUrl,
                    iconUrl: sub.iconUrl ?? f.iconUrl,
                  }));
                  setTab(1);
                }} />
              </View>
            )}

            {/* tab === 1 → Manual form */}
            {tab === 1 && (
              <View style={{ paddingBottom: 40 }}>
                {/* Section: Основное */}
                <FormSection title={t('add.section_main')} icon="📌">
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
                    {t('add.name')} *
                  </Text>
                  <TextInput
                    style={inputStyle}
                    value={form.name}
                    onChangeText={(v) => setF('name', v)}
                    placeholder={t('add.name_placeholder')}
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
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
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </FormSection>

                {/* Section: Оплата */}
                <FormSection title={t('add.section_payment')} icon="💰">
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
                        {t('add.amount')} *
                      </Text>
                      <TextInput
                        style={inputStyle}
                        value={form.amount}
                        onChangeText={(v) => setF('amount', v)}
                        placeholder="9.99"
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                        {t('add.currency')}
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'nowrap' }}>
                          {CURRENCIES.map((cur) => (
                            <TouchableOpacity
                              key={cur}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: form.currency === cur ? colors.primary : colors.background,
                                borderWidth: 1,
                                borderColor: form.currency === cur ? colors.primary : colors.border,
                              }}
                              onPress={() => setF('currency', cur)}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: form.currency === cur ? '#FFF' : colors.text }}>
                                {cur}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  </View>

                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
                    {t('add.billing_cycle')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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

                  {cards.length > 0 && (
                    <>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
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
                    </>
                  )}
                </FormSection>

                {/* Section: Дополнительно */}
                <FormSection title={t('add.section_extra')} icon="📋">
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

                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 2 }}>
                    {t('add.website')}
                  </Text>
                  <TextInput
                    style={inputStyle}
                    value={form.serviceUrl}
                    onChangeText={(v) => setF('serviceUrl', v)}
                    placeholder="https://netflix.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />

                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 14, marginBottom: 2 }}>
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
                </FormSection>

                {/* Section: Триал период */}
                <FormSection title={t('add.trial_period')} icon="⏰">
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        🎁 {t('add.trial_period')}
                      </Text>
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
                </FormSection>

                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 }}
                  onPress={handleSave}
                >
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>{t('add.add_subscription')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* tab === 2 → Screenshot */}
            {tab === 2 && (
              <View style={styles.screenshotTab}>
                <Text style={[styles.aiHint, { color: colors.textSecondary }]}>
                  {t('add.screenshot_ai_hint')}
                </Text>
                <TouchableOpacity
                  style={[styles.screenshotPicker, { borderColor: colors.border }]}
                  onPress={pickScreenshot}
                >
                  {screenshotUri ? (
                    <Image source={{ uri: screenshotUri }} style={styles.screenshot} resizeMode="contain" />
                  ) : (
                    <View style={styles.screenshotPlaceholder}>
                      <Text style={styles.screenshotIcon}>📸</Text>
                      <Text style={[styles.screenshotText, { color: colors.textSecondary }]}>{t('add.tap_to_pick')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {screenshotUri && (
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 }}
                    onPress={() => Alert.alert(t('add.ai_assistant'), t('add.ai_screenshot'))}
                  >
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>✨ {t('add.parse_screenshot')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.border,
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
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#FFF' },
  content: { flex: 1, paddingHorizontal: 20 },
  aiTab: { gap: 12, paddingBottom: 40 },
  aiHint: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  aiSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  aiRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  aiSearchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSearchBtnText: { fontSize: 20, color: '#FFF', fontWeight: '700' },
  foundServiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  foundServiceIcon: { width: 40, height: 40, borderRadius: 10 },
  foundServiceName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  foundServiceMeta: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  aiDivider: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiDividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  aiDividerText: { fontSize: 12, color: COLORS.textMuted },
  popularTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
  popularGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  popularEmoji: { fontSize: 16 },
  popularName: { fontSize: 13, fontWeight: '600', color: COLORS.text, maxWidth: 110 },
  screenshotTab: { gap: 16, paddingBottom: 40 },
  screenshotPicker: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    minHeight: 200,
  },
  screenshot: { width: '100%', height: 300 },
  screenshotPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  screenshotIcon: { fontSize: 48 },
  screenshotText: { fontSize: 15, color: COLORS.textSecondary },
});
