import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';

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
const CURRENCIES = ['USD', 'EUR', 'GBP', 'RUB', 'KZT'];

export function InlineConfirmCard({ data, onSave, onCancel, saving }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [name, setName] = useState(data.name.value);
  const [amount, setAmount] = useState(String(data.amount.value || ''));
  const [currency, setCurrency] = useState(data.currency.value || 'USD');
  const [period, setPeriod] = useState(data.billingPeriod.value || 'MONTHLY');
  const [category, setCategory] = useState(data.category.value || 'OTHER');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const iconUrl = data.iconUrl || `https://icon.horse/icon/${name.toLowerCase().replace(/\s+/g, '')}.com`;

  const handlePlanSelect = (plan: { name: string; priceMonthly: number; currency: string }) => {
    setSelectedPlan(plan.name);
    setAmount(String(plan.priceMonthly));
    setCurrency(plan.currency);
    setPeriod('MONTHLY');
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
      startDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
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
        <View style={[styles.iconBox, { backgroundColor: colors.background }]}>
          <Text style={styles.iconLetter}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <TextInput
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
              <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
              <Text style={[styles.planPrice, { color: colors.textSecondary }]}>
                ${plan.priceMonthly}/{t('add_flow.mo', 'mo')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Fields */}
      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('add_flow.amount', 'Amount')}</Text>
        <View style={styles.fieldValue}>
          <TextInput
            style={[styles.fieldInput, { color: colors.text, borderColor: colors.border }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
          />
          {renderConfidence(data.amount.confidence)}
        </View>
      </View>

      {/* Currency chips */}
      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('add_flow.currency', 'Currency')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, currency === c && styles.chipActive, { borderColor: colors.border }]}
              onPress={() => setCurrency(c)}
            >
              <Text style={[styles.chipText, currency === c && styles.chipTextActive, { color: currency === c ? '#fff' : colors.textSecondary }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
  saveBtn: { backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15 },
});
