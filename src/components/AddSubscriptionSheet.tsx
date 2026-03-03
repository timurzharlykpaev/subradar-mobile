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
  TouchableWithoutFeedback,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, CATEGORIES, CURRENCIES, BILLING_PERIODS } from '../constants';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { VoiceRecorder } from './VoiceRecorder';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

const TABS = ['Manual', 'AI Assistant', 'Screenshot'];

const emptyForm = {
  name: '',
  category: 'streaming',
  amount: '',
  currency: 'USD',
  period: 'monthly' as const,
  billingDay: '1',
  cardId: '',
  plan: '',
  websiteUrl: '',
  cancelUrl: '',
  notes: '',
};

export function AddSubscriptionSheet({ visible, onClose }: Props) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [aiText, setAiText] = useState('');
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

  const handleSave = useCallback(() => {
    if (!form.name || !form.amount) {
      Alert.alert('Required', 'Please fill name and amount');
      return;
    }
    addSubscription({
      id: Date.now().toString(),
      name: form.name,
      category: form.category,
      amount: parseFloat(form.amount),
      currency: form.currency,
      period: form.period,
      billingDay: parseInt(form.billingDay) || 1,
      nextDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      cardId: form.cardId || undefined,
      plan: form.plan || undefined,
      websiteUrl: form.websiteUrl || undefined,
      cancelUrl: form.cancelUrl || undefined,
      notes: form.notes || undefined,
      createdAt: new Date().toISOString(),
    });
    setForm(emptyForm);
    handleClose();
  }, [form, handleClose]);

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
    Alert.alert('Audio recorded', 'AI is processing... (demo)');
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
            <Text style={styles.title}>Add Subscription</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {TABS.map((t, i) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, tab === i && styles.tabActive]}
                onPress={() => setTab(i)}
              >
                <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {tab === 0 && (
              <View style={styles.form}>
                <Field label="Service Name *">
                  <TextInput
                    style={styles.input}
                    value={form.name}
                    onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                    placeholder="Netflix, Spotify..."
                    placeholderTextColor={COLORS.textMuted}
                  />
                </Field>

                <Field label="Category">
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
                    <Field label="Amount *">
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
                    <Field label="Currency">
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

                <Field label="Billing Period">
                  <View style={styles.chips}>
                    {BILLING_PERIODS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.chip, form.period === p && styles.chipActive]}
                        onPress={() => setForm((f) => ({ ...f, period: p as any }))}
                      >
                        <Text style={form.period === p ? styles.chipActiveText : {}}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>

                <Field label="Plan Name">
                  <TextInput
                    style={styles.input}
                    value={form.plan}
                    onChangeText={(v) => setForm((f) => ({ ...f, plan: v }))}
                    placeholder="Premium, Basic..."
                    placeholderTextColor={COLORS.textMuted}
                  />
                </Field>

                {cards.length > 0 && (
                  <Field label="Payment Card">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chips}>
                        <TouchableOpacity
                          style={[styles.chip, !form.cardId && styles.chipActive]}
                          onPress={() => setForm((f) => ({ ...f, cardId: '' }))}
                        >
                          <Text>No card</Text>
                        </TouchableOpacity>
                        {cards.map((card) => (
                          <TouchableOpacity
                            key={card.id}
                            style={[styles.chip, form.cardId === card.id && styles.chipActive]}
                            onPress={() => setForm((f) => ({ ...f, cardId: card.id }))}
                          >
                            <Text style={form.cardId === card.id ? styles.chipActiveText : {}}>
                              ••••{card.last4} ({card.brand})
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </Field>
                )}

                <Field label="Website URL">
                  <TextInput
                    style={styles.input}
                    value={form.websiteUrl}
                    onChangeText={(v) => setForm((f) => ({ ...f, websiteUrl: v }))}
                    placeholder="https://netflix.com"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                  />
                </Field>

                <Field label="Notes">
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={form.notes}
                    onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                    placeholder="Additional notes..."
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </Field>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>Add Subscription</Text>
                </TouchableOpacity>
              </View>
            )}

            {tab === 1 && (
              <View style={styles.aiTab}>
                <Text style={styles.aiHint}>
                  Describe the subscription or paste an email, and AI will fill the form for you.
                </Text>
                <TextInput
                  style={[styles.input, styles.multiline, { minHeight: 100 }]}
                  value={aiText}
                  onChangeText={setAiText}
                  placeholder="e.g. I pay $9.99 per month for Netflix Premium..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                />
                <VoiceRecorder onRecordingComplete={handleVoiceDone} />
                <TouchableOpacity
                  style={[styles.saveBtn, { marginTop: 16 }]}
                  onPress={() => Alert.alert('AI', 'Processing... (connect API)')}
                >
                  <Text style={styles.saveBtnText}>✨ Parse with AI</Text>
                </TouchableOpacity>
              </View>
            )}

            {tab === 2 && (
              <View style={styles.screenshotTab}>
                <Text style={styles.aiHint}>
                  Take a screenshot of an invoice or receipt and AI will extract the details.
                </Text>
                <TouchableOpacity style={styles.screenshotPicker} onPress={pickScreenshot}>
                  {screenshotUri ? (
                    <Image source={{ uri: screenshotUri }} style={styles.screenshot} resizeMode="contain" />
                  ) : (
                    <View style={styles.screenshotPlaceholder}>
                      <Text style={styles.screenshotIcon}>📸</Text>
                      <Text style={styles.screenshotText}>Tap to pick image</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {screenshotUri && (
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => Alert.alert('AI', 'Processing screenshot... (connect API)')}
                  >
                    <Text style={styles.saveBtnText}>✨ Parse Screenshot</Text>
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
  aiTab: { gap: 16, paddingBottom: 40 },
  aiHint: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
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
