import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  onDismiss: () => void;
}

export function AddOnboarding({ onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Text style={[styles.emoji]}>📱</Text>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('add_flow.onboarding_title', 'Add your subscriptions')}
      </Text>

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('add_flow.onboarding_hint', 'Try saying:')}
      </Text>
      <View style={[styles.exampleBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.example, { color: colors.text }]}>
          "Netflix 15 dollars, Spotify 10,{'\n'}ChatGPT 20 monthly"
        </Text>
      </View>

      <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 12 }]}>
        {t('add_flow.onboarding_or_tap', 'Or tap a service below')}
      </Text>

      <TouchableOpacity style={styles.button} onPress={onDismiss}>
        <Text style={styles.buttonText}>{t('add_flow.got_it', 'Got it')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', borderRadius: 16 },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  hint: { fontSize: 14, marginBottom: 8 },
  exampleBox: { borderRadius: 12, borderWidth: 1, padding: 16, width: '100%' },
  example: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', textAlign: 'center' },
  button: { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
