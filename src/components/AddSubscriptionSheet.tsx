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
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, CURRENCIES, BILLING_PERIODS } from '../constants';
import { subscriptionsApi } from '../api/subscriptions';
import { aiApi } from '../api/ai';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { VoiceRecorder } from './VoiceRecorder';
import { AIWizard, ParsedSub } from './AIWizard';
import { SuccessOverlay } from './SuccessOverlay';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useTheme } from '../theme';
import {
  MovieIcon, MusicIcon, PlayIcon, InfrastructureIcon, FolderIcon,
  BriefcaseIcon, PaletteIcon, ChartBarIcon, AiServicesIcon,
  PenIcon, BrushIcon, OctopusIcon, WaveDropIcon, OtherIcon, SparklesIcon,
  PinIcon, MoneyIcon, ClipboardIcon, AlarmIcon, CameraIcon, GiftIcon,
} from './icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Tab keys - labels resolved via t() below
// Order: AI first, then Manual, then Screenshot
const TAB_KEYS = ['add.ai_assistant', 'add.manual', 'add.screenshot'] as const;

const POPULAR_SERVICES = [
  { name: 'Netflix', Icon: MovieIcon },
  { name: 'Spotify', Icon: MusicIcon },
  { name: 'YouTube Premium', Icon: PlayIcon },
  { name: 'Apple iCloud', Icon: InfrastructureIcon },
  { name: 'Google One', Icon: FolderIcon },
  { name: 'LinkedIn Premium', Icon: BriefcaseIcon },
  { name: 'Adobe Creative Cloud', Icon: PaletteIcon },
  { name: 'Microsoft 365', Icon: ChartBarIcon },
  { name: 'ChatGPT Plus', Icon: AiServicesIcon },
  { name: 'Notion', Icon: PenIcon },
  { name: 'Figma', Icon: BrushIcon },
  { name: 'GitHub', Icon: OctopusIcon },
  { name: 'DigitalOcean', Icon: WaveDropIcon },
  { name: 'Dropbox', Icon: OtherIcon },
  { name: 'Disney+', Icon: SparklesIcon },
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
  startDate: new Date().toISOString().split('T')[0],
  reminderDaysBefore: [3] as number[],
  color: '' as string,
  tags: [] as string[],
};

// FormSection component — groups form fields visually
function FormSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.surface2,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
      }}>
        {icon}
        <Text style={{
          fontSize: 13,
          fontWeight: '700',
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>{title}</Text>
      </View>
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
  const [parsingScreenshot, setParsingScreenshot] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState('');
  const [moreExpanded, setMoreExpanded] = useState(false);

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
    if (!form.name || !form.amount || parseFloat(form.amount) <= 0) {
      Alert.alert(t('add.required'), t('add.fill_required'));
      return;
    }
    try {
      let iconUrl = form.iconUrl;
      if (!iconUrl && form.serviceUrl) {
        try {
          const host = new URL(form.serviceUrl).hostname;
          iconUrl = `https://logo.clearbit.com/${host}`;
        } catch {}
      }
      if (!iconUrl && form.name) {
        const slug = form.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        iconUrl = `https://logo.clearbit.com/${slug}.com`;
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
        addedVia: 'MANUAL',
      });
      addSubscription(res.data);
      setSuccessName(form.name);
      setShowSuccess(true);
      // Sync list from server in background
      subscriptionsApi.getAll().then((r) => {
        useSubscriptionsStore.getState().setSubscriptions(r.data || []);
      }).catch(() => {});
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t('add.save_failed');
      Alert.alert(t('common.error'), msg);
    }
  }, [form, handleClose, subsLimitReached, onClose, router, t, addSubscription]);

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
      (first.serviceUrl ? `https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(first.serviceUrl).hostname; } catch { return ''; } })()}&sz=64` : '');
    setForm(f => ({
      ...f,
      name: first.name ?? f.name,
      amount: first.amount != null ? String(first.amount) : f.amount,
      currency: first.currency ?? f.currency,
      billingPeriod: (first.billingPeriod ?? f.billingPeriod) as any,
      category: (first.category as string)?.toLowerCase() ?? f.category,
      serviceUrl: first.serviceUrl ?? f.serviceUrl,
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
      Alert.alert(t('common.error'), t('add.parse_failed', 'Could not parse. Try again.'));
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
      formData.append('file', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);
      const res = await aiApi.parseAudio(formData);
      const data = res.data;
      // Если сервер вернул транскрипт — показываем его в поле
      if (data.text) setAiText(data.text);
      const subs = Array.isArray(data.subscriptions)
        ? data.subscriptions
        : data.subscriptions
          ? [data.subscriptions]
          : (data.name && data.amount) ? [data] : [];
      if (subs.length > 0) applyParsedSubscriptions(subs);
    } catch {
      Alert.alert(t('common.error'), t('add.parse_failed', 'Could not parse. Try again.'));
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
        testID="add-sub-sheet"
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
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {TAB_KEYS.map((tabKey, i) => (
              <TouchableOpacity
                key={tabKey}
                testID={i === 0 ? 'tab-ai' : i === 1 ? 'tab-manual' : 'tab-screenshot'}
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

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {/* tab === 0 → AI Assistant */}
            {tab === 0 && (
              <View style={{ flex: 1, paddingHorizontal: 4, paddingBottom: 16 }}>
                <AIWizard
                  onSave={async (sub) => {
                    const iconUrl = sub.iconUrl || (sub.serviceUrl
                      ? `https://logo.clearbit.com/${(() => { try { return new URL(sub.serviceUrl).hostname; } catch { return ''; } })()}`
                      : sub.name
                        ? `https://logo.clearbit.com/${sub.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`
                        : undefined);

                    const VALID_CATEGORIES = ['STREAMING', 'AI_SERVICES', 'INFRASTRUCTURE', 'PRODUCTIVITY', 'MUSIC', 'GAMING', 'NEWS', 'HEALTH', 'OTHER'];
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
                    setSuccessName(sub.name || '');
                    setShowSuccess(true);
                    // Sync list from server
                    subscriptionsApi.getAll().then((r) => {
                      useSubscriptionsStore.getState().setSubscriptions(r.data || []);
                    }).catch(() => {});
                  }}
                  onEdit={(sub) => {
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
                  }}
                />
              </View>
            )}

            {/* tab === 1 → Manual form */}
            {tab === 1 && (
              <View style={{ paddingBottom: 40 }}>
                {/* Essential fields — always visible, no section wrapper */}
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

                {/* "More" toggle button */}
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

                {/* Optional fields — collapsed by default */}
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
                                {cat.label}
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
                              width: 32, height: 32, borderRadius: 16,
                              backgroundColor: c.hex,
                              borderWidth: 2.5,
                              borderColor: form.color === c.value ? colors.text : 'transparent',
                              alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {c.label && (
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
                      <CameraIcon size={24} color={colors.textSecondary} />
                      <Text style={[styles.screenshotText, { color: colors.textSecondary }]}>{t('add.tap_to_pick')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {screenshotUri && (
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, opacity: parsingScreenshot ? 0.6 : 1 }}
                    disabled={parsingScreenshot}
                    onPress={async () => {
                      setParsingScreenshot(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', {
                          uri: screenshotUri,
                          type: 'image/jpeg',
                          name: 'screenshot.jpg',
                        } as any);
                        const res = await aiApi.parseScreenshot(formData);
                        const data = res.data;
                        const subs = Array.isArray(data) ? data : (data.subscriptions ?? [data]);
                        applyParsedSubscriptions(subs);
                      } catch {
                        Alert.alert(t('common.error'), t('add.service_not_found'));
                      } finally {
                        setParsingScreenshot(false);
                      }
                    }}
                  >
                    {parsingScreenshot ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <SparklesIcon size={16} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>{t('add.parse_screenshot')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        <SuccessOverlay
          visible={showSuccess}
          name={successName}
          onFinish={() => {
            setShowSuccess(false);
            setSuccessName('');
            setForm(emptyForm);
            setFoundService(null);
            setAiQuery('');
            setTab(0);
            handleClose();
          }}
        />
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
  title: { fontSize: 20, fontWeight: '800' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '600' },
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
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#FFF' },
  content: { flex: 1, paddingHorizontal: 20 },
  aiTab: { gap: 12, paddingBottom: 40 },
  aiHint: { fontSize: 13, lineHeight: 18 },
  aiSectionTitle: { fontSize: 15, fontWeight: '700' },
  aiRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  aiSearchBtn: {
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
    borderWidth: 1,
  },
  foundServiceIcon: { width: 40, height: 40, borderRadius: 10 },
  foundServiceName: { fontSize: 15, fontWeight: '700' },
  foundServiceMeta: { fontSize: 12, marginTop: 2 },
  aiDivider: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiDividerLine: { flex: 1, height: 1 },
  aiDividerText: { fontSize: 12 },
  popularTitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  popularGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  popularEmoji: { fontSize: 16 },
  popularName: { fontSize: 13, fontWeight: '600', maxWidth: 110 },
  screenshotTab: { gap: 16, paddingBottom: 40 },
  screenshotPicker: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: 200,
  },
  screenshot: { width: '100%', height: 300 },
  screenshotPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  screenshotIcon: { fontSize: 48 },
  screenshotText: { fontSize: 15 },
});
