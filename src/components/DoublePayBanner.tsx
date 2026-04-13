import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../theme';
import { analytics } from '../services/analytics';

let RevenueCatUI: any = null;
try { RevenueCatUI = require('react-native-purchases-ui').default; } catch {}

export function DoublePayBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const onCancel = async () => {
    analytics.track('double_pay_cancel_tapped');
    try { await RevenueCatUI?.presentCustomerCenter(); } catch {}
  };

  React.useEffect(() => {
    analytics.track('double_pay_banner_shown');
  }, []);

  return (
    <View style={[styles.banner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
      <Ionicons name="alert-circle" size={20} color="#F59E0B" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>{t('team_logic.double_pay_banner_title')}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{t('team_logic.double_pay_banner_desc')}</Text>
      </View>
      <TouchableOpacity onPress={onCancel} style={styles.cta}>
        <Text style={[styles.ctaText, { color: '#F59E0B' }]}>{t('team_logic.double_pay_cta')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  title: { fontSize: 13, fontFamily: fonts.semiBold },
  desc: { fontSize: 11, fontFamily: fonts.regular, marginTop: 2 },
  cta: { paddingHorizontal: 8 },
  ctaText: { fontSize: 12, fontFamily: fonts.bold },
});
