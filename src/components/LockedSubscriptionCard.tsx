import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../theme';
import { analytics } from '../services/analytics';

interface Props {
  hiddenCount: number;
}

export function LockedSubscriptionCard({ hiddenCount }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const onPress = () => {
    analytics.track('locked_sub_tapped', { hidden_count: hiddenCount });
    Alert.alert(
      t('team_logic.locked_sub_alert_title'),
      t('team_logic.locked_sub_alert_msg', { count: hiddenCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Get Pro', onPress: () => router.push('/paywall' as any) },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
        <Ionicons name="lock-closed" size={20} color={colors.textMuted} />
      </View>
      <View style={styles.middle}>
        <Text style={[styles.name, { color: colors.textMuted }]}>••••••••</Text>
        <Text style={[styles.desc, { color: colors.textMuted }]}>••••</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.textMuted, opacity: 0.4 }]}>•••.••</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginHorizontal: 20, marginBottom: 10, borderRadius: 16, borderWidth: 1 },
  placeholder: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontFamily: fonts.semiBold, letterSpacing: 2 },
  desc: { fontSize: 12, fontFamily: fonts.regular },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontFamily: fonts.bold },
});
