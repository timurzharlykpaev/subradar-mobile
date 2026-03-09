import { useTranslation } from 'react-i18next';
import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { COLORS, CATEGORIES, CURRENCIES, BILLING_PERIODS, CARD_BRANDS } from '../constants';
import { subscriptionsApi } from '../api/subscriptions';
import { cardsApi } from '../api/cards';
import { useSubscriptionsStore, Subscription } from '../stores/subscriptionsStore';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { CardBrand } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  subscription: Subscription;
}

export function EditSubscriptionSheet({ visible, onClose, subscription }: Props) {
  const { t } = useTranslation();
  const { updateSubscription } = useSubscriptionsStore();
  const { cards, addCard } = usePaymentCardsStore();

  const [form, setForm] = useState({
    name: '',
    amount: '',
    currency: 'USD',
    billingPeriod: 'MONTHLY' as string,
    category: 'OTHER',
    billingDay: '1',
    paymentCardId: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);
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
      const payload: Record<string, any> = {
        name: form.name.trim(),
        amount: parseFloat(form.amount),
        currency: form.currency,
        billingPeriod: form.billingPeriod,
        category: form.category,
        billingDay: day,
        notes: form.notes.trim() || undefined,
        paymentCardId: form.paymentCardId || undefined,
      };
      await subscriptionsApi.update(subscription.id, payload);
      updateSubscription(subscription.id, payload);
      onClose();
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContainer}
        >
          <View style={styles.sheet}>
            <View style={styles.handleBar} />

            <View style={styles.header}>
              <Text style={styles.title}>{t('subscription.edit_title')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.form}>
                {/* Name */}
                <Field label={t('add.name') + ' *'}>
                  <TextInput
                    style={styles.input}
                    value={form.name}
                    onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                    placeholder="Netflix, Spotify..."
                    placeholderTextColor={COLORS.textMuted}
                  />
                </Field>

                {/* Amount + Currency */}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Field label={t('add.amount') + ' *'}>
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
                    <Field label={t('add.currency')}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chips}>
                          {CURRENCIES.map((cur) => (
                            <TouchableOpacity
                              key={cur}
                              style={[styles.chip, form.currency === cur && styles.chipActive]}
                              onPress={() => setForm((f) => ({ ...f, currency: cur }))}
                            >
                              <Text style={form.currency === cur ? styles.chipActiveText : styles.chipText}>
                                {cur}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </Field>
                  </View>
                </View>

                {/* Billing Period */}
                <Field label={t('add.billing_cycle')}>
                  <View style={styles.chips}>
                    {BILLING_PERIODS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.chip, form.billingPeriod === p && styles.chipActive]}
                        onPress={() => setForm((f) => ({ ...f, billingPeriod: p }))}
                      >
                        <Text style={form.billingPeriod === p ? styles.chipActiveText : styles.chipText}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>

                {/* Category */}
                <Field label={t('add.category')}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chips}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.chip,
                            form.category === cat.id && { backgroundColor: cat.color, borderColor: cat.color },
                          ]}
                          onPress={() => setForm((f) => ({ ...f, category: cat.id }))}
                        >
                          <Text style={form.category === cat.id ? styles.chipActiveText : styles.chipText}>
                            {cat.emoji} {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </Field>

                {/* Billing Day */}
                <Field label={t('subscription.billing_day') + ' (1-31)'}>
                  <TextInput
                    style={styles.input}
                    value={form.billingDay}
                    onChangeText={(v) => setForm((f) => ({ ...f, billingDay: v }))}
                    placeholder="1"
                    keyboardType="number-pad"
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={2}
                  />
                </Field>

                {/* Payment Card */}
                <Field label={t('add.card')}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chips}>
                      <TouchableOpacity
                        style={[styles.chip, !form.paymentCardId && styles.chipActive]}
                        onPress={() => setForm((f) => ({ ...f, paymentCardId: '' }))}
                      >
                        <Text style={!form.paymentCardId ? styles.chipActiveText : styles.chipText}>
                          {t('add.no_card')}
                        </Text>
                      </TouchableOpacity>
                      {cards.map((card) => (
                        <TouchableOpacity
                          key={card.id}
                          style={[styles.chip, form.paymentCardId === card.id && styles.chipActive]}
                          onPress={() => setForm((f) => ({ ...f, paymentCardId: card.id }))}
                        >
                          <Text style={form.paymentCardId === card.id ? styles.chipActiveText : styles.chipText}>
                            ····{card.last4} ({card.brand})
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[styles.chip, styles.addCardChip]}
                        onPress={() => setShowAddCard((v) => !v)}
                      >
                        <Text style={styles.addCardChipText}>+ {t('subscription.add_card')}</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </Field>

                {/* Inline Add Card */}
                {showAddCard && (
                  <View style={styles.addCardBox}>
                    <Field label={t('subscription.card_nickname')}>
                      <TextInput
                        style={styles.input}
                        value={newCard.nickname}
                        onChangeText={(v) => setNewCard((c) => ({ ...c, nickname: v }))}
                        placeholder="My Visa"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </Field>
                    <Field label={t('subscription.card_last4')}>
                      <TextInput
                        style={styles.input}
                        value={newCard.last4}
                        onChangeText={(v) => setNewCard((c) => ({ ...c, last4: v.replace(/\D/g, '').slice(0, 4) }))}
                        placeholder="1234"
                        keyboardType="number-pad"
                        placeholderTextColor={COLORS.textMuted}
                        maxLength={4}
                      />
                    </Field>
                    <Field label={t('subscription.card_brand')}>
                      <View style={styles.chips}>
                        {CARD_BRANDS.map((b) => (
                          <TouchableOpacity
                            key={b}
                            style={[styles.chip, newCard.brand === b && styles.chipActive]}
                            onPress={() => setNewCard((c) => ({ ...c, brand: b }))}
                          >
                            <Text style={newCard.brand === b ? styles.chipActiveText : styles.chipText}>{b}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Field>
                    <TouchableOpacity
                      style={[styles.addCardBtn, addingCard && { opacity: 0.6 }]}
                      onPress={handleAddCard}
                      disabled={addingCard}
                    >
                      {addingCard ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.addCardBtnText}>{t('subscription.save_card')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Notes */}
                <Field label={t('add.notes')}>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={form.notes}
                    onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                    placeholder={t('add.notes')}
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </Field>

                {/* Actions */}
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '90%',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '100%',
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
  content: { paddingHorizontal: 20 },
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
  chipText: { color: COLORS.text },
  chipActiveText: { color: '#FFF', fontWeight: '700' },
  addCardChip: {
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  addCardChipText: { color: COLORS.primary, fontWeight: '600' },
  addCardBox: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addCardBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addCardBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
});
