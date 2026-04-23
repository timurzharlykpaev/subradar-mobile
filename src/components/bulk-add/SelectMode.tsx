/**
 * SelectMode — the `mode === 'select'` landing branch of BulkAddSheet.
 *
 * Three large cards (Voice / Text / Screenshot). Every interaction is lifted
 * to the orchestrator via stable callbacks so this component stays purely
 * presentational.
 */
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';

function ModeCard({
  icon,
  color,
  title,
  desc,
  onPress,
  colors,
}: {
  icon: string;
  color: string;
  title: string;
  desc: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[mStyles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}
      activeOpacity={0.75}
    >
      <View style={[mStyles.iconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={26} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[mStyles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[mStyles.desc, { color: colors.textMuted }]} numberOfLines={2}>
          {desc}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const mStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, padding: 16 },
  iconBox: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  desc: { fontSize: 13, lineHeight: 18 },
});

interface Props {
  onPickVoice: () => void;
  onPickText: () => void;
  onPickScreenshot: () => void;
}

function SelectModeImpl({ onPickVoice, onPickText, onPickScreenshot }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ gap: 12 }}>
      <ModeCard
        icon="mic"
        color="#8B5CF6"
        title={t('add.bulk_voice', 'Голосом')}
        desc={t('add.bulk_voice_desc', '"Netflix 15 долларов, Spotify 10, iCloud 3"')}
        onPress={onPickVoice}
        colors={colors}
      />
      <ModeCard
        icon="text"
        color="#06B6D4"
        title={t('add.bulk_text', 'Текстом')}
        desc={t('add.bulk_text_desc', 'Напиши список — AI распознает всё сразу')}
        onPress={onPickText}
        colors={colors}
      />
      <ModeCard
        icon="camera"
        color="#10B981"
        title={t('add.bulk_screenshot', 'Скриншот')}
        desc={t('add.bulk_screenshot_desc', 'Скриншот Apple/Google подписок — распознаем автоматически')}
        onPress={onPickScreenshot}
        colors={colors}
      />
    </View>
  );
}

export const SelectMode = memo(SelectModeImpl);
