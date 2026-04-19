import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../theme';
import { analytics } from '../services/analytics';

interface Props {
  payload: Record<string, unknown>;
}

export function GraceBanner({ payload }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const daysLeft = typeof payload.daysLeft === 'number' ? payload.daysLeft : 0;
  const reason: 'team_expired' | 'pro_expired' =
    payload.reason === 'team_expired' ? 'team_expired' : 'pro_expired';

  useEffect(() => {
    analytics.track('banner_shown', { priority: 'grace', daysLeft, reason });
  }, [daysLeft, reason]);

  const titleKey = reason === 'team_expired' ? 'team_logic.grace_member_banner_title' : 'team_logic.grace_pro_banner_title';
  const descKey = reason === 'team_expired' ? 'team_logic.grace_member_banner_desc' : 'team_logic.grace_pro_banner_desc';
  const ctaKey = reason === 'team_expired' ? 'team_logic.grace_member_cta' : 'team_logic.grace_pro_cta';

  return (
    <TouchableOpacity
      testID="grace-banner"
      style={[styles.banner, { backgroundColor: '#FBBF2415', borderColor: '#FBBF2440' }]}
      onPress={() => {
        analytics.track('banner_action_tapped', { priority: 'grace', daysLeft, reason });
        analytics.track('grace_ending_warning_shown');
        router.push('/paywall' as any);
      }}
      activeOpacity={0.85}
    >
      <Ionicons name="time" size={20} color="#F59E0B" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>{t(titleKey)}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{t(descKey, { days: daysLeft })}</Text>
      </View>
      <Text style={[styles.cta, { color: '#F59E0B' }]}>{t(ctaKey)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  title: { fontSize: 13, fontFamily: fonts.semiBold },
  desc: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  cta: { fontSize: 12, fontFamily: fonts.bold, paddingHorizontal: 4 },
});
