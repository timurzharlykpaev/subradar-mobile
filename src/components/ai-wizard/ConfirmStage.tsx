/**
 * ConfirmStage — last step of the single-subscription AI flow. Shows the
 * parsed draft as a big "confirmation card" and lets the user either add
 * it straight away or jump to the manual edit form.
 *
 * Why this exists:
 *   The `ui.kind === 'confirm'` branch used to render inline inside
 *   `AIWizard.tsx` with its footer Add / Edit buttons attached via the
 *   orchestrator's footer switch. Extracting means:
 *     - the ~40-line IIFE that computed the icon + card layout moves out
 *       of the render, so the parent re-renders less during `saving`;
 *     - the save button's local `saving` flag lives next to the save
 *       button instead of tangled with the bulk-save `saving` flag in
 *       the parent;
 *     - the stage renders its own footer, keeping paywall / error
 *       handling logic in the parent via the `onSave` callback's
 *       rejection path.
 *
 * Icon resolution:
 *   If the service name matches one of the built-in quick-add services
 *   (Netflix, Spotify, etc.), the parent passes the matching SVG
 *   component via `QuickIcon`. Otherwise we fall back to the remote
 *   `iconUrl` or a coloured-circle initial.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { ExternalLinkIcon } from '../icons';
import type { ParsedSub } from './types';

interface Props {
  subscription: ParsedSub;
  /**
   * Optional SVG icon component from the built-in QUICK catalogue.
   * When provided, rendered at 52×52 above the service name.
   */
  QuickIcon?: React.ComponentType<{ size?: number }>;
  /**
   * Commits the draft. May reject; the parent handles paywall redirect
   * and error alerts. The stage simply awaits and toggles its local
   * saving flag around the call.
   */
  onSave: (sub: ParsedSub) => Promise<void>;
  /** Opens the manual edit form pre-filled with the draft. */
  onEdit: (sub: ParsedSub) => void;
}

function ConfirmStageImpl({ subscription, QuickIcon, onSave, onEdit }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const card = isDark ? '#252538' : '#FFFFFF';
  const s = subscription;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(s);
    } finally {
      setSaving(false);
    }
  }, [onSave, s]);

  const handleEdit = useCallback(() => onEdit(s), [onEdit, s]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.question, { color: colors.text }]}>
          {t('add.ai_q_confirm', 'Всё верно?')}
        </Text>
        <View style={[styles.confirmCard, { backgroundColor: card, borderColor: colors.border }]}>
          <View style={styles.confirmIcon}>
            {QuickIcon ? (
              <QuickIcon size={52} />
            ) : s.iconUrl ? (
              <Image source={{ uri: s.iconUrl }} style={{ width: 52, height: 52, borderRadius: 13 }} />
            ) : (
              <View style={[styles.fallbackIcon, { backgroundColor: colors.primary }]}>
                <Text style={styles.fallbackLetter}>{(s.name ?? '?')[0].toUpperCase()}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.confirmName, { color: colors.text }]}>{s.name}</Text>
          <Text style={[styles.confirmAmount, { color: colors.primary }]}>
            {s.currency ?? 'USD'} {(s.amount ?? 0).toFixed(2)}
            <Text style={[styles.confirmPer, { color: colors.textSecondary }]}>
              {'  ·  '}
              {(s.billingPeriod ?? 'MONTHLY').toLowerCase()}
            </Text>
          </Text>
          {!!s.cancelUrl && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ExternalLinkIcon size={14} color={colors.primary} />
              <Text style={[styles.confirmMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {s.cancelUrl}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="checkmark" size={16} color="#FFF" />
              )}
              <Text style={styles.actionTxt}>{t('add.ai_add', 'Добавить')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={handleEdit}>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
              {t('add.edit_details', 'Редактировать детали')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export const ConfirmStage = React.memo(ConfirmStageImpl);

const styles = StyleSheet.create({
  question: { fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 2 },
  confirmCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  confirmIcon: { marginBottom: 2 },
  fallbackIcon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLetter: { color: '#fff', fontSize: 24, fontWeight: '800' },
  confirmName: { fontSize: 22, fontWeight: '800' },
  confirmAmount: { fontSize: 26, fontWeight: '800' },
  confirmPer: { fontSize: 15, fontWeight: '400' },
  confirmMeta: { fontSize: 12, maxWidth: 260 },
  footer: { paddingTop: 12 },
  actionBtn: { borderRadius: 18, padding: 18, alignItems: 'center' },
  actionTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
