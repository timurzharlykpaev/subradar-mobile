import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { AIWizard, type ParsedSub } from '../AIWizard';

interface Props {
  onSave: (sub: ParsedSub) => Promise<void>;
  onSaveBulk: (subs: ParsedSub[]) => Promise<void>;
  onEdit: (sub: ParsedSub) => void;
  onBack: () => void;
}

/**
 * Wraps `AIWizard` — the AI-clarification fallback that asks follow-up
 * questions when the initial parse is ambiguous or a lookup returns nothing.
 * The orchestrator owns the save/bulk/edit business logic; this view is
 * purely the presentational shell (back button + `AIWizard` host).
 */
function WizardViewImpl({ onSave, onSaveBulk, onEdit, onBack }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, paddingHorizontal: 4, paddingBottom: 16 }}>
      <TouchableOpacity
        onPress={onBack}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 4 }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>
          {t('common.back', 'Back')}
        </Text>
      </TouchableOpacity>
      <AIWizard onSave={onSave} onSaveBulk={onSaveBulk} onEdit={onEdit} />
    </View>
  );
}

export const WizardView = memo(WizardViewImpl);
