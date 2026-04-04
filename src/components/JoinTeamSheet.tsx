import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { workspaceApi } from '../api/workspace';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

export function JoinTeamSheet({ onSuccess, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await workspaceApi.joinByCode(code.toUpperCase());
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      Alert.alert(t('workspace.joined', 'Joined!'), t('workspace.joined_msg', 'You are now a team member.'));
      onSuccess();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="people-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('workspace.join_team', 'Join Team')}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {t('workspace.enter_code', 'Enter invite code')}
      </Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        value={code}
        onChangeText={(val) => setCode(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        placeholder="A7K2M9"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="characters"
        maxLength={6}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.joinBtn, { backgroundColor: colors.primary, opacity: code.length === 6 ? 1 : 0.5 }]}
        onPress={handleJoin}
        disabled={code.length !== 6 || loading}
      >
        <Text style={styles.joinBtnText}>
          {loading ? t('common.loading', 'Loading...') : t('workspace.join', 'Join')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, padding: 20, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 8 },
  label: { fontSize: 14, marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1, padding: 16, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 8 },
  joinBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
