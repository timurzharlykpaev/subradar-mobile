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
import { usePlanLimits } from '../hooks/usePlanLimits';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Tab keys - labels resolved via t() below
const TAB_KEYS = ['add.manual', 'add.ai_assistant', 'add.screenshot'] as const;

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

export function AddSubscriptionSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
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
        plan: firstPlan?.name ?? f.plan,
        websiteUrl: result.serviceUrl ?? f.websiteUrl,
        cancelUrl: result.cancelUrl ?? f.cancelUrl,
        iconUrl,
      }));
      // Switch to manual tab to let user review/confirm
      setTab(0);
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

  const handleVoiceDone = (_uri: string) => {
    Alert.alert('', t('add.ai_processing'));
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.handleBar} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('add.title')}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {TAB_KEYS.map((tabKey, i) => (
              <TouchableOpacity
                key={tabKey}
                style={[styles.tab, tab === i && styles.tabActive]}
                onPress={() => setTab(i)}
              >
                <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{t(tabKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {tab === 0 && (
              <View style={styles.form}>
                <Field {...{label: t('add.name') + ' *'}}>
                  <TextInput
                    style={styles.input}
                    value={form.name}
                    onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                    placeholder={t('add.name_placeholder')}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </Field>

                <Field {...{label: t('add.category')}}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chips}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.chip,
                            form.category === cat.id && { backgroundColor: cat.color },
                          ]}
                          onPress={() => setForm((f) => ({ ...f, category: cat.id }))}
                        >
                          <Text>{cat.emoji} {cat.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </Field>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Field {...{label: t('add.amount') + ' *'}}>
                      <TextInput
                        style={styles.input}
                        value={form.amount}
                        onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
                        placeholder="9.99"
                        keyboardType="decimal-pad"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field {...{label: t('add.currency')}}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chips}>
                          {CURRENCIES.map((cur) => (
                            <TouchableOpacity
                              key={cur}
                              style={[styles.chip, form.currency === cur && styles.chipActive]}
                              onPress={() => setForm((f) => ({ ...f, currency: cur }))}
                            >
                              <Text style={form.currency === cur ? styles.chipActiveText : {}}>{cur}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </Field>
                  </View>
                </View>

                <Field {...{label: t('add.billing_cycle')}}>
                  <View style={styles.chips}>
                    {BILLING_PERIODS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.chip, form.billingPeriod === p && styles.chipActive]}
                        onPress={() => setForm((f) => ({ ...f, billingPeriod: p as any }))}
                      >
                        <Text style={form.billingPeriod === p ? styles.chipActiveText : {}}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>

                <Field {...{label: t('add.plan')}}>
                  <TextInput
                    style={styles.input}
                    value={form.currentPlan}
                    onChangeText={(v) => setForm((f) => ({ ...f, currentPlan: v }))}
                    placeholder={t('add.plan_placeholder')}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </Field>

                {cards.length > 0 && (
                  <Field {...{label: t('add.card')}}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chips}>
                        <TouchableOpacity
                          style={[styles.chip, !form.paymentCardId && styles.chipActive]}
                          onPress={() => setForm((f) => ({ ...f, paymentCardId: '' }))}
                        >
                          <Text>{t('add.no_card')}</Text>
                        </TouchableOpacity>
                        {cards.map((card) => (
                          <TouchableOpacity
                            key={card.id}
                            style={[styles.chip, form.paymentCardId === card.id && styles.chipActive]}
                            onPress={() => setForm((f) => ({ ...f, paymentCardId: card.id }))}
                          >
                            <Text style={form.paymentCardId === card.id ? styles.chipActiveText : {}}>
                              ••••{card.last4} ({card.brand})
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </Field>
                )}

                <Field {...{label: t('add.website')}}>
                  <TextInput
                    style={styles.input}
                    value={form.serviceUrl}
                    onChangeText={(v) => setForm((f) => ({ ...f, serviceUrl: v }))}
                    placeholder="https://netflix.com"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                  />
                </Field>

                <Field {...{label: t('add.notes')}}>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={form.notes}
                    onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                    placeholder={t('add.notes_placeholder')}
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </Field>

                {/* Trial period toggle */}
                <View style={styles.trialRow}>
                  <View>
                    <Text style={styles.trialLabel}>🎁 {t('add.trial_period')}</Text>
                    <Text style={styles.trialSubLabel}>{t('add.trial_desc')}</Text>
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
                    trackColor={{ false: COLORS.border, true: '#F59E0B' }}
                    thumbColor={form.isTrial ? '#FFF' : '#999'}
                  />
                </View>

                {form.isTrial && (
                  <Field {...{label: t('add.trial_end_date')}}>
                    <TextInput
                      style={styles.input}
                      value={form.trialEndDate}
                      onChangeText={(v) => setForm((f) => ({ ...f, trialEndDate: v }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </Field>
                )}

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{t('add.add_subscription')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {tab === 1 && (
              <View style={styles.aiTab}>
                {/* Service search */}
                <Text style={styles.aiSectionTitle}>🔍 {t('add.search_service')}</Text>
                <Text style={styles.aiHint}>{t('add.ai_lookup_hint')}</Text>
                <View style={styles.aiRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={aiQuery}
                    onChangeText={setAiQuery}
                    placeholder={t('add.search_placeholder')}
                    placeholderTextColor={COLORS.textMuted}
                    returnKeyType="search"
                    onSubmitEditing={handleAILookup}
                  />
                  <TouchableOpacity
                    style={[styles.aiSearchBtn, aiLoading && { opacity: 0.6 }]}
                    onPress={handleAILookup}
                    disabled={aiLoading || !aiQuery.trim()}
                  >
                    {aiLoading
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={styles.aiSearchBtnText}>→</Text>}
                  </TouchableOpacity>
                </View>

                {foundService ? (
                  <View style={styles.foundServiceCard}>
                    {form.iconUrl ? (
                      <Image source={{ uri: form.iconUrl }} style={styles.foundServiceIcon}
                        onError={() => {}} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foundServiceName}>{foundService.name}</Text>
                      <Text style={styles.foundServiceMeta}>
                        {t('add.plans_count', { count: foundService.plans?.length ?? 0 })} · {t('add.form_filled')} ✓
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => { setFoundService(null); setAiQuery(''); }}>
                      <Text style={{ fontSize: 18, color: COLORS.textMuted }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.popularTitle}>{t('add.popular')}</Text>
                    <View style={styles.popularGrid}>
                      {POPULAR_SERVICES.map((svc) => (
                        <TouchableOpacity
                          key={svc.name}
                          style={styles.popularChip}
                          onPress={() => {
                            setAiQuery(svc.name);
                            // auto-search after setting
                            setTimeout(() => {
                              aiApi.lookupService(svc.name).then((res) => {
                                const result = res.data;
                                setFoundService(result);
                                const fp = result.plans?.[0];
                                const amt = fp?.amount ?? fp?.price ?? 0;
                                const period = ((fp?.billingCycle ?? fp?.period ?? 'MONTHLY') as string).toUpperCase();
                                const icon = result.iconUrl ?? result.logoUrl ?? (result.serviceUrl
                                  ? `https://www.google.com/s2/favicons?domain=${new URL(result.serviceUrl).hostname}&sz=64`
                                  : '');
                                setForm((f) => ({
                                  ...f,
                                  name: result.name ?? f.name,
                                  category: (result.category as string)?.toLowerCase() ?? f.category,
                                  amount: amt > 0 ? String(amt) : f.amount,
                                  currency: fp?.currency ?? f.currency,
                                  billingPeriod: period as any,
                                  plan: fp?.name ?? f.plan,
                                  websiteUrl: result.serviceUrl ?? f.websiteUrl,
                                  cancelUrl: result.cancelUrl ?? f.cancelUrl,
                                  iconUrl: icon,
                                }));
                                setTab(0); // switch to manual tab to review
                              }).catch(() => {});
                            }, 50);
                          }}
                        >
                          <Text style={styles.popularEmoji}>{svc.emoji}</Text>
                          <Text style={styles.popularName} numberOfLines={1}>{svc.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <View style={styles.aiDivider}>
                  <View style={styles.aiDividerLine} />
                  <Text style={styles.aiDividerText}>{t('common.or')}</Text>
                  <View style={styles.aiDividerLine} />
                </View>

                {/* Text parse */}
                <Text style={styles.aiSectionTitle}>✨ {t('add.parse_text')}</Text>
                <TextInput
                  style={[styles.input, styles.multiline, { minHeight: 100 }]}
                  value={aiText}
                  onChangeText={setAiText}
                  placeholder={t('add.paste_hint')}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                />
                <VoiceRecorder onRecordingComplete={handleVoiceDone} />
                <TouchableOpacity
                  style={[styles.saveBtn, { marginTop: 8 }]}
                  onPress={() => Alert.alert(t('add.ai_assistant'), t('add.ai_processing'))}
                >
                  <Text style={styles.saveBtnText}>✨ {t('add.recognize')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {tab === 2 && (
              <View style={styles.screenshotTab}>
                <Text style={styles.aiHint}>
                  {t('add.screenshot_ai_hint')}
                </Text>
                <TouchableOpacity style={styles.screenshotPicker} onPress={pickScreenshot}>
                  {screenshotUri ? (
                    <Image source={{ uri: screenshotUri }} style={styles.screenshot} resizeMode="contain" />
                  ) : (
                    <View style={styles.screenshotPlaceholder}>
                      <Text style={styles.screenshotIcon}>📸</Text>
                      <Text style={styles.screenshotText}>{t('add.tap_to_pick')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {screenshotUri && (
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => Alert.alert(t('add.ai_assistant'), t('add.ai_screenshot'))}
                  >
                    <Text style={styles.saveBtnText}>✨ {t('add.parse_screenshot')}</Text>
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

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={fieldStyles.label}>{label}</Text>
    {children}
  </View>
);

const fieldStyles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
});

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
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#FFF' },
  content: { flex: 1, paddingHorizontal: 20 },
  form: { paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  multiline: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipActiveText: { color: '#FFF', fontWeight: '700' },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
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
  trialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  trialLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  trialSubLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
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
