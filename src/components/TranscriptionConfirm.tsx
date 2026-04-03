import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  text: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function TranscriptionConfirm({ text, onConfirm, onCancel }: Props) {
  const [editedText, setEditedText] = useState(text);
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="mic" size={20} color="#7c3aed" />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('add_flow.i_heard', 'I heard:')}
        </Text>
      </View>

      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        value={editedText}
        onChangeText={setEditedText}
        multiline
        autoFocus={false}
        placeholderTextColor={colors.textSecondary}
      />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
            {t('common.cancel', 'Cancel')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() => onConfirm(editedText.trim())}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.confirmText}>
            {t('add_flow.looks_good', 'Looks good')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, padding: 20, marginTop: 12, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  input: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, lineHeight: 22, minHeight: 60, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { fontSize: 15 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#22c55e', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
