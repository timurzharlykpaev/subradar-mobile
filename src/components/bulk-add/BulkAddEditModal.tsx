/**
 * Edit-row modal for BulkAddSheet. Holds a LOCAL draft of the row being
 * edited and only commits back to the parent's parsedSubs array on Done.
 *
 * The previous IIFE-inline implementation mutated `parsedSubs[index].x =
 * v; setParsedSubs([...parsedSubs])` on every keystroke, which (a) created
 * a fresh array reference and re-rendered the entire 574-line BulkAddSheet
 * with all of its modal subtrees, and (b) parsed the amount through
 * `parseFloat(v) || 0`, which lost intermediate values like "1." while
 * typing. The result was visibly laggy input ("number lags then unfreezes")
 * in production. With local state the keystroke updates live in this
 * component only — the parent never re-renders during typing.
 */
import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import type { BulkSub } from './types';

const PERIODS: Array<BulkSub['billingPeriod']> = [
  'MONTHLY',
  'YEARLY',
  'WEEKLY',
  'QUARTERLY',
  'LIFETIME',
  'ONE_TIME',
];

const CATEGORIES = [
  'STREAMING',
  'AI_SERVICES',
  'PRODUCTIVITY',
  'MUSIC',
  'GAMING',
  'DESIGN',
  'EDUCATION',
  'FINANCE',
  'INFRASTRUCTURE',
  'SECURITY',
  'HEALTH',
  'SPORT',
  'DEVELOPER',
  'NEWS',
  'BUSINESS',
  'OTHER',
] as const;

interface Props {
  visible: boolean;
  initial: BulkSub | null;
  onSave: (next: BulkSub) => void;
  onDelete: () => void;
  onClose: () => void;
}

function BulkAddEditModalImpl({ visible, initial, onSave, onDelete, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Local draft — keystrokes update this fast (component is small, memo'd
  // children stay stable because we don't pass new array refs around).
  // Amount is held as a string so partial input like "1." is preserved
  // while typing; we only parse on Save.
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [billingPeriod, setBillingPeriod] = useState<BulkSub['billingPeriod']>('MONTHLY');
  const [category, setCategory] = useState<string>('OTHER');

  // Re-seed the draft when a different row is opened. Modal stays mounted
  // across edits, so we can't rely on a remount to bring fresh defaults.
  useEffect(() => {
    if (!visible || !initial) return;
    setName(initial.name ?? '');
    setAmountStr(
      typeof initial.amount === 'number' && !isNaN(initial.amount)
        ? String(initial.amount)
        : '',
    );
    setCurrency(initial.currency ?? 'USD');
    setBillingPeriod(initial.billingPeriod ?? 'MONTHLY');
    setCategory(initial.category ?? 'OTHER');
  }, [visible, initial]);

  const onChangeAmount = useCallback((v: string) => {
    // Allow only digits + a single dot / comma; preserve the literal so
    // "1.", "1.0", "0,5" all stay typeable. Final parse happens on Save.
    const cleaned = v.replace(/[^\d.,]/g, '').replace(',', '.');
    const parts = cleaned.split('.');
    const next = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('').slice(0, 4)}` : parts[0];
    setAmountStr(next);
  }, []);

  const onChangeCurrency = useCallback((v: string) => {
    setCurrency(v.toUpperCase().slice(0, 3));
  }, []);

  const handleSave = useCallback(() => {
    if (!initial) return;
    const parsed = parseFloat(amountStr);
    onSave({
      ...initial,
      name: name.trim() || initial.name,
      amount: isNaN(parsed) ? 0 : parsed,
      currency: (currency || 'USD').toUpperCase(),
      billingPeriod,
      category,
    });
  }, [initial, name, amountStr, currency, billingPeriod, category, onSave]);

  // Memoize the chip rows so each tap toggles only one chip's render
  // instead of the whole list.
  const periodChips = useMemo(
    () =>
      PERIODS.map((p) => ({
        key: p,
        label: t(`add.${p.toLowerCase()}`, p.toLowerCase()),
        active: billingPeriod === p,
      })),
    [billingPeriod, t],
  );
  const categoryChips = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        key: c,
        label: t(`categories.${c.toLowerCase()}`, c) as string,
        active: category === c,
      })),
    [category, t],
  );

  if (!initial) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 56,
            paddingBottom: 12,
            gap: 12,
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '800',
              color: colors.text,
              flex: 1,
            }}
          >
            {t('common.edit', 'Edit')}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>
              {t('common.done', 'Done')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
              {t('add.service_name', 'Name')}
            </Text>
            <DoneAccessoryInput
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.text,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 14,
                backgroundColor: colors.card,
              }}
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                {t('add.amount', 'Amount')}
              </Text>
              <DoneAccessoryInput
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 14,
                  backgroundColor: colors.card,
                }}
                value={amountStr}
                onChangeText={onChangeAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ width: 80, gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                {t('add.currency', 'Currency')}
              </Text>
              <DoneAccessoryInput
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 14,
                  backgroundColor: colors.card,
                  textAlign: 'center',
                }}
                value={currency}
                onChangeText={onChangeCurrency}
                maxLength={3}
                autoCapitalize="characters"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
              {t('add.billing_period', 'Billing Period')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {periodChips.map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: chip.active ? colors.primary : colors.border,
                    backgroundColor: chip.active ? colors.primary + '12' : colors.card,
                  }}
                  onPress={() => setBillingPeriod(chip.key)}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: chip.active ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {String(chip.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
              {t('add.category', 'Category')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {categoryChips.map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: chip.active ? colors.primary : colors.border,
                    backgroundColor: chip.active ? colors.primary + '12' : colors.card,
                  }}
                  onPress={() => setCategory(chip.key)}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: chip.active ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#EF444440',
              backgroundColor: '#EF444408',
              marginTop: 8,
            }}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>
              {t('common.delete', 'Delete')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

export const BulkAddEditModal = memo(BulkAddEditModalImpl);
