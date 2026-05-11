import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface MemberLike {
  id: string;
  userId?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
  inviteEmail?: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

interface Props {
  visible: boolean;
  members: MemberLike[];
  selectedMemberId: string | null;
  onSelect: (member: MemberLike) => void;
  confirmText: string;
  onConfirmTextChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}

/**
 * Two-step ownership transfer flow:
 *   1. Owner picks one active member from the list.
 *   2. Owner types "TRANSFER" into the confirm field; the button
 *      only enables when the literal matches the server-side check.
 *
 * No backdrop dismiss to avoid accidental tap-out mid-confirmation —
 * destructive irreversible action gets the explicit X-close button.
 */
export function TransferOwnershipSheet({
  visible,
  members,
  selectedMemberId,
  onSelect,
  confirmText,
  onConfirmTextChange,
  onCancel,
  onConfirm,
  pending,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const selected = members.find((m) => m.id === selectedMemberId) || null;
  const canConfirm =
    !!selected && confirmText.trim().toUpperCase() === 'TRANSFER' && !pending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('workspace.transfer_ownership', 'Transfer ownership')}
            </Text>
            <TouchableOpacity onPress={onCancel} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {t(
              'workspace.transfer_warning',
              'You will be demoted to admin. The new owner takes over billing and full team control. This action is irreversible.',
            )}
          </Text>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {t('workspace.transfer_pick_member', 'Choose new owner')}
          </Text>
          <ScrollView style={styles.memberList}>
            {members.length === 0 ? (
              <View
                style={[
                  styles.empty,
                  { borderColor: colors.border },
                ]}
              >
                <Text
                  style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}
                >
                  {t(
                    'workspace.transfer_no_eligible',
                    'No eligible members. Invite someone first.',
                  )}
                </Text>
              </View>
            ) : (
              members.map((m) => {
                const isSelected = m.id === selectedMemberId;
                const name = m.user?.name || m.user?.email || m.inviteEmail || '—';
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => onSelect(m)}
                    style={[
                      styles.memberRow,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected
                          ? colors.primary + '14'
                          : colors.background,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.memberName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      <Text
                        style={[styles.memberRole, { color: colors.textMuted }]}
                      >
                        {m.role}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {selected && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 14 }]}>
                {t(
                  'workspace.transfer_type_confirm',
                  'Type TRANSFER to confirm',
                )}
              </Text>
              <TextInput
                value={confirmText}
                onChangeText={onConfirmTextChange}
                placeholder="TRANSFER"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
              />
            </>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onCancel}
              style={[
                styles.btn,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>
                {t('common.cancel', 'Cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!canConfirm}
              onPress={onConfirm}
              style={[
                styles.btn,
                {
                  backgroundColor: canConfirm ? '#EF4444' : colors.border,
                  opacity: canConfirm ? 1 : 0.6,
                },
              ]}
            >
              {pending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={[styles.btnText, { color: '#FFF' }]}>
                  {t('workspace.transfer_btn', 'Transfer')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 18, marginBottom: 18 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  memberList: { maxHeight: 220 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  memberName: { fontSize: 14, fontWeight: '700' },
  memberRole: { fontSize: 11, marginTop: 2 },
  empty: { padding: 18, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
});
