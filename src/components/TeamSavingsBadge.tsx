import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { useRouter } from 'expo-router';
import { useWorkspaceAnalysisLatest } from '../hooks/useWorkspaceAnalysis';

export function TeamSavingsBadge() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { data } = useWorkspaceAnalysisLatest();

  const savings = data?.result?.teamSavings;
  const overlapsCount = data?.result?.overlaps?.length || 0;

  if (!savings || savings <= 0) return null;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push('/(tabs)/workspace' as any)}
      activeOpacity={0.7}
    >
      <Ionicons name="people" size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('workspace.team_savings', 'Team savings')}: ${savings.toFixed(0)}/{t('add_flow.mo', 'mo')}
        </Text>
        {overlapsCount > 0 && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {overlapsCount} {t('workspace.overlaps_found', 'overlaps found')}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginHorizontal: 20, marginTop: 8 },
  title: { fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 2 },
});
