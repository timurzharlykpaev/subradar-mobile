import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../theme';
import { KeyboardAwareModal } from '../primitives/KeyboardAwareModal';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import { DatePickerField } from '../DatePickerField';
import { BillingDayPicker } from '../BillingDayPicker';
import { NumericInput } from '../NumericInput';
import type { ParsedSub } from './types';

interface Props {
  visible: boolean;
  /**
   * The sub being edited. When `null`, the modal renders nothing even if
   * `visible` is true — avoids callers having to guard `sub` themselves
   * (bulkEditIdx can flip to null before the modal animates out).
   */
  sub: ParsedSub | null;
  onClose: () => void;
  onUpdate: (patch: Partial<ParsedSub>) => void;
  onDelete: () => void;
  moreExpanded: boolean;
  setMoreExpanded: (v: boolean) => void;
  /** Reserved for future save-in-flight UI; currently the header just closes. */
  saving?: boolean;
}

const PERIODS = ['MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY', 'LIFETIME', 'ONE_TIME'] as const;

const COLOR_PALETTE = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4', '#6B7280'];

const ALL_CATEGORIES = [
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

const REMINDER_PRESETS: Array<{ i18nKey: string; fallback: string; value: number[] }> = [
  { i18nKey: 'add.reminder_off', fallback: 'Off', value: [] },
  { i18nKey: 'add.reminder_1d', fallback: '1d', value: [1] },
  { i18nKey: 'add.reminder_3d', fallback: '3d', value: [3] },
  { i18nKey: 'add.reminder_7d', fallback: '7d', value: [7] },
];

/**
 * Full-screen editor for one row of the bulk-parsed subscriptions list.
 *
 * Extracted from AddSubscriptionSheet (~150 lines). State stays in the
 * orchestrator so the edit-and-close round trip doesn't lose work: the
 * parent owns `bulkItems` and passes the currently-edited item down via
 * `sub`, plus an `onUpdate(patch)` callback that merges into the right
 * index. Wrapped in React.memo so keystrokes in unrelated orchestrator
 * state don't re-render the editor.
 *
 * Renders through KeyboardAwareModal with `scrollable={false}` so we keep
 * the original sticky header + internal ScrollView layout. All TextInputs
 * use DoneAccessoryInput directly; NumericInput already shims
 * DoneAccessoryInput internally so it stays as-is.
 */
function BulkEditModalImpl({
  visible,
  sub,
  onClose,
  onUpdate,
  onDelete,
  moreExpanded,
  setMoreExpanded,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Guard: when bulkEditIdx flips to null the parent sets `sub` to null but
  // the Modal animation may still be running. Render nothing when there's
  // no sub — downstream code reads fields off `sub` unconditionally.
  if (!sub) {
    return null;
  }

  const currentPeriod = (sub.billingPeriod || 'MONTHLY').toUpperCase();
  const currentCategory = (sub.category || 'OTHER').toUpperCase();
  const currentReminder = sub.reminderDaysBefore ?? [3];

  return (
    <KeyboardAwareModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      scrollable={false}
      // Fullscreen layout with in-modal paddingTop for the notch — no extra
      // KeyboardAvoidingView offset needed on iOS.
      keyboardVerticalOffset={0}
      style={{ backgroundColor: colors.background }}
    >
      {/* Sticky header — sits above the ScrollView, matches the original inline
          layout where pressing Done/Back dismisses while the keyboard is up. */}
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
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 }}>
          {t('common.edit', 'Edit')}
        </Text>
        <TouchableOpacity
          onPress={onClose}
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
        {/* Name */}
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
            value={sub.name}
            onChangeText={(v) => onUpdate({ name: v })}
            accessoryId="bulk-name"
          />
        </View>

        {/* Amount */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
            {t('add.amount', 'Amount')}
          </Text>
          <NumericInput
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
            value={String(sub.amount || '')}
            onChangeText={(v) => onUpdate({ amount: parseFloat(v) || 0 })}
            keyboardType="decimal-pad"
            accessoryId="bulk-amount"
          />
        </View>

        {/* Billing Period */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
            {t('add.billing_period', 'Billing Period')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PERIODS.map((p) => {
              const isSelected = currentPeriod === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary + '12' : colors.card,
                  }}
                  onPress={() => onUpdate({ billingPeriod: p })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isSelected ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {String(t(`add.${p.toLowerCase()}`, p.toLowerCase()))}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Category */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
            {t('add.category', 'Category')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {ALL_CATEGORIES.map((c) => {
              const isSelected = currentCategory === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary + '12' : colors.card,
                  }}
                  onPress={() => onUpdate({ category: c })}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: isSelected ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {String(t(`categories.${c.toLowerCase()}`, c))}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* More options toggle */}
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
            {moreExpanded
              ? t('add_flow.less_options', 'Less')
              : t('add_flow.more_options', 'More options')}
          </Text>
        </TouchableOpacity>

        {moreExpanded && (
          <View style={{ gap: 16 }}>
            {/* Start Date */}
            <DatePickerField
              label={t('add.start_date', 'Start date')}
              value={sub.startDate || new Date().toISOString().split('T')[0]}
              onChange={(v) => onUpdate({ startDate: v })}
            />
            {/* Next Payment Date */}
            <DatePickerField
              label={t('add.next_payment', 'Next payment date')}
              value={sub.nextPaymentDate || ''}
              onChange={(v) => onUpdate({ nextPaymentDate: v })}
            />
            {/* Billing Day — grid picker replaces 80px-wide numeric
                input which clipped on narrow screens. */}
            <BillingDayPicker
              label={t('add.billing_day', 'Billing day')}
              value={sub.billingDay ?? ''}
              onChange={(day) => onUpdate({ billingDay: day })}
            />
            {/* Notes */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                {t('add.notes', 'Notes')}
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
                  minHeight: 80,
                  textAlignVertical: 'top',
                  paddingTop: 14,
                }}
                value={sub.notes || ''}
                onChangeText={(v) => onUpdate({ notes: v })}
                placeholder={t('add.notes_placeholder', 'Additional notes...')}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                accessoryId="bulk-notes"
              />
            </View>
            {/* Reminder */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                {t('add.reminder', 'Reminder')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {REMINDER_PRESETS.map((opt) => {
                  const label = String(t(opt.i18nKey, opt.fallback));
                  const isSelected =
                    JSON.stringify(currentReminder) === JSON.stringify(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.i18nKey}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary + '12' : colors.card,
                      }}
                      onPress={() => onUpdate({ reminderDaysBefore: opt.value })}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: isSelected ? colors.primary : colors.textSecondary,
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Tags — comma-separated; reuse the same UX as the Edit
                form. Sent to backend as string[]. */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                {t('add.tags', 'Tags')}
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
                value={(sub.tags ?? []).join(', ')}
                onChangeText={(v) =>
                  onUpdate({
                    tags: v
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder={t('add.tags_placeholder', 'work, personal, shared')}
                placeholderTextColor={colors.textMuted}
                accessoryId="bulk-tags"
              />
            </View>

            {/* Plan / URLs — give the user a chance to fix what AI missed
                before the sub is created (these used to be Edit-only). */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                {t('add.current_plan', 'Current plan')}
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
                value={sub.currentPlan ?? ''}
                onChangeText={(v) => onUpdate({ currentPlan: v })}
                placeholder={t('add.current_plan_placeholder', 'Premium, Family, etc.')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                accessoryId="bulk-current-plan"
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                {t('add.service_url', 'Service URL')}
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
                value={sub.serviceUrl ?? ''}
                onChangeText={(v) => onUpdate({ serviceUrl: v })}
                placeholder="https://service.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessoryId="bulk-service-url"
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                {t('add.cancel_url', 'Cancel URL')}
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
                value={sub.cancelUrl ?? ''}
                onChangeText={(v) => onUpdate({ cancelUrl: v })}
                placeholder="https://service.com/cancel"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessoryId="bulk-cancel-url"
              />
            </View>

            {/* Color picker — same palette + identical "auto" affordance
                as the Edit form so card accents stay consistent. */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                {t('add.color', 'Color')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: !sub.color ? colors.primary : colors.border,
                    backgroundColor: colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => onUpdate({ color: '' })}
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
                      borderColor: sub.color === c ? colors.text : 'transparent',
                    }}
                    onPress={() => onUpdate({ color: c })}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Delete */}
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
    </KeyboardAwareModal>
  );
}

export const BulkEditModal = memo(BulkEditModalImpl);
