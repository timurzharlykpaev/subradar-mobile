import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { DoneAccessoryInput } from './primitives/DoneAccessoryInput';

interface Props {
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteAccountConfirm({ onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const canDelete = input.toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#1a0a0a', borderColor: '#ef4444' + '40' }]}>
      <View style={styles.header}>
        <Ionicons name="warning" size={24} color="#ef4444" />
        <Text style={styles.title}>
          {t('settings.delete_account', 'Delete Account')}
        </Text>
      </View>

      <Text style={styles.warning}>
        {t('settings.delete_account_warning', 'All data will be permanently removed. This cannot be undone.')}
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {t('settings.type_delete', 'Type DELETE to confirm:')}
      </Text>

      <DoneAccessoryInput
        style={[styles.input, { color: colors.text, borderColor: canDelete ? '#ef4444' : colors.border }]}
        value={input}
        onChangeText={setInput}
        placeholder="DELETE"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
            {t('common.cancel', 'Cancel')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteBtn, { opacity: canDelete ? 1 : 0.3 }]}
          onPress={handleDelete}
          disabled={!canDelete || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.deleteBtnText}>
              {t('settings.delete_account', 'Delete Account')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, padding: 20, borderWidth: 1, marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#ef4444' },
  warning: { fontSize: 14, lineHeight: 20, color: '#ef4444', opacity: 0.8, marginBottom: 16 },
  label: { fontSize: 13, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16, fontWeight: '700', textAlign: 'center', letterSpacing: 4, backgroundColor: 'rgba(0,0,0,0.3)' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { fontSize: 15 },
  deleteBtn: { backgroundColor: '#ef4444', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
