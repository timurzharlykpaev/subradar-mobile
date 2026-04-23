import React, { memo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';

interface Props {
  text: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
  /**
   * Called on every edit of the transcription buffer. Optional — most callers
   * only care about the final confirmed text, but exposing it lets the
   * orchestrator keep a live copy if needed.
   */
  onEdit?: (text: string) => void;
}

function TranscriptionViewImpl({ text, onConfirm, onCancel, onEdit }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [editedText, setEditedText] = useState(text);

  const handleChange = useCallback(
    (next: string) => {
      setEditedText(next);
      onEdit?.(next);
    },
    [onEdit],
  );

  const handleConfirm = useCallback(() => {
    onConfirm(editedText.trim());
  }, [editedText, onConfirm]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="mic" size={20} color="#7c3aed" />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('add_flow.i_heard', 'I heard:')}
        </Text>
      </View>

      <DoneAccessoryInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        value={editedText}
        onChangeText={handleChange}
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

        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.confirmText}>
            {t('add_flow.looks_good', 'Looks good')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const TranscriptionView = memo(TranscriptionViewImpl);

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
