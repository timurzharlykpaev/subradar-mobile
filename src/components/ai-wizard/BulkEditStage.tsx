/**
 * BulkEditStage — detail editor rendered inside AIWizard when the user
 * taps a row in the bulk-confirm list.
 *
 * Why this exists:
 *   The original inline JSX lived inside `AIWizard.tsx`'s giant render
 *   and, critically, was NOT wrapped in `KeyboardAvoidingView`. Tapping
 *   any field pushed the software keyboard up over the input, hiding
 *   whatever the user was typing — a long-standing user complaint.
 *
 * What changed on extraction:
 *   1. Wrapped in `KeyboardAvoidingView` + `ScrollView` with
 *      `automaticallyAdjustKeyboardInsets` / `contentInsetAdjustmentBehavior`
 *      so iOS auto-scrolls the focused field into view.
 *   2. Every `TextInput` swapped for `DoneAccessoryInput` so numeric /
 *      URL fields ship the standard iOS Done toolbar (dismisses the
 *      keyboard cleanly).
 *   3. Made `React.memo` — the parent re-renders on every `setUi` but
 *      the edit form only depends on `sub` + `index`, so memoization
 *      keeps typing snappy.
 *
 * This is a stage, not a modal. It's rendered inside the AIWizard which
 * already lives inside the AddSubscriptionSheet bottom-sheet, so we use
 * raw KAV rather than the KeyboardAwareModal primitive.
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import type { ParsedSub } from './types';

interface Props {
  sub: ParsedSub;
  index: number;
  onUpdate: (patch: Partial<ParsedSub>) => void;
  onDone: () => void;
  onCancel: () => void;
}

const PERIODS = ['MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY'] as const;
const CATEGORIES = [
  'STREAMING',
  'AI_SERVICES',
  'INFRASTRUCTURE',
  'PRODUCTIVITY',
  'MUSIC',
  'GAMING',
  'DEVELOPER',
  'EDUCATION',
  'HEALTH',
  'OTHER',
] as const;

const periodLabel = (p: string) =>
  ({ MONTHLY: '/мес', YEARLY: '/год', WEEKLY: '/нед', QUARTERLY: '/квар' } as Record<string, string>)[p] ?? p;

function BulkEditStageImpl({ sub, onUpdate, onDone, onCancel }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const inputStyle = {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.text,
    borderColor: colors.border,
    backgroundColor: colors.background,
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      {/* Back button — outside the ScrollView so it stays pinned */}
      <TouchableOpacity
        onPress={onCancel}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}
      >
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
          {t('common.back', 'Назад к списку')}
        </Text>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Service name with icon */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          {sub.iconUrl ? (
            <Image source={{ uri: sub.iconUrl }} style={{ width: 36, height: 36, borderRadius: 9 }} />
          ) : (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                {(sub.name || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{sub.name}</Text>
        </View>

        {/* Name */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
          }}
        >
          {t('add.name', 'Название')}
        </Text>
        <DoneAccessoryInput
          style={[inputStyle, { marginBottom: 12 }]}
          value={sub.name ?? ''}
          onChangeText={(v) => onUpdate({ name: v })}
          placeholder={t('add.name_placeholder', 'Название')}
          placeholderTextColor={colors.textMuted}
        />

        {/* Amount + Currency */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 2 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              {t('add.amount', 'Сумма')}
            </Text>
            <DoneAccessoryInput
              style={inputStyle}
              value={String(sub.amount ?? '')}
              keyboardType="decimal-pad"
              onChangeText={(v) => onUpdate({ amount: parseFloat(v) || 0 })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              {t('add.currency', 'Валюта')}
            </Text>
            <DoneAccessoryInput
              style={inputStyle}
              value={sub.currency ?? 'USD'}
              autoCapitalize="characters"
              maxLength={3}
              onChangeText={(v) => onUpdate({ currency: v.toUpperCase() })}
            />
          </View>
        </View>

        {/* Period */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          {t('add.billing_cycle', 'Период')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => onUpdate({ billingPeriod: p })}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1.5,
                backgroundColor: sub.billingPeriod === p ? colors.primary : colors.surface2,
                borderColor: sub.billingPeriod === p ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: sub.billingPeriod === p ? '#fff' : colors.textSecondary,
                }}
              >
                {periodLabel(p)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          {t('add.category', 'Категория')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => onUpdate({ category: cat })}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: sub.category === cat ? colors.primary : colors.surface2,
                borderColor: sub.category === cat ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: sub.category === cat ? '#fff' : colors.textMuted,
                }}
              >
                {cat.replace('_', ' ').toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Service URL */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
          }}
        >
          {t('add.service_url', 'Сайт сервиса')}
        </Text>
        <DoneAccessoryInput
          style={[inputStyle, { marginBottom: 12 }]}
          value={sub.serviceUrl ?? ''}
          onChangeText={(v) => onUpdate({ serviceUrl: v })}
          placeholder="https://..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="url"
        />

        {/* Cancel URL */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
          }}
        >
          {t('add.cancel_url', 'Ссылка для отмены')}
        </Text>
        <DoneAccessoryInput
          style={[inputStyle, { marginBottom: 16 }]}
          value={sub.cancelUrl ?? ''}
          onChangeText={(v) => onUpdate({ cancelUrl: v })}
          placeholder="https://..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="url"
        />

        {/* Done → back to list */}
        <TouchableOpacity
          onPress={onDone}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            padding: 15,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 20,
          }}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
            {t('common.done', 'Готово')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const BulkEditStage = React.memo(BulkEditStageImpl);
