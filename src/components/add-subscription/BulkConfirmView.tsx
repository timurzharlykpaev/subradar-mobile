import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatMoney } from '../../utils/formatMoney';
import { resolveIconUrl } from '../../utils/iconUrl';
import type { ParsedSub } from '../AIWizard';

interface BulkRowProps {
  index: number;
  sub: ParsedSub;
  checked: boolean;
  lang: string;
  displayCurrency: string;
  onToggle: (index: number) => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}

function BulkRowImpl({
  index,
  sub,
  checked,
  lang,
  displayCurrency,
  onToggle,
  onEdit,
  onRemove,
}: BulkRowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Centralised resolver: explicit iconUrl → serviceUrl host → name-guessed
  // domain (DOMAIN_MAP + single-token heuristic), all via Google's favicon
  // service. Surfaces logos for AI-scanned rows that arrive with just a name.
  const iconUrl = resolveIconUrl({ iconUrl: sub.iconUrl, serviceUrl: sub.serviceUrl, name: sub.name }) ?? null;

  const categoryKey = `categories.${(sub.category || 'OTHER').toLowerCase()}`;
  const categoryLabel = t(categoryKey, (sub.category || 'OTHER').replace(/_/g, ' '));

  const periodMap: Record<string, string> = {
    MONTHLY: t('subscription.monthly', 'monthly'),
    YEARLY: t('subscription.yearly', 'yearly'),
    WEEKLY: t('subscription.weekly', 'weekly'),
    QUARTERLY: t('subscription.quarterly', 'quarterly'),
    LIFETIME: t('subscription.lifetime', 'lifetime'),
    ONE_TIME: t('subscription.one_time', 'one-time'),
  };
  const periodLabel = periodMap[(sub.billingPeriod || 'MONTHLY').toUpperCase()] || sub.billingPeriod;

  const handleToggle = useCallback(() => onToggle(index), [onToggle, index]);
  const handleEdit = useCallback(() => onEdit(index), [onEdit, index]);
  const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        marginBottom: 10,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1.5,
        borderColor: checked ? colors.primary : colors.border,
        opacity: checked ? 1 : 0.4,
      }}
    >
      {/* Checkbox */}
      <TouchableOpacity
        onPress={handleToggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={26}
          color={checked ? colors.primary : colors.textMuted}
        />
      </TouchableOpacity>

      {/* Icon */}
      {iconUrl ? (
        <Image
          source={{ uri: iconUrl }}
          style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface2 }}
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.primary + '15',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="cube-outline" size={22} color={colors.primary} />
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
          {sub.name}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>
          {categoryLabel} · {periodLabel}
        </Text>
      </View>

      {/* Price + Actions */}
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
          {formatMoney(sub.amount || 0, sub.currency || displayCurrency, lang)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={handleEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={22} color={colors.error || '#EF4444'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const BulkRow = memo(BulkRowImpl);

interface Props {
  items: ParsedSub[];
  checked: boolean[];
  saving: boolean;
  onToggle: (index: number) => void;
  onSave: () => Promise<void> | void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onCancel: () => void;
}

function BulkConfirmViewImpl({ items, checked, saving, onToggle, onSave, onEdit, onRemove, onCancel }: Props) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const displayCurrency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');

  // Per-row selection now lives in the orchestrator (`bulkChecked`), kept in
  // lockstep with `bulkItems` so that removals shift both arrays together.
  // This view is purely presentational.
  const selectedCount = useMemo(() => checked.filter(Boolean).length, [checked]);
  const anySelected = selectedCount > 0;

  return (
    // No wrapping `flex: 1` View and no inner ScrollView — this whole
    // view is rendered inside AddSubscriptionSheet's outer ScrollView.
    // Nesting another vertical scroll inside it produced the "infinite
    // scroll, content disappears" bug (parent's main-axis is unbounded
    // so flex:1 + nested ScrollView → ambiguous layout that grows on
    // every render). Render rows in-flow; outer scroll handles overflow.
    <View>
      <TouchableOpacity
        onPress={onCancel}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
          paddingVertical: 8,
          paddingHorizontal: 4,
        }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>
          {t('common.back', 'Back')}
        </Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Ionicons name="sparkles" size={22} color={colors.primary} />
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
          {t('add.bulk_review_title', 'Found subscriptions')}
        </Text>
      </View>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
        {t('add.bulk_review_sub', { count: items.length, defaultValue: 'Found: {{count}}' })}
      </Text>

      {items.map((sub, idx) => (
        <BulkRow
          key={idx}
          index={idx}
          sub={sub}
          checked={!!checked[idx]}
          lang={i18n.language}
          displayCurrency={displayCurrency}
          onToggle={onToggle}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ))}

      {/* Save button — sits at the end of the in-flow content. The
          outer ScrollView's contentContainerStyle.paddingBottom keeps
          it above the safe-area bottom. */}
      <TouchableOpacity
        onPress={onSave}
        disabled={saving || !anySelected}
        style={{
          backgroundColor: anySelected ? colors.primary : colors.surface2,
          borderRadius: 16,
          padding: 18,
          alignItems: 'center',
          marginTop: 14,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800' }}>
            {t('add.bulk_save', { count: selectedCount, defaultValue: 'Add {{count}}' })}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export const BulkConfirmView = memo(BulkConfirmViewImpl);
