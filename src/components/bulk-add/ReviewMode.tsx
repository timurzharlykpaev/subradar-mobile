/**
 * ReviewMode — the `mode === 'review'` branch of BulkAddSheet.
 *
 * Shows every parsed subscription with a checkbox + per-row edit pencil, plus
 * the "Select all / Deselect all" controls, a big green Save button, and a
 * back link. State (`parsedSubs`, `checked`, `saving`) lives in the
 * orchestrator because it is populated by the parse pipeline and needed by
 * the separate full-screen edit modal; everything flows in through props.
 *
 * The row is extracted into a memoized `ReviewRow` so re-rendering a single
 * toggled item does not redraw the full list.
 */
import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import type { BulkSub } from './types';

// ── ReviewRow ────────────────────────────────────────────────────────────────

interface RowProps {
  index: number;
  sub: BulkSub;
  checked: boolean;
  onToggle: (index: number) => void;
  onEdit: (index: number) => void;
}

function ReviewRowImpl({ index, sub, checked, onToggle, onEdit }: RowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handleToggle = useCallback(() => onToggle(index), [onToggle, index]);
  const handleEdit = useCallback(() => onEdit(index), [onEdit, index]);

  const periodLabels: Record<string, string> = {
    MONTHLY: t('add.monthly', 'monthly'),
    YEARLY: t('add.yearly', 'yearly'),
    WEEKLY: t('add.weekly', 'weekly'),
    QUARTERLY: t('add.quarterly', 'quarterly'),
  };

  return (
    <View
      style={[
        cStyles.card,
        {
          backgroundColor: checked ? colors.primary + '12' : colors.surface2,
          borderColor: checked ? colors.primary : colors.border,
        },
      ]}
    >
      <TouchableOpacity
        onPress={handleToggle}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
        activeOpacity={0.75}
      >
        {sub.iconUrl ? (
          <Image source={{ uri: sub.iconUrl }} style={cStyles.icon} />
        ) : (
          <View style={[cStyles.iconFallback, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[cStyles.iconLetter, { color: colors.primary }]}>
              {(sub.name || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[cStyles.name, { color: colors.text }]} numberOfLines={1}>
            {sub.name}
          </Text>
          <Text style={[cStyles.meta, { color: colors.textMuted }]}>
            {sub.currency} {sub.amount.toFixed(2)} /{' '}
            {periodLabels[sub.billingPeriod] ?? sub.billingPeriod.toLowerCase()}
            {sub.category ? ` · ${sub.category}` : ''}
          </Text>
          {sub.isDuplicate && (
            <Text style={{ fontSize: 10, color: '#FBBF24', marginTop: 2 }}>
              {t('add.already_exists', 'Already added')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleEdit}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ padding: 6 }}
      >
        <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={handleToggle}>
        <View
          style={[
            cStyles.checkbox,
            {
              borderColor: checked ? colors.primary : colors.border,
              backgroundColor: checked ? colors.primary : 'transparent',
            },
          ]}
        >
          {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const ReviewRow = memo(ReviewRowImpl);

const cStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 11 },
  iconFallback: { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  iconLetter: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});

// ── ReviewMode shell ─────────────────────────────────────────────────────────

interface Props {
  parsedSubs: BulkSub[];
  checked: boolean[];
  saving: boolean;
  onToggle: (index: number) => void;
  onEdit: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSave: () => void;
  onRetry: () => void;
}

function ReviewModeImpl({
  parsedSubs,
  checked,
  saving,
  onToggle,
  onEdit,
  onSelectAll,
  onDeselectAll,
  onSave,
  onRetry,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const selectedCount = checked.filter(Boolean).length;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
        <TouchableOpacity onPress={onSelectAll}>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
            {t('add.bulk_select_all', 'Выбрать все')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDeselectAll}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>
            {t('add.bulk_deselect_all', 'Снять все')}
          </Text>
        </TouchableOpacity>
      </View>

      {parsedSubs.map((sub, i) => (
        <ReviewRow
          key={i}
          index={i}
          sub={sub}
          checked={checked[i] ?? true}
          onToggle={onToggle}
          onEdit={onEdit}
        />
      ))}

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 8, opacity: saving ? 0.6 : 1 }]}
        onPress={onSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.actionTxt}>
            {t('add.bulk_save', `Добавить ${selectedCount}`)}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onRetry} style={{ alignItems: 'center', marginTop: 12 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          ← {t('add.bulk_retry', 'Попробовать снова')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const ReviewMode = memo(ReviewModeImpl);

const styles = StyleSheet.create({
  actionBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  actionTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
