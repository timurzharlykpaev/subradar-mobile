import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { useSettingsStore } from '../stores/settingsStore';
import { usePaymentCardsStore } from '../stores/paymentCardsStore';
import { convertAmount } from '../services/fxCache';
import { formatMoney } from '../utils/formatMoney';
import i18n from '../i18n';
import { DatePickerField } from './DatePickerField';
import { NumericInput } from './NumericInput';
import { DoneAccessoryInput } from './primitives/DoneAccessoryInput';

export type Confidence = 'high' | 'medium' | 'low';

export interface ConfirmableField<T> {
  value: T;
  confidence: Confidence;
}

export interface ConfirmCardData {
  name: ConfirmableField<string>;
  amount: ConfirmableField<number>;
  currency: ConfirmableField<string>;
  billingPeriod: ConfirmableField<string>;
  category: ConfirmableField<string>;
  iconUrl?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  plans?: { name: string; priceMonthly: number; currency: string }[];
}

interface Props {
  data: ConfirmCardData;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving?: boolean;
}

const CONFIDENCE_ICON: Record<Confidence, { name: string; color: string }> = {
  high: { name: 'checkmark-circle', color: '#22c55e' },
  medium: { name: 'warning', color: '#eab308' },
  low: { name: 'help-circle', color: '#ef4444' },
};

const PERIODS = ['MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY'];
const CATEGORIES = ['STREAMING', 'AI_SERVICES', 'MUSIC', 'PRODUCTIVITY', 'GAMING', 'INFRASTRUCTURE', 'HEALTH', 'NEWS', 'EDUCATION', 'FINANCE', 'DESIGN', 'SECURITY', 'DEVELOPER', 'SPORT', 'BUSINESS', 'OTHER'];
const REMINDER_OPTIONS = [
  { label: 'Off', value: null },
  { label: '1d', value: 1 },
  { label: '3d', value: 3 },
  { label: '7d', value: 7 },
];
const COLOR_PALETTE = ['#7c3aed', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#8B5CF6'];

export function InlineConfirmCard({ data, onSave, onCancel, saving }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const displayCurrency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');
  const cards = usePaymentCardsStore((s) => s.cards);
  const lang = i18n.language || 'en';
  const [name, setName] = useState(data.name.value);
  const [amount, setAmount] = useState(String(data.amount.value || ''));
  const [currency, setCurrency] = useState(data.currency.value || 'USD');
  const [period, setPeriod] = useState(data.billingPeriod.value || 'MONTHLY');
  const [category, setCategory] = useState(data.category.value || 'OTHER');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [nextPaymentDate, setNextPaymentDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });

  // "More options" state
  const [showExtras, setShowExtras] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [billingDay, setBillingDay] = useState('1');
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [reminderDays, setReminderDays] = useState<number[]>([3]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState('');

  const iconUrl = data.iconUrl || `https://icon.horse/icon/${name.toLowerCase().replace(/\s+/g, '')}.com`;

  const handlePlanSelect = (plan: { name: string; priceMonthly: number; currency: string }) => {
    setSelectedPlan(plan.name);
    const converted = convertAmount(plan.priceMonthly, plan.currency, displayCurrency);
    if (converted !== null) {
      setAmount(String(converted));
      setCurrency(displayCurrency);
    } else {
      setAmount(String(plan.priceMonthly));
      setCurrency(plan.currency);
    }
    setPeriod('MONTHLY');
  };

  const toggleReminder = (day: number | null) => {
    if (day === null) {
      setReminderDays([]);
    } else {
      setReminderDays((prev) =>
        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
      );
    }
  };

  const handleSave = () => {
    onSave({
      name,
      amount: parseFloat(amount) || 0,
      currency,
      billingPeriod: period,
      category,
      iconUrl,
      serviceUrl: data.serviceUrl,
      cancelUrl: data.cancelUrl,
      currentPlan: selectedPlan,
      startDate: startDate || new Date().toISOString().split('T')[0],
      nextPaymentDate: nextPaymentDate || undefined,
      billingDay: Math.min(Math.max(parseInt(billingDay) || 1, 1), 31),
      paymentCardId: selectedCard || undefined,
      reminderEnabled: reminderDays.length > 0,
      reminderDaysBefore: reminderDays.length > 0 ? reminderDays : undefined,
      notes: notes || undefined,
      tags: tags ? tags.split(',').map((tg) => tg.trim()).filter(Boolean) : undefined,
      color: color || undefined,
      status: isTrial ? 'TRIAL' : 'ACTIVE',
      trialEndDate: isTrial && trialEndDate ? trialEndDate : undefined,
      addedVia: 'AI_TEXT',
    });
  };

  const renderConfidence = (c: Confidence) => {
    const icon = CONFIDENCE_ICON[c];
    return <Ionicons name={icon.name as any} size={16} color={icon.color} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        {iconUrl ? (
          <Image source={{ uri: iconUrl }} style={styles.iconImage} />
        ) : (
          <View style={[styles.iconBox, { backgroundColor: colors.background }]}>
            <Text style={styles.iconLetter}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <DoneAccessoryInput
            style={[styles.nameInput, { color: colors.text }]}
            value={name}
            onChangeText={setName}
            placeholder={t('add_flow.service_name', 'Service name')}
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        {renderConfidence(data.name.confidence)}
      </View>

      {/* Plans */}
      {data.plans && data.plans.length > 0 && (
        <View style={styles.plansSection}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('add_flow.select_plan', 'Plan')}
          </Text>
          {data.plans.map((plan) => (
            <TouchableOpacity
              key={plan.name}
              style={[
                styles.planRow,
                { borderColor: selectedPlan === plan.name ? '#7c3aed' : colors.border },
                selectedPlan === plan.name && styles.planSelected,
              ]}
              onPress={() => handlePlanSelect(plan)}
            >
              <View style={[styles.radio, selectedPlan === plan.name && styles.radioActive]} />
              <Text style={[styles.planName, { color: colors.text }]}>{t(`plans.${plan.name.toLowerCase().replace(/\s+/g, '_')}`, plan.name)}</Text>
              <Text style={[styles.planPrice, { color: colors.textSecondary }]}>
                {(() => {
                  const converted = convertAmount(plan.priceMonthly, plan.currency, displayCurrency);
                  return converted !== null
                    ? `${formatMoney(converted, displayCurrency, lang)}/${t('add_flow.mo', 'mo')}`
                    : `${plan.priceMonthly.toFixed(2)} ${plan.currency}/${t('add_flow.mo', 'mo')}`;
                })()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Fields */}
      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('add_flow.amount', 'Amount')}</Text>
        <View style={styles.fieldValue}>
          <NumericInput
            style={[styles.fieldInput, { color: colors.text, borderColor: colors.border }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            accessoryId="confirm-amount"
          />
          {renderConfidence(data.amount.confidence)}
        </View>
      </View>

      {/* Next payment date */}
      <DatePickerField
        label={t('add_flow.next_payment', 'Next payment date')}
        value={nextPaymentDate}
        onChange={setNextPaymentDate}
      />

      {/* Period chips */}
      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('add_flow.period', 'Period')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, period === p && styles.chipActive, { borderColor: colors.border }]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.chipText, period === p && styles.chipTextActive, { color: period === p ? '#fff' : colors.textSecondary }]}>{t(`periods.${p}`, p)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Category chips */}
      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('add_flow.category', 'Category')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {CATEGORIES.slice(0, 6).map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipActive, { borderColor: colors.border }]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive, { color: category === c ? '#fff' : colors.textSecondary }]}>{t(`categories.${c.toLowerCase()}`, c.replace('_', ' '))}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.chip, { borderColor: colors.border }]}
            onPress={() => setShowMore(!showMore)}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>...</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {showMore && (
        <View style={styles.moreCategories}>
          {CATEGORIES.slice(6).map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipActive, { borderColor: colors.border, marginBottom: 4 }]}
              onPress={() => { setCategory(c); setShowMore(false); }}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive, { color: category === c ? '#fff' : colors.textSecondary }]}>{t(`categories.${c.toLowerCase()}`, c.replace('_', ' '))}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* More options toggle */}
      <TouchableOpacity
        style={styles.extrasToggle}
        onPress={() => setShowExtras(!showExtras)}
      >
        <Ionicons
          name={showExtras ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
        <Text style={[styles.extrasToggleText, { color: colors.textSecondary }]}>
          {showExtras ? t('add.show_less', 'Less') : t('add.show_more', 'More options')}
        </Text>
      </TouchableOpacity>

      {showExtras && (
        <View style={styles.extrasSection}>
          {/* Start Date + Billing Day (same row) */}
          <View style={styles.fieldRowInline}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <DatePickerField
                label={t('add.start_date', 'Start date')}
                value={startDate}
                onChange={setStartDate}
              />
            </View>
            <View style={{ width: 80 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('add.billing_day', 'Billing day')}
              </Text>
              <NumericInput
                style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, textAlign: 'center' }]}
                value={billingDay}
                onChangeText={(v) => {
                  const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                  if (!v || isNaN(num)) { setBillingDay(''); return; }
                  setBillingDay(String(Math.min(Math.max(num, 1), 31)));
                }}
                placeholder="1"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={2}
                accessoryId="confirm-billing-day"
              />
            </View>
          </View>

          {/* Payment Card */}
          {cards.length > 0 && (
            <View style={styles.fieldRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('add.card', 'Payment Card')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity
                  style={[styles.chip, !selectedCard && styles.chipActive, { borderColor: colors.border }]}
                  onPress={() => setSelectedCard(null)}
                >
                  <Text style={[styles.chipText, !selectedCard && styles.chipTextActive, { color: !selectedCard ? '#fff' : colors.textSecondary }]}>
                    {t('add.no_card', 'No card')}
                  </Text>
                </TouchableOpacity>
                {cards.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    style={[styles.chip, selectedCard === card.id && styles.chipActive, { borderColor: colors.border }]}
                    onPress={() => setSelectedCard(card.id)}
                  >
                    <Text style={[styles.chipText, selectedCard === card.id && styles.chipTextActive, { color: selectedCard === card.id ? '#fff' : colors.textSecondary }]}>
                      {card.nickname || `•••• ${card.last4}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Reminder Days */}
          <View style={styles.fieldRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('add.reminder', 'Reminder')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {REMINDER_OPTIONS.map((opt) => {
                const isActive = opt.value === null
                  ? reminderDays.length === 0
                  : reminderDays.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.chip, isActive && styles.chipActive, { borderColor: colors.border }]}
                    onPress={() => toggleReminder(opt.value)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive, { color: isActive ? '#fff' : colors.textSecondary }]}>
                      {opt.value === null ? t('add.reminder_off', 'Off') : opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Color */}
          <View style={styles.fieldRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('subscription.color', 'Color')}
            </Text>
            <View style={styles.colorRow}>
              <TouchableOpacity
                style={[styles.colorCircle, { borderColor: !color ? '#7c3aed' : 'transparent', backgroundColor: colors.background }]}
                onPress={() => setColor(null)}
              >
                <Text style={[styles.colorAutoText, { color: colors.textSecondary }]}>
                  {t('add.color_auto', 'Auto')}
                </Text>
              </TouchableOpacity>
              {COLOR_PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorCircle, { backgroundColor: c, borderColor: color === c ? '#fff' : 'transparent' }]}
                  onPress={() => setColor(c)}
                >
                  {color === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.fieldRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('add.notes', 'Notes')}
            </Text>
            <DoneAccessoryInput
              style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, minHeight: 60, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('add.notes_placeholder', 'Additional notes...')}
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          </View>

          {/* Tags */}
          <View style={styles.fieldRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('add.tags', 'Tags')}
            </Text>
            <DoneAccessoryInput
              style={[styles.fieldInput, { color: colors.text, borderColor: colors.border }]}
              value={tags}
              onChangeText={setTags}
              placeholder={t('add.tags_placeholder', 'work, personal, shared')}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Trial toggle */}
          <View style={styles.fieldRow}>
            <View style={styles.trialRow}>
              <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>
                {t('add.trial_period', 'Trial period')}
              </Text>
              <Switch
                value={isTrial}
                onValueChange={setIsTrial}
                trackColor={{ false: colors.border, true: '#7c3aed' }}
                thumbColor="#fff"
              />
            </View>
            {isTrial && (
              <View style={{ marginTop: 8 }}>
                <DatePickerField
                  label={t('add.trial_end_date', 'Trial ends')}
                  value={trialEndDate}
                  onChange={setTrialEndDate}
                />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving || !name.trim() || !amount}
      >
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.saveBtnText}>
          {t('add_flow.add_subscription', 'Add Subscription')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
          {t('common.cancel', 'Cancel')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, padding: 20, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  iconImage: { width: 48, height: 48, borderRadius: 12 },
  iconLetter: { fontSize: 20, fontWeight: '700', color: '#7c3aed' },
  nameInput: { fontSize: 18, fontWeight: '700' },
  plansSection: { marginBottom: 16 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginTop: 6 },
  planSelected: { backgroundColor: 'rgba(124,58,237,0.08)' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#666' },
  radioActive: { borderColor: '#7c3aed', backgroundColor: '#7c3aed' },
  planName: { flex: 1, fontSize: 14, fontWeight: '500' },
  planPrice: { fontSize: 14 },
  fieldRow: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  fieldValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chipScroll: { flexDirection: 'row' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginRight: 6 },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  moreCategories: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  extrasToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, marginBottom: 4 },
  extrasToggleText: { fontSize: 13, fontWeight: '500' },
  extrasSection: { marginBottom: 4 },
  fieldRowInline: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  colorCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  colorAutoText: { fontSize: 8, fontWeight: '600' },
  trialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveBtn: { backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15 },
});
