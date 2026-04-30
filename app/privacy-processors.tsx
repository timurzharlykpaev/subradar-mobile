import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/theme';

/**
 * Public list of every third-party service that receives user data,
 * required to satisfy GDPR Art. 13 / CCPA disclosure. Linked from
 * Settings → Privacy → Data partners.
 *
 * Keep this in lockstep with what the backend actually integrates
 * with — auditors compare this screen to /api/v1/* outbound requests.
 */
type Processor = {
  id: string;
  name: string;
  /** Translation key suffix (e.g. 'revenuecat' → 'privacy.processors.revenuecat.purpose'). */
  i18n: string;
  region: string;
  privacyUrl: string;
  /** Lucide-style icon from Ionicons that visually fits the role. */
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const PROCESSORS: Processor[] = [
  {
    id: 'revenuecat',
    name: 'RevenueCat',
    i18n: 'revenuecat',
    region: 'United States',
    privacyUrl: 'https://www.revenuecat.com/privacy',
    icon: 'card-outline',
    color: '#FF6B6B',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    i18n: 'openai',
    region: 'United States',
    privacyUrl: 'https://openai.com/policies/privacy-policy',
    icon: 'sparkles-outline',
    color: '#10A37F',
  },
  {
    id: 'firebase',
    name: 'Firebase Cloud Messaging (Google)',
    i18n: 'firebase',
    region: 'United States',
    privacyUrl: 'https://firebase.google.com/support/privacy',
    icon: 'notifications-outline',
    color: '#FFCA28',
  },
  {
    id: 'resend',
    name: 'Resend',
    i18n: 'resend',
    region: 'United States / EU',
    privacyUrl: 'https://resend.com/legal/privacy-policy',
    icon: 'mail-outline',
    color: '#6366F1',
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    i18n: 'digitalocean',
    region: 'European Union (Frankfurt)',
    privacyUrl: 'https://www.digitalocean.com/legal/privacy-policy',
    icon: 'server-outline',
    color: '#0080FF',
  },
  {
    id: 'apple',
    name: 'Apple App Store',
    i18n: 'apple',
    region: 'United States / Worldwide',
    privacyUrl: 'https://www.apple.com/legal/privacy',
    icon: 'logo-apple',
    color: '#000000',
  },
  {
    id: 'google',
    name: 'Google Play (Identity / Sign-in)',
    i18n: 'google',
    region: 'United States / Worldwide',
    privacyUrl: 'https://policies.google.com/privacy',
    icon: 'logo-google',
    color: '#4285F4',
  },
];

export default function PrivacyProcessorsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {t('privacy.processors.title', 'Data partners')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.intro}>
          <Text style={[styles.introTitle, { color: colors.text }]}>
            {t('privacy.processors.intro_title', 'Who we share data with')}
          </Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            {t(
              'privacy.processors.intro_text',
              'To run SubRadar AI we work with the trusted companies below. Each one only receives the minimum data needed for its role. You can review what each processor does and read their privacy policy.',
            )}
          </Text>
        </View>

        {/* Processors list */}
        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {PROCESSORS.map((p, i) => (
            <View
              key={p.id}
              style={[
                styles.row,
                i < PROCESSORS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: p.color + '18' }]}>
                <Ionicons name={p.icon} size={18} color={p.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={[styles.purpose, { color: colors.textSecondary }]}>
                  {t(`privacy.processors.${p.i18n}.purpose`)}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                  <Text style={[styles.meta, { color: colors.textMuted }]}>{p.region}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => Linking.openURL(p.privacyUrl).catch(() => {})}
                  style={styles.linkBtn}
                  hitSlop={{ top: 4, bottom: 4, left: 0, right: 8 }}
                >
                  <Text style={[styles.link, { color: colors.primary }]}>
                    {t('privacy.processors.read_policy', 'Privacy policy')}
                  </Text>
                  <Ionicons name="open-outline" size={12} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Rights footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerTitle, { color: colors.text }]}>
            {t('privacy.processors.rights_title', 'Your rights')}
          </Text>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {t(
              'privacy.processors.rights_text',
              'Under GDPR (EU) and CCPA (California) you have the right to access, export, or delete the data we hold about you. To exercise these rights contact support@subradar.ai or use Settings → Delete Account.',
            )}
          </Text>
          <TouchableOpacity
            style={[styles.contactBtn, { borderColor: colors.border }]}
            onPress={() => Linking.openURL('mailto:support@subradar.ai?subject=' + encodeURIComponent('Data privacy request')).catch(() => {})}
          >
            <Ionicons name="mail-outline" size={16} color={colors.primary} />
            <Text style={[styles.contactBtnText, { color: colors.primary }]}>
              support@subradar.ai
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  title: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },

  intro: { paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
  introTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  introText: { fontSize: 14, lineHeight: 20 },

  list: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  name: { fontSize: 15, fontWeight: '700' },
  purpose: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  meta: { fontSize: 11 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  link: { fontSize: 12, fontWeight: '600' },

  footer: {
    marginHorizontal: 20,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  footerTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  footerText: { fontSize: 12, lineHeight: 18, marginBottom: 14 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  contactBtnText: { fontSize: 14, fontWeight: '700' },
});
