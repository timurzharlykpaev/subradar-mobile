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
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, CURRENCIES, BILLING_PERIODS, CARD_BRANDS } from '../constants';
import { CategoryIcon } from './icons';
import { subscriptionsApi } from '../api/subscriptions';
import { cardsApi } from '../api/cards';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';
import { Subscription } from '../types';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { CardBrand } from '../types';
import { useTheme } from '../theme';
import { NumericInput } from './NumericInput';

interface Props {
  visible: boolean;
  onClose: () => void;
  subscription: Subscription;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PERIOD_LABELS: Record<string, string> = {
  WEEKLY: 'billing.weekly',
  MONTHLY: 'billing.monthly',
  QUARTERLY: 'billing.quarterly',
  YEARLY: 'billing.yearly',
  LIFETIME: 'billing.lifetime',
  ONE_TIME: 'billing.one_time',
};

export function EditSubscriptionSheet({ visible, onClose, subscription }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { updateSubscription } = useSubscriptionsStore();
  const { cards, addCard } = usePaymentCardsStore();

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [saving, setSaving] = useState(false);

  const handleClose = useCallback(() => {
    if (saving) return;
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [saving, onClose, slideAnim]);

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

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible]);

  const [form, setForm] = useState({
    name: '',
    amount: '',
    currency: 'USD',
    billingPeriod: 'MONTHLY' as string,
    category: 'OTHER',
    billingDay: '1',
    paymentCardId: '',
    notes: '',
    tags: '' as string,
    reminderDaysBefore: [] as number[],
  });

  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ nickname: '', last4: '', brand: 'VISA' as CardBrand });
  const [addingCard, setAddingCard] = useState(false);

  useEffect(() => {
    if (visible && subscription) {
      setForm({
        name: subscription.name ?? '',
        amount: String(subscription.amount ?? ''),
        currency: subscription.currency ?? 'USD',
        billingPeriod: subscription.billingPeriod ?? 'MONTHLY',
        category: subscription.category ?? 'OTHER',
        billingDay: String(subscription.billingDay ?? 1),
        paymentCardId: subscription.paymentCardId ?? '',
        notes: subscription.notes ?? '',
        tags: (subscription.tags ?? []).join(', '),
        reminderDaysBefore: (subscription as any).reminderDaysBefore ?? [],
      });
      setShowAddCard(false);
    }
  }, [visible, subscription]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.amount.trim()) {
      Alert.alert(t('add.required'), t('add.fill_required'));
      return;
    }
    const day = parseInt(form.billingDay);
    if (isNaN(day) || day < 1 || day > 31) {
      Alert.alert(t('add.required'), t('subscription.invalid_billing_day'));
      return;
    }
    setSaving(true);
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: Record<string, any> = {
        name: form.name.trim(),
        amount: parseFloat(form.amount),
        currency: form.currency,
        billingPeriod: (form.billingPeriod || 'MONTHLY').toUpperCase(),
        category: (form.category || 'OTHER').toUpperCase(),
        billingDay: day,
        notes: form.notes.trim() || undefined,
        paymentCardId: form.paymentCardId || undefined,
        tags: tags.length > 0 ? tags : undefined,
        reminderDaysBefore: form.reminderDaysBefore.length > 0 ? form.reminderDaysBefore : undefined,
        reminderEnabled: form.reminderDaysBefore.length > 0,
      };
      // Backend recomputes nextPaymentDate when billingDay/Period/startDate
      // changes — use the response, not the request payload, so the card shows
      // the new "в X дн." label immediately.
      const res = await subscriptionsApi.update(subscription.id, payload);
      updateSubscription(subscription.id, res.data ?? payload);
      handleClose();
    } catch {
      Alert.alert(t('common.error'), '');
    } finally {
      setSaving(false);
    }
  }, [form, subscription.id, onClose, updateSubscription, t]);

  const handleAddCard = useCallback(async () => {
    if (!newCard.nickname.trim() || !newCard.last4.trim()) {
      Alert.alert(t('add.required'), t('subscription.fill_card_fields'));
      return;
    }
    if (!/^\d{4}$/.test(newCard.last4)) {
      Alert.alert(t('add.required'), t('subscription.invalid_last4'));
      return;
    }
    setAddingCard(true);
    try {
      const res = await cardsApi.create({
        nickname: newCard.nickname.trim(),
        last4: newCard.last4,
        brand: newCard.brand,
      });
      addCard(res.data);
      setForm((f) => ({ ...f, paymentCardId: res.data.id }));
      setShowAddCard(false);
      setNewCard({ nickname: '', last4: '', brand: 'VISA' });
    } catch {
      Alert.alert(t('common.error'), '');
    } finally {
      setAddingCard(false);
    }
  }, [newCard, addCard, t]);

  const fieldLabel = { fontSize: 12, fontWeight: '600' as const, color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
  const inputStyle = { backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
      </TouchableWithoutFeedback>

      <Animated.View testID="edit-sub-sheet" style={[styles.sheet, { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] }]}>
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={{ paddingVertical: 12, alignItems: 'center' }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>{t('subscription.edit_title')}</Text>
              <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.form}>
                {/* Name */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.name')}</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.name}
                    onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                    placeholder={t('add.name_placeholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Amount */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.amount')}</Text>
                  <NumericInput
                    style={inputStyle}
                    value={form.amount}
                    onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
                    placeholder="9.99"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textMuted}
                    accessoryId="edit-amount"
                  />
                </View>

                {/* Billing Period */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.billing_cycle')}</Text>
                  <View style={styles.chips}>
                    {BILLING_PERIODS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.border },
                          form.billingPeriod === p && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setForm((f) => ({ ...f, billingPeriod: p }))}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: form.billingPeriod === p ? '#FFF' : colors.text }}>
                          {t(PERIOD_LABELS[p] || p, p)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Category */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.category')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chips}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.border },
                            form.category === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                          onPress={() => setForm((f) => ({ ...f, category: cat.id }))}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <CategoryIcon category={cat.id} size={14} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: form.category === cat.id ? '#FFF' : colors.text }}>
                              {t(`categories.${cat.id.toLowerCase()}`, cat.label)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Billing Day */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('subscription.billing_day')} (1-31)</Text>
                  <NumericInput
                    style={inputStyle}
                    value={form.billingDay}
                    onChangeText={(v) => {
                      const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                      if (!v || isNaN(num)) { setForm((f) => ({ ...f, billingDay: '' })); return; }
                      setForm((f) => ({ ...f, billingDay: String(Math.min(Math.max(num, 1), 31)) }));
                    }}
                    placeholder="1"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textMuted}
                    maxLength={2}
                    accessoryId="edit-billing-day"
                  />
                </View>

                {/* Payment Card */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.card')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chips}>
                      <TouchableOpacity
                        style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.border },
                          !form.paymentCardId && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setForm((f) => ({ ...f, paymentCardId: '' }))}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: !form.paymentCardId ? '#FFF' : colors.text }}>
                          {t('add.no_card')}
                        </Text>
                      </TouchableOpacity>
                      {cards.map((card) => (
                        <TouchableOpacity
                          key={card.id}
                          style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.border },
                            form.paymentCardId === card.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                          onPress={() => setForm((f) => ({ ...f, paymentCardId: card.id }))}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '600', color: form.paymentCardId === card.id ? '#FFF' : colors.text }}>
                            ····{card.last4} ({card.brand})
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[styles.chip, { borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: 'transparent' }]}
                        onPress={() => setShowAddCard((v) => !v)}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>+ {t('subscription.add_card')}</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>

                {/* Inline Add Card */}
                {showAddCard && (
                  <View style={[styles.addCardBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                    <View style={styles.field}>
                      <Text style={fieldLabel}>{t('subscription.card_nickname')}</Text>
                      <TextInput
                        style={inputStyle}
                        value={newCard.nickname}
                        onChangeText={(v) => setNewCard((c) => ({ ...c, nickname: v }))}
                        placeholder={t('add.card_nickname_example')}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={fieldLabel}>{t('subscription.card_last4')}</Text>
                      <NumericInput
                        style={inputStyle}
                        value={newCard.last4}
                        onChangeText={(v) => setNewCard((c) => ({ ...c, last4: v.replace(/\D/g, '').slice(0, 4) }))}
                        placeholder="1234"
                        keyboardType="number-pad"
                        placeholderTextColor={colors.textMuted}
                        maxLength={4}
                        accessoryId="edit-card-last4"
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={fieldLabel}>{t('subscription.card_brand')}</Text>
                      <View style={styles.chips}>
                        {CARD_BRANDS.map((b) => (
                          <TouchableOpacity
                            key={b}
                            style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.border },
                              newCard.brand === b && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                            onPress={() => setNewCard((c) => ({ ...c, brand: b }))}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: newCard.brand === b ? '#FFF' : colors.text }}>{b}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: colors.success }, addingCard && { opacity: 0.6 }]}
                      onPress={handleAddCard}
                      disabled={addingCard}
                    >
                      {addingCard ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.saveBtnText}>{t('subscription.save_card')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Tags */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.tags', 'Tags')}</Text>
                  <TextInput
                    style={inputStyle}
                    value={form.tags}
                    onChangeText={(v) => setForm((f) => ({ ...f, tags: v }))}
                    placeholder={t('add.tags_placeholder', 'work, personal, shared')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Notes */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.notes')}</Text>
                  <TextInput
                    style={[inputStyle, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                    value={form.notes}
                    onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                    placeholder={t('add.notes')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Reminder — multi-select: reflect any persisted day (e.g. [2], [1,3]) */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={fieldLabel}>{t('add.reminder', 'Reminder')}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {(() => {
                      const OPTIONS = [1, 3, 7];
                      const selected = form.reminderDaysBefore ?? [];
                      const isOff = selected.length === 0;
                      const toggle = (day: number) => {
                        setForm((f) => {
                          const cur = f.reminderDaysBefore ?? [];
                          const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort((a, b) => a - b);
                          return { ...f, reminderDaysBefore: next };
                        });
                      };
                      return (
                        <>
                          <TouchableOpacity
                            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: isOff ? colors.primary : colors.background, borderWidth: 1, borderColor: isOff ? colors.primary : colors.border }}
                            onPress={() => setForm((f) => ({ ...f, reminderDaysBefore: [] }))}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '600', color: isOff ? '#FFF' : colors.text }}>{t('add.reminder_off', 'Off')}</Text>
                          </TouchableOpacity>
                          {OPTIONS.map((day) => {
                            const active = selected.includes(day);
                            return (
                              <TouchableOpacity
                                key={day}
                                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: active ? colors.primary : colors.background, borderWidth: 1, borderColor: active ? colors.primary : colors.border }}
                                onPress={() => toggle(day)}
                              >
                                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#FFF' : colors.text }}>{`${day}d`}</Text>
                              </TouchableOpacity>
                            );
                          })}
                          {/* Legacy non-standard days (e.g. [2] from older data) */}
                          {selected.filter((d) => !OPTIONS.includes(d)).map((day) => (
                            <TouchableOpacity
                              key={`legacy-${day}`}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary }}
                              onPress={() => toggle(day)}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>{`${day}d`}</Text>
                            </TouchableOpacity>
                          ))}
                        </>
                      );
                    })()}
                  </View>
                </View>

                {/* Actions */}
                <TouchableOpacity
                  testID="btn-save-edit"
                  style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity testID="btn-cancel-edit" style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={handleClose}>
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20 },
  form: { paddingBottom: 40 },
  field: { marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  addCardBox: { borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8, borderWidth: 1 },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
});
