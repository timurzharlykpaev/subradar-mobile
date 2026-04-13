import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../theme';

let RevenueCatUI: any = null;
try { RevenueCatUI = require('react-native-purchases-ui').default; } catch {}

export function BillingIssueBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const onUpdate = async () => {
    try { await RevenueCatUI?.presentCustomerCenter(); } catch {}
  };

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: '#EF444415', borderColor: '#EF444450' }]}
      onPress={onUpdate}
      activeOpacity={0.85}
    >
      <Ionicons name="card" size={20} color="#EF4444" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('team_logic.billing_issue_title', 'Payment failed')}
        </Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          {t('team_logic.billing_issue_desc', 'Update your payment method to keep Pro access')}
        </Text>
      </View>
      <Text style={[styles.cta, { color: '#EF4444' }]}>
        {t('team_logic.billing_issue_cta', 'Update')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 8, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  title: { fontSize: 13, fontFamily: fonts.semiBold },
  desc: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  cta: { fontSize: 12, fontFamily: fonts.bold, paddingHorizontal: 4 },
});
