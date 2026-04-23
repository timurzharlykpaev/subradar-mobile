import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatMoney } from '../../utils/formatMoney';
import type { ParsedSub } from '../AIWizard';

// Known service → real domain mapping (hoisted to module scope so it isn't
// re-created on every render inside the row map).
const DOMAIN_MAP: Record<string, string> = {
  'chatgpt': 'openai.com', 'chatgpt plus': 'openai.com', 'openai': 'openai.com',
  'youtube': 'youtube.com', 'youtube premium': 'youtube.com', 'youtube music': 'music.youtube.com',
  'netflix': 'netflix.com', 'netflix premium': 'netflix.com', 'netflix standard': 'netflix.com',
  'spotify': 'spotify.com', 'spotify premium': 'spotify.com',
  'playstation plus': 'playstation.com', 'playstation': 'playstation.com', 'ps plus': 'playstation.com',
  'xbox game pass': 'xbox.com', 'xbox': 'xbox.com',
  'apple tv+': 'tv.apple.com', 'apple tv': 'tv.apple.com',
  'apple music': 'music.apple.com', 'apple arcade': 'apple.com',
  'icloud': 'icloud.com', 'icloud+': 'icloud.com', 'icloud plus': 'icloud.com',
  'disney+': 'disneyplus.com', 'disney plus': 'disneyplus.com',
  'hbo max': 'hbomax.com', 'hbo': 'hbomax.com',
  'amazon prime': 'amazon.com', 'prime video': 'amazon.com',
  'github': 'github.com', 'github copilot': 'github.com',
  'figma': 'figma.com', 'notion': 'notion.so', 'slack': 'slack.com',
  'adobe': 'adobe.com', 'adobe creative cloud': 'adobe.com',
  'midjourney': 'midjourney.com', 'claude': 'claude.ai',
  'nordvpn': 'nordvpn.com', '1password': '1password.com',
  'strava': 'strava.com', 'duolingo': 'duolingo.com',
};

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

  const nameLower = (sub.name || '').toLowerCase().trim();
  const domain = sub.serviceUrl
    ? (() => { try { return new URL(sub.serviceUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })()
    : DOMAIN_MAP[nameLower] || '';
  const iconUrl = sub.iconUrl || (domain ? `https://icon.horse/icon/${domain}` : null);

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
  saving: boolean;
  onSave: (selected: ParsedSub[]) => Promise<void> | void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onCancel: () => void;
}

function BulkConfirmViewImpl({ items, saving, onSave, onEdit, onRemove, onCancel }: Props) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const displayCurrency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');

  // Per-row selection is presentational (reset to "all checked" whenever the
  // orchestrator replaces `items`). Keeping it local avoids N re-renders of the
  // parent on every toggle and keeps orchestrator state minimal.
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => true));

  useEffect(() => {
    // Re-align length on orchestrator-driven add/remove. Preserve existing
    // booleans by index; default new rows to true.
    setChecked((prev) => {
      if (prev.length === items.length) return prev;
      return items.map((_, i) => (i < prev.length ? prev[i] : true));
    });
  }, [items]);

  const handleToggle = useCallback((index: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    const selected = items.filter((_, i) => checked[i]);
    if (selected.length === 0) return;
    onSave(selected);
  }, [items, checked, onSave]);

  const selectedCount = useMemo(() => checked.filter(Boolean).length, [checked]);
  const anySelected = selectedCount > 0;

  return (
    <View style={{ flex: 1 }}>
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

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {items.map((sub, idx) => (
          <BulkRow
            key={idx}
            index={idx}
            sub={sub}
            checked={!!checked[idx]}
            lang={i18n.language}
            displayCurrency={displayCurrency}
            onToggle={handleToggle}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
      </ScrollView>

      {/* Save button */}
      <TouchableOpacity
        onPress={handleSave}
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
