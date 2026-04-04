import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Share, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { workspaceApi } from '../api/workspace';

interface Props {
  workspaceId: string;
  onClose: () => void;
}

export function InviteCodeSheet({ workspaceId, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await workspaceApi.generateInviteCode(workspaceId);
      setCode(result.code);
      setExpiresAt(result.expiresAt);
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.response?.data?.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (code) {
      Clipboard.setString(code);
      Alert.alert(t('workspace.code_copied', 'Copied!'));
    }
  };

  const shareCode = async () => {
    if (code) {
      await Share.share({
        message: t('workspace.share_message', 'Join my team on Subradar! Code: {{code}} — Download: https://subradar.ai/download', { code }),
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="key-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('workspace.invite_code', 'Invite Code')}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {!code ? (
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: colors.primary }]}
          onPress={generate}
          disabled={loading}
        >
          <Text style={styles.generateBtnText}>
            {loading ? t('common.loading', 'Loading...') : t('workspace.generate_code', 'Generate Code')}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.codeText, { color: colors.text }]}>{code}</Text>
          </View>
          <Text style={[styles.expiresText, { color: colors.textSecondary }]}>
            {t('workspace.expires_48h', 'Expires in 48 hours · Single use')}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={copyCode}>
              <Ionicons name="copy-outline" size={18} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>{t('common.copy', 'Copy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={shareCode}>
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>{t('common.share', 'Share')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, padding: 20, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 8 },
  generateBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  codeBox: { borderRadius: 12, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 8 },
  codeText: { fontSize: 32, fontWeight: '800', letterSpacing: 6 },
  expiresText: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
});
