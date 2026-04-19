import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';

export function AICreditsBadge() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const access = useEffectiveAccess();

  if (!access || access.isPro) return null;

  const used = access.limits.aiRequests.used;
  const limit = access.limits.aiRequests.limit;
  // Free plan is gated above by `isPro` — all free tiers carry a numeric
  // limit. Any plan with `limit === null` is unlimited and the badge
  // shouldn't render anyway (those users are Pro/Team → `isPro === true`).
  if (limit === null) return null;
  const remaining = Math.max(0, limit - used);
  const isLow = remaining <= 2;

  return (
    <View style={[styles.container, { backgroundColor: isLow ? 'rgba(239,68,68,0.1)' : 'rgba(124,58,237,0.1)' }]}>
      <Ionicons name="sparkles" size={14} color={isLow ? '#ef4444' : '#7c3aed'} />
      <Text style={[styles.text, { color: isLow ? '#ef4444' : colors.textSecondary }]}>
        {t('add_flow.ai_credits', 'AI credits: {{remaining}}/{{limit}}', { remaining, limit })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'center', marginTop: 8 },
  text: { fontSize: 13, fontWeight: '500' },
});
