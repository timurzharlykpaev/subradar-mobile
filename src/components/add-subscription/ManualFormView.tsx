import React, { memo, useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../theme';
import { usePaymentCardsStore } from '../../stores/paymentCardsStore';
import { CATEGORIES, BILLING_PERIODS } from '../../constants';
import { DatePickerField } from '../DatePickerField';
import { NumericInput } from '../NumericInput';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import { CurrencyPicker } from '../CurrencyPicker';
import { GiftIcon } from '../icons';
import type { AddSubscriptionForm, AddSubscriptionFormCtx } from './useAddSubscriptionForm';

interface Props {
  form: AddSubscriptionFormCtx['form'];
  setF: AddSubscriptionFormCtx['setF'];
  setForm: AddSubscriptionFormCtx['setForm'];
  moreExpanded: boolean;
  setMoreExpanded: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const REMINDER_PRESETS: Array<{ i18nKey: string; fallback: string; value: number[] }> = [
  { i18nKey: 'add.reminder_off', fallback: 'Off', value: [] },
  { i18nKey: 'add.reminder_1d', fallback: '1d', value: [1] },
  { i18nKey: 'add.reminder_3d', fallback: '3d', value: [3] },
  { i18nKey: 'add.reminder_7d', fallback: '7d', value: [7] },
];

const CARD_COLOR_PALETTE = [
  '#3B82F6',
  '#10B981',
  '#EF4444',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#6B7280',
];

/**
 * Manual "Add subscription" form body — extracted from AddSubscriptionSheet so
 * a keystroke in `name`/`amount`/`notes` re-renders ~400 lines instead of the
 * full 1300-line sheet. The orchestrator owns flow state, network calls and
 * navigation; this view is a pure form over `AddSubscriptionForm`.
 *
 * All TextInput fields use DoneAccessoryInput to get a consistent iOS "Done"
 * toolbar; numeric fields keep the NumericInput shim for call-site clarity.
 */
function ManualFormViewImpl({
  form,
  setF,
  setForm,
  moreExpanded,
  setMoreExpanded,
  saving,
  onSave,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cards = usePaymentCardsStore((s) => s.cards);

  // Theme-dependent inputs: memoize so unchanged-theme renders reuse the style
  // object (React.memo on children would see stable prop identity).
  const inputStyle = useMemo(() => ({
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    letterSpacing: 0,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  }), [colors.background, colors.text, colors.border]);

  // Stable per-field text handlers — prevents the inline `(v) => setF('name', v)`
  // arrow from invalidating DoneAccessoryInput's React.memo on every keystroke
  // in any other field.
  const handleName = useCallback((v: string) => setF('name', v), [setF]);
  const handleAmount = useCallback((v: string) => setF('amount', v), [setF]);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const onPickCurrency = useCallback(
    (c: string) => {
      setF('currency', c);
      setCurrencyPickerVisible(false);
    },
    [setF],
  );
  const handleCurrentPlan = useCallback((v: string) => setF('currentPlan', v), [setF]);
  const handleServiceUrl = useCallback((v: string) => setF('serviceUrl', v), [setF]);
  const handleCancelUrl = useCallback((v: string) => setF('cancelUrl', v), [setF]);
  const handleNotes = useCallback((v: string) => setF('notes', v), [setF]);

  const canSave = form.name.trim() !== '' && parseFloat(form.amount) > 0;

  return (
    <View style={{ paddingBottom: 40 }}>
      {/* Back to main */}
      <TouchableOpacity
        onPress={onCancel}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 }}
      >
        <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>{t('common.back', 'Back')}</Text>
      </TouchableOpacity>

      {/* Essential fields */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
          {t('add.name')} *
        </Text>
        <DoneAccessoryInput
          testID="name-input"
          style={inputStyle}
          value={form.name}
          onChangeText={handleName}
          placeholder={t('add.name_placeholder')}
          placeholderTextColor={colors.textMuted}
          accessoryId="manual-name"
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
          {t('add.amount')} *
        </Text>
        {/* Amount + Currency on one row — without an explicit currency
            picker the user previously could only type a number and the
            sub silently inherited their displayCurrency. After
            switching display to a different currency they ended up with
            mixed-currency totals (a sub stored in USD shown as KZT and
            vice-versa). Showing the currency right next to the amount
            makes the unit unambiguous. */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <NumericInput
              testID="amount-input"
              style={inputStyle}
              value={form.amount}
              onChangeText={handleAmount}
              placeholder="9.99"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
              accessoryId="manual-amount"
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

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
          {t('add.billing_cycle')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="automatic"
        >
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
                  {t(`billing.${p.toLowerCase()}`, p)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <DatePickerField
        label={t('add.start_date', 'Start date')}
        value={form.startDate}
        onChange={(v) => setF('startDate', v)}
      />
      <DatePickerField
        label={t('add.next_payment', 'Next payment date')}
        value={form.nextPaymentDate}
        onChange={(v) => setF('nextPaymentDate', v)}
      />

      {/* "More" toggle */}
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

      {/* Optional fields */}
      {moreExpanded && (
        <View style={{ marginTop: 8 }}>
          {/* Category */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              {t('add.category')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              contentInsetAdjustmentBehavior="automatic"
            >
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
                      {t(`categories.${cat.id.toLowerCase()}`, cat.label)}
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                contentInsetAdjustmentBehavior="automatic"
              >
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
            <DoneAccessoryInput
              style={inputStyle}
              value={form.currentPlan}
              onChangeText={handleCurrentPlan}
              placeholder={t('add.plan_placeholder')}
              placeholderTextColor={colors.textMuted}
              accessoryId="manual-plan"
            />
          </View>

          {/* Service URL */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
              {t('add.website')}
            </Text>
            <DoneAccessoryInput
              style={inputStyle}
              value={form.serviceUrl}
              onChangeText={handleServiceUrl}
              placeholder="https://netflix.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
              accessoryId="manual-service-url"
            />
          </View>

          {/* Cancel URL */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
              {t('add.cancel_url', 'Cancel URL')}
            </Text>
            <DoneAccessoryInput
              style={inputStyle}
              value={form.cancelUrl}
              onChangeText={handleCancelUrl}
              placeholder="https://netflix.com/cancelplan"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
              accessoryId="manual-cancel-url"
            />
          </View>

          {/* Billing Day */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
              {t('add.billing_day', 'Billing day')}
            </Text>
            <NumericInput
              style={inputStyle}
              value={form.billingDay}
              onChangeText={(v) => {
                const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                if (!v || isNaN(num)) { setF('billingDay', ''); return; }
                setF('billingDay', String(Math.min(Math.max(num, 1), 31)));
              }}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={2}
              accessoryId="manual-billing-day"
            />
          </View>

          {/* Notes */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 }}>
              {t('add.notes')}
            </Text>
            <DoneAccessoryInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
              value={form.notes}
              onChangeText={handleNotes}
              placeholder={t('add.notes_placeholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              accessoryId="manual-notes"
            />
          </View>

          {/* Reminder */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              {t('add.reminder', 'Reminder')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {REMINDER_PRESETS.map((opt) => {
                const label = t(opt.i18nKey, opt.fallback);
                const isSelected = JSON.stringify(form.reminderDaysBefore) === JSON.stringify(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.i18nKey}
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
                      {label}
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
              <TouchableOpacity
                key="auto"
                onPress={() => setF('color', '')}
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: colors.primary,
                  borderWidth: 2.5,
                  borderColor: form.color === '' ? colors.text : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 7, fontWeight: '800', color: '#FFF' }}>
                  {t('add.color_auto', 'Auto')}
                </Text>
              </TouchableOpacity>
              {CARD_COLOR_PALETTE.map((hex) => (
                <TouchableOpacity
                  key={hex}
                  onPress={() => setF('color', hex)}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: hex,
                    borderWidth: 2.5,
                    borderColor: form.color === hex ? colors.text : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                />
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
                    <TouchableOpacity onPress={() => setF('tags', form.tags.filter((_, i) => i !== idx))}>
                      <Ionicons name="close" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <DoneAccessoryInput
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
              accessoryId="manual-tags"
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
                onValueChange={(v) => setForm((f: AddSubscriptionForm) => ({
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
                <DoneAccessoryInput
                  style={inputStyle}
                  value={form.trialEndDate}
                  onChangeText={(v) => setF('trialEndDate', v)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  accessoryId="manual-trial-end"
                />
              </>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity
        testID="btn-save-sub"
        style={[
          {
            backgroundColor: canSave ? colors.primary : colors.border,
            borderRadius: 14,
            padding: 16,
            alignItems: 'center',
            marginTop: 8,
          },
          (saving || !canSave) && { opacity: 0.5 },
        ]}
        onPress={onSave}
        disabled={saving || !canSave}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>{t('add.add_subscription')}</Text>
        )}
      </TouchableOpacity>

      <CurrencyPicker
        visible={currencyPickerVisible}
        selected={form.currency || 'USD'}
        onSelect={onPickCurrency}
        onClose={() => setCurrencyPickerVisible(false)}
        title={t('add.currency', 'Currency')}
      />
    </View>
  );
}

export const ManualFormView = memo(ManualFormViewImpl);
