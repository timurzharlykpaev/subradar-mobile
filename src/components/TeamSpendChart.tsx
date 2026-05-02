import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { formatMoney } from '../utils/formatMoney';

interface MemberSpend {
  name: string;
  amount: number;
}

interface Props {
  members: MemberSpend[];
  currency?: string;
}

// Deterministic accent palette so the same member always gets the same
// avatar / bar colour across renders. Keeps the chart visually stable
// when amounts shift between refreshes.
const ACCENT_PALETTE = [
  '#7C3AED', // purple (matches app primary)
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#EF4444', // red
  '#8B5CF6', // violet
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const single = parts[0];
    // Email-like input — use the part before "@".
    const handle = single.includes('@') ? single.split('@')[0] : single;
    return handle.slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeamSpendChart({ members, currency = 'USD' }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  if (members.length === 0) return null;

  const sorted = [...members].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((sum, m) => sum + m.amount, 0);
  const max = sorted[0]?.amount || 1;
  const lang = i18n.language || 'en';

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {t('workspace.spend_by_member', 'Spending by Member')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('workspace.spend_by_member_caption', { count: sorted.length, defaultValue: '{{count}} members' })}
          </Text>
        </View>
        {total > 0 && (
          <View style={styles.totalBadge}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]} numberOfLines={1}>
              {t('analytics.total', 'Total')}
            </Text>
            <Text style={[styles.totalAmount, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(total, currency, lang)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.list}>
        {sorted.map((member, i) => {
          const accent = colorForName(member.name || `m-${i}`);
          const sharePct = total > 0 ? (member.amount / total) * 100 : 0;
          const widthPct = max > 0 ? Math.max((member.amount / max) * 100, 4) : 4;
          const isTop = i === 0 && total > 0 && sorted.length > 1;
          return (
            <View
              key={`${member.name}-${i}`}
              style={[
                styles.row,
                i < sorted.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: accent + '1F', borderColor: accent }]}>
                <Text style={[styles.avatarText, { color: accent }]}>{initials(member.name || '?')}</Text>
              </View>

              <View style={styles.content}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {member.name || t('workspace.member_unnamed', 'Member')}
                  </Text>
                  {isTop && (
                    <View style={[styles.crown, { backgroundColor: accent + '22' }]}>
                      <Ionicons name="trophy" size={11} color={accent} />
                    </View>
                  )}
                </View>

                <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                  <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: accent }]} />
                </View>

                <View style={styles.amountRow}>
                  <Text
                    style={[styles.amount, { color: colors.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {formatMoney(member.amount, currency, lang)}
                  </Text>
                  {total > 0 && (
                    <Text style={[styles.share, { color: colors.textMuted }]}>
                      {sharePct >= 1 ? Math.round(sharePct) : sharePct.toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  totalBadge: {
    alignItems: 'flex-end',
    maxWidth: 140,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  crown: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  share: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
