/**
 * BulkListStage — scrollable list of parsed subscriptions shown when the
 * AI pipeline returns multiple candidates (e.g. screenshot parse or plans
 * turned into subs). Lives inside AIWizard between the main input stage
 * and the bulk-edit detail stage.
 *
 * Why this exists:
 *   The inline JSX used to live in `AIWizard.tsx`. Every row rendered
 *   inline arrow functions (`onPress={() => ...}`) and every `setUi` call
 *   re-rendered the entire list, which made toggling one checkbox in a
 *   20-item list surprisingly laggy on older devices. Extracting into a
 *   memoized `BulkRow` means toggling row `i` only re-renders that row.
 *
 * Shape:
 *   - Header: title, count, "select all" / "deselect all" toggles.
 *   - List: ScrollView of `BulkRow` cards; each row is `React.memo` and
 *     receives stable `(i: number) => void` callbacks from the parent.
 *   - Footer save button stays in the orchestrator — it needs the same
 *     limit-checking / paywall logic as the other stages so it's easier
 *     to keep it next to the confirm/plans footer variants.
 *
 * Animation:
 *   The parent wraps this whole tree in an `Animated.View` with
 *   `fadeAnim`. Stage transitions (bulk → bulk-edit) are driven by
 *   `fade(() => setUi(...))` in the parent, so the memoized row
 *   callbacks don't need to know about the animation.
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import type { ParsedSub } from './types';

interface Props {
  subs: ParsedSub[];
  checked: boolean[];
  editingIndex: number | null;
  onToggle: (index: number) => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

interface RowProps {
  index: number;
  sub: ParsedSub;
  checked: boolean;
  isEditing: boolean;
  onToggle: (index: number) => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}

const PERIOD_SUFFIX: Record<string, string> = {
  MONTHLY: '/мес',
  YEARLY: '/год',
  WEEKLY: '/нед',
  QUARTERLY: '/квар',
};

const BulkRow = React.memo(function BulkRow({
  index,
  sub,
  checked,
  isEditing,
  onToggle,
  onEdit,
  onRemove,
}: RowProps) {
  const { colors, isDark } = useTheme();

  const handleToggle = useCallback(() => onToggle(index), [index, onToggle]);
  const handleEdit = useCallback(() => onEdit(index), [index, onEdit]);
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: checked ? colors.primary + '12' : isDark ? '#1C1C2E' : '#F5F5F7',
          borderColor: isEditing
            ? colors.primary
            : checked
              ? colors.primary + '60'
              : colors.border,
        },
      ]}
    >
      {/* Top row: checkbox + icon + name/price */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        {/* Checkbox */}
        <TouchableOpacity onPress={handleToggle}>
          <View
            style={[
              styles.check,
              {
                borderColor: checked ? colors.primary : colors.border,
                backgroundColor: checked ? colors.primary : 'transparent',
              },
            ]}
          >
            {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        </TouchableOpacity>

        {/* Icon */}
        {sub.iconUrl ? (
          <Image source={{ uri: sub.iconUrl }} style={{ width: 34, height: 34, borderRadius: 8 }} />
        ) : (
          <View style={[styles.iconBox, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.iconLetter, { color: colors.primary }]}>
              {(sub.name || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}

        {/* Name + price — tap anywhere opens the edit detail */}
        <TouchableOpacity onPress={handleEdit} style={{ flex: 1 }} activeOpacity={0.7}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {sub.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {sub.currency ?? 'USD'} {(sub.amount ?? 0).toFixed(2)}
            {PERIOD_SUFFIX[sub.billingPeriod ?? 'MONTHLY'] ?? ''}
            {sub.category ? `  ·  ${sub.category.toLowerCase()}` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons row */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, paddingLeft: 34 }}>
        <TouchableOpacity
          onPress={handleEdit}
          style={{ padding: 8, borderRadius: 8, backgroundColor: colors.primary + '12' }}
        >
          <Ionicons name="pencil" size={16} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRemove}
          style={{ padding: 8, borderRadius: 8, backgroundColor: '#EF444412' }}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

function BulkListStageImpl({
  subs,
  checked,
  editingIndex,
  onToggle,
  onEdit,
  onRemove,
  onSelectAll,
  onDeselectAll,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }}>
      <Text style={[headerStyles.question, { color: colors.text }]}>
        {t('add.bulk_review', 'Выбери подписки')}
      </Text>
      <Text style={[headerStyles.hint, { color: colors.textSecondary }]}>
        {t('add.bulk_auto_detected', `Найдено: ${subs.length}`)}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 }}>
        <TouchableOpacity onPress={onSelectAll}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
            {t('add.bulk_select_all', 'Выбрать все')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDeselectAll}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {t('add.bulk_deselect_all', 'Снять все')}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
      >
        {subs.map((sub, i) => (
          <BulkRow
            key={i}
            index={i}
            sub={sub}
            checked={checked[i] ?? true}
            isEditing={editingIndex === i}
            onToggle={onToggle}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export const BulkListStage = React.memo(BulkListStageImpl);

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLetter: { fontSize: 18, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});

const headerStyles = StyleSheet.create({
  question: { fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 2 },
  hint: { fontSize: 14, marginBottom: 8 },
});
