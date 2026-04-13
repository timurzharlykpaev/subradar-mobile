import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../theme';
import { SafeLinearGradient } from './SafeLinearGradient';

interface Props {
  visible: boolean;
  monthlySpend: number;
  currency: string;
  onCreateTeam: () => void;
  onLater: () => void;
}

export function TeamUpsellModal({ visible, monthlySpend, currency, onCreateTeam, onLater }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const counterAnim = useRef(new Animated.Value(0)).current;
  const [counter, setCounter] = React.useState(0);

  const perPerson = Math.round((monthlySpend / 4) * 100) / 100;
  const yearlySavings = Math.round(monthlySpend * 12 * 0.75);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 18, useNativeDriver: true }),
      ]).start();

      counterAnim.setValue(0);
      Animated.timing(counterAnim, { toValue: monthlySpend, duration: 1200, useNativeDriver: false }).start();
      const id = counterAnim.addListener(({ value }) => setCounter(Math.round(value * 100) / 100));
      return () => counterAnim.removeListener(id);
    } else {
      opacityAnim.setValue(0);
      slideAnim.setValue(40);
    }
  }, [visible, monthlySpend]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onLater}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <TouchableOpacity style={styles.closeBtn} onPress={onLater}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.iconCircle, { backgroundColor: '#06B6D420' }]}>
              <Ionicons name="people" size={36} color="#06B6D4" />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              {t('team_upsell.modal_title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('team_upsell.modal_subtitle')}
            </Text>

            <View style={[styles.calcCard, { backgroundColor: isDark ? '#1A1A2E' : '#F0F4FF' }]}>
              <Text style={[styles.calcLabel, { color: colors.textMuted }]}>
                {t('team_upsell.current_spend_label')}
              </Text>
              <Text style={[styles.spendAmount, { color: colors.text }]}>
                {currency} {counter.toFixed(2)}/mo
              </Text>
              <View style={styles.divider} />
              <Text style={[styles.calcLabel, { color: colors.textMuted }]}>
                {t('team_upsell.per_person_label')}
              </Text>
              <Text style={[styles.perPersonAmount, { color: '#06B6D4' }]}>
                {currency} {perPerson.toFixed(2)}/mo
              </Text>
              <Text style={[styles.savingsBadge, { color: '#22C55E' }]}>
                {t('team_upsell.yearly_savings', { amount: `${currency} ${yearlySavings}` })}
              </Text>
            </View>

            <View style={styles.benefits}>
              {([
                { icon: 'people-circle', key: 'family' },
                { icon: 'search', key: 'no_dupes' },
                { icon: 'sparkles', key: 'ai' },
              ] as const).map((b) => (
                <View key={b.key} style={styles.benefitRow}>
                  <View style={[styles.benefitIcon, { backgroundColor: '#06B6D415' }]}>
                    <Ionicons name={b.icon as any} size={20} color="#06B6D4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.benefitTitle, { color: colors.text }]}>
                      {t(`team_upsell.benefit_${b.key}_title`)}
                    </Text>
                    <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                      {t(`team_upsell.benefit_${b.key}_desc`)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={[styles.priceHint, { color: colors.textMuted }]}>
              {t('team_upsell.price_hint')}
            </Text>

            <TouchableOpacity onPress={onCreateTeam} activeOpacity={0.85}>
              <SafeLinearGradient
                colors={['#06B6D4', '#0EA5E9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>{t('team_upsell.cta_create_team')}</Text>
              </SafeLinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onLater} style={styles.laterBtn}>
              <Text style={[styles.laterText, { color: colors.textMuted }]}>
                {t('team_upsell.cta_later')}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
              {t('team_upsell.disclaimer')}
            </Text>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingHorizontal: 20, maxHeight: '92%' },
  closeBtn: { position: 'absolute', top: 8, right: 12, padding: 8, zIndex: 10 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  title: { fontSize: 24, fontFamily: fonts.extraBold, textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: fonts.medium, textAlign: 'center', lineHeight: 20, marginBottom: 20, paddingHorizontal: 12 },
  calcCard: { borderRadius: 16, padding: 18, marginBottom: 18, alignItems: 'center' },
  calcLabel: { fontSize: 11, fontFamily: fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  spendAmount: { fontSize: 28, fontFamily: fonts.bold, marginBottom: 12 },
  divider: { width: 40, height: 2, backgroundColor: 'rgba(128,128,128,0.2)', marginVertical: 4, borderRadius: 1 },
  perPersonAmount: { fontSize: 32, fontFamily: fonts.extraBold, marginVertical: 4 },
  savingsBadge: { fontSize: 13, fontFamily: fonts.bold, marginTop: 6 },
  benefits: { gap: 12, marginBottom: 18 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  benefitTitle: { fontSize: 14, fontFamily: fonts.semiBold },
  benefitDesc: { fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  priceHint: { fontSize: 12, fontFamily: fonts.medium, textAlign: 'center', marginBottom: 12 },
  cta: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowColor: '#06B6D4', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  ctaText: { fontSize: 16, fontFamily: fonts.bold, color: '#FFF', letterSpacing: 0.2 },
  laterBtn: { alignItems: 'center', paddingVertical: 14 },
  laterText: { fontSize: 14, fontFamily: fonts.semiBold, opacity: 0.6 },
  disclaimer: { fontSize: 11, fontFamily: fonts.regular, textAlign: 'center', opacity: 0.5 },
});
