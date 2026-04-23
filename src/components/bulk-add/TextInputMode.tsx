/**
 * TextInputMode — the `mode === 'text'` branch of BulkAddSheet.
 *
 * Owns the local `textInput` state because it is not needed anywhere else in
 * the orchestrator. The submit handler is lifted: the parent runs the parse
 * request and transitions to the `review` mode on success.
 */
import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';

// ── TEXT EXAMPLES ─────────────────────────────────────────────────────────────
const TEXT_EXAMPLES = [
  'Netflix $15/mo, Spotify $10, iCloud+ $3',
  'ChatGPT Plus 20 USD monthly, Notion 16 USD/year',
  'Adobe Creative Cloud 600 rubles per month',
  'YouTube Premium 169₽, Apple Music 169₽, 2GIS Pro 99₽',
];

interface Props {
  loading: boolean;
  /** Called with the trimmed text when user taps "Распознать". */
  onSubmit: (text: string) => void;
  /** Called when user taps "← Назад". */
  onBack: () => void;
}

function TextInputModeImpl({ loading, onSubmit, onBack }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const [textInput, setTextInput] = useState('');

  const bg = isDark ? '#12122A' : '#F5F5F7';
  const trimmed = textInput.trim();
  const disabled = !trimmed || loading;

  const handleSubmit = useCallback(() => {
    if (!trimmed) return;
    Keyboard.dismiss();
    onSubmit(trimmed);
  }, [trimmed, onSubmit]);

  return (
    <View>
      <Text style={[styles.modeTitle, { color: colors.text }]}>
        {t('add.bulk_text_hint', 'Список подписок текстом')}
      </Text>

      {/* Examples */}
      <View
        style={[
          styles.examplesBox,
          { backgroundColor: isDark ? '#1C1C2E' : '#F0EFF8', borderColor: colors.border },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Ionicons name="bulb-outline" size={14} color={colors.primary} />
          <Text style={[styles.examplesLabel, { color: colors.primary }]}>
            {t('add.bulk_examples', 'Примеры')}
          </Text>
        </View>
        {TEXT_EXAMPLES.map((ex, i) => (
          <TouchableOpacity key={i} onPress={() => setTextInput(ex)} style={styles.exampleRow}>
            <Text style={[styles.exampleText, { color: colors.textSecondary }]}>• {ex}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <DoneAccessoryInput
        style={[styles.textArea, { backgroundColor: bg, color: colors.text, borderColor: colors.border }]}
        value={textInput}
        onChangeText={setTextInput}
        placeholder={t('add.bulk_text_placeholder', 'Netflix $15/mo, Spotify $10, iCloud $3...')}
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}
        onPress={handleSubmit}
        disabled={disabled}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.actionTxt}>{t('add.bulk_parse', 'Распознать →')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={{ alignItems: 'center', marginTop: 12 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          ← {t('common.back', 'Назад')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const TextInputMode = memo(TextInputModeImpl);

const styles = StyleSheet.create({
  modeTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  examplesBox: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  examplesLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleRow: { paddingVertical: 4 },
  exampleText: { fontSize: 13, lineHeight: 18 },
  textArea: { borderRadius: 14, padding: 14, fontSize: 15, borderWidth: 1.5, minHeight: 120, marginBottom: 14 },
  actionBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  actionTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
