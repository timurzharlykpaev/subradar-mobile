import React, { useState, useRef, useEffect } from 'react';
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
  // Inline confirmation flag (replaces a blocking Alert that older users
  // misread as an error). Resets itself after 1.6s.
  const [justCopied, setJustCopied] = useState(false);
  // Tracks the in-flight reset timer so we (1) don't leak on unmount and
  // (2) don't stack timers if the user copies twice in a row.
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

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
    if (!code) return;
    Clipboard.setString(code);
    setJustCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setJustCopied(false);
      copyTimerRef.current = null;
    }, 1600);
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
          {/* Step-by-step instructions so users (especially older ones)
              know what to do with the code rather than staring at a number. */}
          <Text style={[styles.instruction, { color: colors.textSecondary }]}>
            {t('workspace.share_instructions', 'Send this code to a teammate. Tap the code to copy, or use Share to send via Messages, WhatsApp, etc.')}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={copyCode}
            style={[styles.codeBox, { backgroundColor: colors.background, borderColor: justCopied ? colors.success : colors.border, borderWidth: justCopied ? 2 : 1 }]}
          >
            <Text style={[styles.codeText, { color: colors.text }]}>{code}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Ionicons
                name={justCopied ? 'checkmark-circle' : 'copy-outline'}
                size={14}
                color={justCopied ? colors.success : colors.textMuted}
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: justCopied ? colors.success : colors.textMuted }}>
                {justCopied
                  ? t('workspace.code_copied', 'Copied!')
                  : t('workspace.tap_to_copy', 'Tap to copy')}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.expiresText, { color: colors.textSecondary }]}>
            {t('workspace.expires_48h', 'Expires in 48 hours · Single use')}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={copyCode}>
              <Ionicons name={justCopied ? 'checkmark' : 'copy-outline'} size={18} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>
                {justCopied ? t('workspace.code_copied', 'Copied!') : t('common.copy', 'Copy')}
              </Text>
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
  instruction: { fontSize: 13, lineHeight: 18, marginBottom: 14, paddingHorizontal: 4 },
  codeBox: { borderRadius: 12, borderWidth: 1, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', marginBottom: 10 },
  codeText: { fontSize: 36, fontWeight: '800', letterSpacing: 6 },
  expiresText: { fontSize: 12, textAlign: 'center', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
});
