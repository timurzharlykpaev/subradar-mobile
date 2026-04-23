/**
 * QuestionStage — shown when the AI wizard needs a clarifying answer from
 * the user mid-flow (e.g. "What currency?", "How often are you billed?").
 *
 * Why this exists:
 *   The `ui.kind === 'question'` branch used to piggyback on the idle input
 *   UI inside `AIWizard.tsx`, reusing the parent's `input` / `setInput`
 *   state and the shared TextInput. That coupling meant every keystroke
 *   re-rendered the whole wizard tree and the idle stage's chips / mic
 *   block flickered in and out between clarifying questions.
 *
 * What changed on extraction:
 *   1. Owns its own answer buffer locally via `useState` — no parent
 *      re-render on each keystroke.
 *   2. Single focused `DoneAccessoryInput` instead of a 120-line mic + OR
 *      divider + chip block. Voice input still reachable from the idle
 *      stage; clarifying questions are short text answers in practice.
 *   3. Includes its own Next / Back footer so the orchestrator doesn't
 *      need a `ui.kind`-specific branch in its `<View style={styles.footer}>`.
 *   4. Wrapped in `React.memo` so stable props (text, field, stable
 *      callbacks) skip rerenders.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';

interface Props {
  /** Clarifying question text returned by `/ai/wizard`. */
  text: string;
  /** Field the backend is asking about (e.g. `currency`). Forwarded to
   *  `onAnswer` as metadata so the parent can include it in analytics. */
  field: string;
  /**
   * Submit handler. Parent is responsible for dispatching the answer back
   * into the wizard pipeline (typically `callWizard(value)`).
   */
  onAnswer: (value: string, field: string) => void;
  /** Back to idle — cancels the current wizard conversation. */
  onCancel: () => void;
}

function QuestionStageImpl({ text, field, onAnswer, onCancel }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  const bg = isDark ? '#1C1C2E' : '#F5F5F7';
  const canSubmit = value.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    Keyboard.dismiss();
    onAnswer(value.trim(), field);
  }, [canSubmit, value, field, onAnswer]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.question, { color: colors.text }]}>{text}</Text>

        <DoneAccessoryInput
          testID="ai-wizard-question-input"
          style={[
            styles.textInput,
            {
              backgroundColor: bg,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          value={value}
          onChangeText={setValue}
          placeholder={t('add.ai_answer_placeholder', 'Ваш ответ')}
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={2}
          blurOnSubmit
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          autoFocus
        />

        <TouchableOpacity
          onPress={onCancel}
          style={{ alignItems: 'center', paddingVertical: 8 }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
            {t('common.cancel', 'Отмена')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primary },
            !canSubmit && { opacity: 0.4 },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.actionTxt}>{t('add.ai_next', 'Далее →')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const QuestionStage = React.memo(QuestionStageImpl);

const styles = StyleSheet.create({
  question: { fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 12 },
  textInput: {
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    borderWidth: 1.5,
    marginBottom: 12,
    minHeight: 56,
    maxHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  footer: { paddingTop: 12 },
  actionBtn: { borderRadius: 18, padding: 18, alignItems: 'center' },
  actionTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
