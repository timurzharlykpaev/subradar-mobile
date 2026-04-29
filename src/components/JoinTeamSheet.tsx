import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, Keyboard,
  TouchableWithoutFeedback, InputAccessoryView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { workspaceApi } from '../api/workspace';
import { useQueryClient } from '@tanstack/react-query';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { analytics } from '../services/analytics';

let RevenueCatUI: any = null;
try { RevenueCatUI = require('react-native-purchases-ui').default; } catch {}

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

const INPUT_ACCESSORY_ID = 'join-team-keyboard';

export function JoinTeamSheet({ onSuccess, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();
  const access = useEffectiveAccess();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const canJoin = code.length >= 6 && !loading;

  const performJoin = async (joinCode: string) => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      await workspaceApi.joinByCode(joinCode.toUpperCase());
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      Alert.alert(t('workspace.joined', 'Joined!'), t('workspace.joined_msg', 'You are now a team member.'));
      onSuccess();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!canJoin) return;
    const trimmedCode = code.trim();
    if (trimmedCode.length < 6) return;
    if (access?.hasOwnPaidPlan) {
      analytics.track('join_warn_shown' as any);
      Alert.alert(
        t('team_logic.join_warn_title'),
        t('team_logic.join_warn_desc'),
        [
          { text: t('team_logic.join_warn_cta_cancel_pro'), onPress: async () => { try { await RevenueCatUI?.presentCustomerCenter(); } catch {} } },
          { text: t('team_logic.join_warn_cta_continue'), onPress: () => { analytics.track('join_warn_continued' as any); performJoin(trimmedCode); } },
        ],
      );
      return;
    }
    await performJoin(trimmedCode);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>
              {t('workspace.join_team', 'Join Team')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('workspace.enter_code', 'Enter invite code')}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: canJoin ? colors.primary : colors.border, backgroundColor: colors.background }]}
            value={code}
            onChangeText={(val) => setCode(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
            placeholder="A7K2M9XP3N"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={10}
            autoFocus
            returnKeyType="join"
            onSubmitEditing={handleJoin}
            inputAccessoryViewID={Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined}
            keyboardAppearance={isDark ? 'dark' : 'light'}
          />

          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: colors.primary, opacity: canJoin ? 1 : 0.4 }]}
            onPress={handleJoin}
            disabled={!canJoin}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={18} color="#FFF" />
            <Text style={styles.joinBtnText}>
              {loading ? t('common.loading', 'Loading...') : t('workspace.join', 'Join')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* iOS keyboard toolbar with Done button */}
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
            <View style={[styles.keyboardBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); if (canJoin) handleJoin(); }}
                style={[styles.doneBtn, { backgroundColor: canJoin ? colors.primary : colors.surface2 }]}
              >
                <Text style={[styles.doneBtnText, { color: canJoin ? '#FFF' : colors.textMuted }]}>
                  {canJoin ? t('workspace.join', 'Join') : t('common.done', 'Done')}
                </Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        )}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, padding: 20, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 8 },
  label: { fontSize: 14, marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 16, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: 6 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, marginTop: 16 },
  joinBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  keyboardBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  doneBtnText: { fontSize: 15, fontWeight: '700' },
});
