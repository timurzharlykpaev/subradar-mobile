import { useTranslation } from 'react-i18next';
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useSettingsStore } from '../stores/settingsStore';
import { Subscription } from '../types';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { CardBrand } from '../types';
import { useTheme } from '../theme';
import { NumericInput } from './NumericInput';
import { DoneAccessoryInput } from './primitives/DoneAccessoryInput';
import { DatePickerField } from './DatePickerField';
import { CurrencyPicker } from './CurrencyPicker';

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

const REMINDER_OPTIONS = [1, 3, 7] as const;

// Same palette ManualFormView uses — keep them visually identical between
// Add and Edit so a sub picked at create-time matches its edit-screen
// preview.
const COLOR_PALETTE = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4', '#6B7280'];

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
    // Newly editable fields — without these the user could not correct
    // wrong dates set at AI-import time, change plan tier (Basic→Premium),
    // patch a missing service / cancel URL, or recolour the card.
    startDate: '',
    nextPaymentDate: '',
    serviceUrl: '',
    cancelUrl: '',
    currentPlan: '',
    color: '',
    isTrial: false,
    trialEndDate: '',
  });

  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ nickname: '', last4: '', brand: 'VISA' as CardBrand });
  const [addingCard, setAddingCard] = useState(false);

  useEffect(() => {
    if (visible && subscription) {
      const sub = subscription as any;
      // ISO timestamps from the backend may include time — strip to YYYY-MM-DD
      // so DatePickerField can match its `selectedDay` and the value round-trips
      // cleanly back to the API.
      const toDateStr = (v: any): string => {
        if (!v) return '';
        if (typeof v === 'string') return v.split('T')[0];
        try {
          const d = new Date(v);
          return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        } catch {
          return '';
        }
      };
      setForm({
        name: sub.name ?? '',
        amount: String(sub.amount ?? ''),
        currency: sub.currency ?? 'USD',
        billingPeriod: sub.billingPeriod ?? 'MONTHLY',
        category: sub.category ?? 'OTHER',
        billingDay: String(sub.billingDay ?? 1),
        paymentCardId: sub.paymentCardId ?? '',
        notes: sub.notes ?? '',
        tags: (sub.tags ?? []).join(', '),
        reminderDaysBefore: sub.reminderDaysBefore ?? [],
        startDate: toDateStr(sub.startDate),
        nextPaymentDate: toDateStr(sub.nextPaymentDate),
        serviceUrl: sub.serviceUrl ?? '',
        cancelUrl: sub.cancelUrl ?? '',
        currentPlan: sub.currentPlan ?? '',
        color: sub.color ?? '',
        isTrial: sub.status === 'TRIAL',
        trialEndDate: toDateStr(sub.trialEndDate),
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
        // Send only when the user actually filled it — empty strings would
        // overwrite valid backend data with NULLs on PATCH.
        startDate: form.startDate || undefined,
        nextPaymentDate: form.nextPaymentDate || undefined,
        serviceUrl: form.serviceUrl.trim() || undefined,
        cancelUrl: form.cancelUrl.trim() || undefined,
        currentPlan: form.currentPlan.trim() || undefined,
        color: form.color || undefined,
        // Trial state lives on `status` server-side. Only flip it when the
        // user explicitly toggles the trial switch — leaves PAUSED /
        // CANCELLED rows alone.
        //
        // We use `undefined` (omits the key from the JSON body) instead of
        // `null` because the backend DTO declares `trialEndDate` with
        // `@IsDateString()` from class-validator, which rejects null and
        // returns 400. Until the backend adds a nullable transform, exiting
        // a trial just flips status — the stale trialEndDate stays in the
        // row but is ignored once status !== 'TRIAL'.
        ...(form.isTrial
          ? { status: 'TRIAL', trialEndDate: form.trialEndDate || undefined }
          : subscription.status === 'TRIAL'
            ? { status: 'ACTIVE' }
            : {}),
      };
      // Backend recomputes nextPaymentDate when billingDay/Period/startDate
      // changes — use the response, not the request payload, so the card shows
      // the new "в X дн." label immediately.
      const res = await subscriptionsApi.update(subscription.id, payload);
      updateSubscription(subscription.id, res.data ?? payload);
      // PATCH /subscriptions/:id returns the raw entity (no displayAmount /
      // displayCurrency / fxRate — those are augmented only on the list
      // endpoint via findAllWithDisplay). Without re-fetching, the home
      // screen and detail card keep showing the OLD displayAmount/
      // displayCurrency merged from the previous list payload — the user
      // saw "ничего не изменилось" until pull-to-refresh. Fire-and-forget
      // is safe here: handleClose runs immediately, the store update on
      // resolve replaces the row in-place.
      const displayCurrency = useSettingsStore.getState().displayCurrency;
      subscriptionsApi
        .getAll({ displayCurrency })
        .then((r) => {
          if (Array.isArray(r.data)) {
            useSubscriptionsStore.getState().setSubscriptions(r.data);
          }
        })
        .catch(() => undefined);
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

  // Memoized so the inputs (each wrapped in React.memo) don't re-render on
  // every keystroke just because the parent rebuilt these style objects.
  // Without this each `setForm` keystroke would invalidate every other
  // input's memo, dragging the InputAccessoryView toolbar with it.
  const fieldLabel = useMemo(
    () => ({
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    }),
    [colors.textMuted],
  );
  const inputStyle = useMemo(
    () => ({
      backgroundColor: colors.surface2,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    }),
    [colors.surface2, colors.text, colors.border],
  );
  const notesInputStyle = useMemo(
    () => [inputStyle, { height: 80, textAlignVertical: 'top' as const, paddingTop: 12 }],
    [inputStyle],
  );

  // Stable per-field setters — each input only re-renders when its own value
  // changes (memoized component + stable onChange identity).
  const onChangeName = useCallback((v: string) => setForm((f) => ({ ...f, name: v })), []);
  const onChangeAmount = useCallback((v: string) => setForm((f) => ({ ...f, amount: v })), []);
  const onChangeBillingDay = useCallback((v: string) => {
    const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
    if (!v || isNaN(num)) {
      setForm((f) => ({ ...f, billingDay: '' }));
      return;
    }
    setForm((f) => ({ ...f, billingDay: String(Math.min(Math.max(num, 1), 31)) }));
  }, []);
  const onChangeTags = useCallback((v: string) => setForm((f) => ({ ...f, tags: v })), []);
  const onChangeNotes = useCallback((v: string) => setForm((f) => ({ ...f, notes: v })), []);
  const onChangeCardNickname = useCallback(
    (v: string) => setNewCard((c) => ({ ...c, nickname: v })),
    [],
  );
  const onChangeCardLast4 = useCallback(
    (v: string) => setNewCard((c) => ({ ...c, last4: v.replace(/\D/g, '').slice(0, 4) })),
    [],
  );
  const onChangeServiceUrl = useCallback(
    (v: string) => setForm((f) => ({ ...f, serviceUrl: v })),
    [],
  );
  const onChangeCancelUrl = useCallback(
    (v: string) => setForm((f) => ({ ...f, cancelUrl: v })),
    [],
  );
  const onChangeCurrentPlan = useCallback(
    (v: string) => setForm((f) => ({ ...f, currentPlan: v })),
    [],
  );
  const onChangeStartDate = useCallback(
    (v: string) => setForm((f) => ({ ...f, startDate: v })),
    [],
  );
  const onChangeNextPaymentDate = useCallback(
    (v: string) => setForm((f) => ({ ...f, nextPaymentDate: v })),
    [],
  );
  const onChangeTrialEndDate = useCallback(
    (v: string) => setForm((f) => ({ ...f, trialEndDate: v })),
    [],
  );
  const onToggleTrial = useCallback(
    () => setForm((f) => ({ ...f, isTrial: !f.isTrial })),
    [],
  );
  const onPickColor = useCallback(
    (c: string) => setForm((f) => ({ ...f, color: f.color === c ? '' : c })),
    [],
  );
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const onPickCurrency = useCallback(
    (c: string) => {
      setForm((f) => ({ ...f, currency: c }));
      setCurrencyPickerVisible(false);
    },
    [],
  );

  const toggleReminderDay = useCallback((day: number) => {
    setForm((f) => {
      const cur = f.reminderDaysBefore ?? [];
      const next = cur.includes(day)
        ? cur.filter((d) => d !== day)
        : [...cur, day].sort((a, b) => a - b);
      return { ...f, reminderDaysBefore: next };
    });
  }, []);
  const clearReminders = useCallback(
    () => setForm((f) => ({ ...f, reminderDaysBefore: [] })),
    [],
  );

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
          // The previous SCREEN_HEIGHT*0.1+28 offset over-shifted iOS:
          // KAV pushed the entire ScrollView up by ~10% of the screen
          // *plus* the keyboard pushed the focused input above the
          // visible area, so the user couldn't see what they were
          // typing. We now lean on the ScrollView's
          // `automaticallyAdjustKeyboardInsets` (iOS native) to scroll
          // the focused input just above the keyboard, while KAV with a
          // zero offset keeps the layout stable. Net effect: keyboard
          // appears at the bottom, the focused input is right above it,
          // nothing flies away.
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}
        >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>{t('subscription.edit_title')}</Text>
              <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
              contentInsetAdjustmentBehavior="automatic"
            >
              <View style={styles.form}>
                {/* Name */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.name')}</Text>
                  <DoneAccessoryInput
                    style={inputStyle}
                    value={form.name}
                    onChangeText={onChangeName}
                    placeholder={t('add.name_placeholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Amount + Currency — kept as a pair on one row so the
                    user can never enter an amount in a currency they
                    can't see. The currency button opens a full picker
                    (search + 40+ codes) instead of a tiny dropdown. */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.amount')}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <NumericInput
                        style={inputStyle}
                        value={form.amount}
                        onChangeText={onChangeAmount}
                        placeholder="9.99"
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.textMuted}
                        accessoryId="edit-amount"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => setCurrencyPickerVisible(true)}
                      activeOpacity={0.7}
                      style={[
                        inputStyle,
                        {
                          minWidth: 96,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t('add.currency', 'Currency')}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {form.currency || 'USD'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
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
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    automaticallyAdjustKeyboardInsets
                    contentInsetAdjustmentBehavior="automatic"
                  >
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
                    onChangeText={onChangeBillingDay}
                    placeholder="1"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textMuted}
                    maxLength={2}
                    accessoryId="edit-billing-day"
                  />
                </View>

                {/* Start date / Next payment date — let the user correct
                    dates the AI got wrong or backfill missing ones. The
                    backend recomputes derived fields on update so it's safe
                    to send only what changed. */}
                <View style={styles.field}>
                  <DatePickerField
                    label={t('add.start_date', 'Start date')}
                    value={form.startDate}
                    onChange={onChangeStartDate}
                  />
                </View>
                <View style={styles.field}>
                  <DatePickerField
                    label={t('add.next_payment', 'Next payment date')}
                    value={form.nextPaymentDate}
                    onChange={onChangeNextPaymentDate}
                  />
                </View>

                {/* Payment Card */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.card')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    automaticallyAdjustKeyboardInsets
                    contentInsetAdjustmentBehavior="automatic"
                  >
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
                      <DoneAccessoryInput
                        style={inputStyle}
                        value={newCard.nickname}
                        onChangeText={onChangeCardNickname}
                        placeholder={t('add.card_nickname_example')}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={fieldLabel}>{t('subscription.card_last4')}</Text>
                      <NumericInput
                        style={inputStyle}
                        value={newCard.last4}
                        onChangeText={onChangeCardLast4}
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
                  <DoneAccessoryInput
                    style={inputStyle}
                    value={form.tags}
                    onChangeText={onChangeTags}
                    placeholder={t('add.tags_placeholder', 'work, personal, shared')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Notes */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.notes')}</Text>
                  <DoneAccessoryInput
                    style={notesInputStyle}
                    value={form.notes}
                    onChangeText={onChangeNotes}
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
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor:
                          form.reminderDaysBefore.length === 0 ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor:
                          form.reminderDaysBefore.length === 0 ? colors.primary : colors.border,
                      }}
                      onPress={clearReminders}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: form.reminderDaysBefore.length === 0 ? '#FFF' : colors.text,
                        }}
                      >
                        {t('add.reminder_off', 'Off')}
                      </Text>
                    </TouchableOpacity>
                    {REMINDER_OPTIONS.map((day) => {
                      const active = form.reminderDaysBefore.includes(day);
                      return (
                        <TouchableOpacity
                          key={day}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: active ? colors.primary : colors.background,
                            borderWidth: 1,
                            borderColor: active ? colors.primary : colors.border,
                          }}
                          onPress={() => toggleReminderDay(day)}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '600',
                              color: active ? '#FFF' : colors.text,
                            }}
                          >
                            {`${day}d`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {/* Legacy non-standard days (e.g. [2] from older data) */}
                    {form.reminderDaysBefore
                      .filter((d) => !(REMINDER_OPTIONS as readonly number[]).includes(d))
                      .map((day) => (
                        <TouchableOpacity
                          key={`legacy-${day}`}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: colors.primary,
                            borderWidth: 1,
                            borderColor: colors.primary,
                          }}
                          onPress={() => toggleReminderDay(day)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>{`${day}d`}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>

                {/* Plan / URLs / Color / Trial — moved out of "More options"
                    in the Add flow into the canonical edit form so the user
                    can correct anything captured at AI-import time. */}
                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.current_plan', 'Current plan')}</Text>
                  <DoneAccessoryInput
                    style={inputStyle}
                    value={form.currentPlan}
                    onChangeText={onChangeCurrentPlan}
                    placeholder={t('add.current_plan_placeholder', 'Premium, Family, etc.')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.service_url', 'Service URL')}</Text>
                  <DoneAccessoryInput
                    style={inputStyle}
                    value={form.serviceUrl}
                    onChangeText={onChangeServiceUrl}
                    placeholder="https://service.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.cancel_url', 'Cancel URL')}</Text>
                  <DoneAccessoryInput
                    style={inputStyle}
                    value={form.cancelUrl}
                    onChangeText={onChangeCancelUrl}
                    placeholder="https://service.com/cancel"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={fieldLabel}>{t('add.color', 'Color')}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: !form.color ? colors.primary : colors.border,
                        backgroundColor: colors.surface2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={() => onPickColor('')}
                      accessibilityLabel={t('add.color_auto', 'Auto')}
                    >
                      <Ionicons name="close" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                    {COLOR_PALETTE.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: c,
                          borderWidth: 3,
                          borderColor: form.color === c ? colors.text : 'transparent',
                        }}
                        onPress={() => onPickColor(c)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.field}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={fieldLabel}>{t('add.trial_period', 'Trial')}</Text>
                    <TouchableOpacity
                      style={{
                        width: 48,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: form.isTrial ? colors.primary : colors.surface2,
                        padding: 3,
                        justifyContent: 'center',
                        alignItems: form.isTrial ? 'flex-end' : 'flex-start',
                      }}
                      onPress={onToggleTrial}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: form.isTrial }}
                    >
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF' }} />
                    </TouchableOpacity>
                  </View>
                  {form.isTrial && (
                    <View style={{ marginTop: 12 }}>
                      <DatePickerField
                        label={t('add.trial_end_date', 'Trial ends on')}
                        value={form.trialEndDate}
                        onChange={onChangeTrialEndDate}
                      />
                    </View>
                  )}
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

      <CurrencyPicker
        visible={currencyPickerVisible}
        selected={form.currency || 'USD'}
        onSelect={onPickCurrency}
        onClose={() => setCurrencyPickerVisible(false)}
        title={t('add.currency', 'Currency')}
      />
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
