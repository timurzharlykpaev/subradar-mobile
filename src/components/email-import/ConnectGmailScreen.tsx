import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useGmailAuth } from '../../hooks/useGmailAuth';
import { emailImportTelemetry } from '../../utils/emailImportTelemetry';

const PRIVACY_URL = 'https://subradar.ai/privacy';

export function ConnectGmailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const auth = useGmailAuth();
  const router = useRouter();

  useEffect(() => {
    emailImportTelemetry.consentViewed();
  }, []);

  const handleConnect = async () => {
    emailImportTelemetry.consentAccepted();
    emailImportTelemetry.oauthStarted();
    try {
      await auth.connect();
      emailImportTelemetry.oauthSuccess();
      router.replace('/email-import/scanning' as any);
    } catch (e: any) {
      const msg = e?.message ?? 'oauth_failed';
      if (msg === 'cancelled') {
        emailImportTelemetry.oauthCancelled('webview');
      } else if (msg === 'no_refresh_token') {
        emailImportTelemetry.oauthNoRefreshToken();
      } else {
        emailImportTelemetry.oauthFailed(msg);
      }
    }
  };

  const handleSkip = () => {
    emailImportTelemetry.consentSkipped();
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.iconCircle, { backgroundColor: '#EA4335' + '20' }]}>
          <Ionicons name="mail" size={28} color="#EA4335" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('emailImport.consent.title')}
        </Text>

        <Section
          title={t('emailImport.consent.willDo.heading')}
          items={[
            t('emailImport.consent.willDo.scan'),
            t('emailImport.consent.willDo.ai'),
            t('emailImport.consent.willDo.review'),
          ]}
          icon="checkmark-circle"
          iconColor="#10B981"
          colors={colors}
        />

        <Section
          title={t('emailImport.consent.willNot.heading')}
          items={[
            t('emailImport.consent.willNot.read'),
            t('emailImport.consent.willNot.store'),
            t('emailImport.consent.willNot.send'),
            t('emailImport.consent.willNot.share'),
          ]}
          icon="close-circle"
          iconColor="#EF4444"
          colors={colors}
        />

        <Section
          title={t('emailImport.consent.control.heading')}
          items={[
            t('emailImport.consent.control.disconnect'),
            t('emailImport.consent.control.wipe'),
            t('emailImport.consent.control.review'),
          ]}
          icon="shield-checkmark"
          iconColor="#3B82F6"
          colors={colors}
        />

        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontSize: 14 }}>
            {t('emailImport.consent.privacyLink')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleConnect}
          disabled={auth.isAuthenticating}
          style={[styles.cta, { backgroundColor: colors.primary, opacity: auth.isAuthenticating ? 0.7 : 1 }]}
        >
          {auth.isAuthenticating ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.ctaText}>{t('emailImport.consent.cta')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} style={styles.skip}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
            {t('emailImport.consent.skip')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

interface SectionProps {
  title: string;
  items: string[];
  icon: 'checkmark-circle' | 'close-circle' | 'shield-checkmark';
  iconColor: string;
  colors: any;
}

function Section({ title, items, icon, iconColor, colors }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      {items.map((item, idx) => (
        <View key={idx} style={styles.row}>
          <Ionicons name={icon} size={18} color={iconColor} style={{ marginTop: 2, marginRight: 10 }} />
          <Text style={[styles.itemText, { color: colors.text }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 160 },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  row: { flexDirection: 'row', marginBottom: 10 },
  itemText: { fontSize: 15, flex: 1, lineHeight: 22 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cta: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  skip: { paddingVertical: 14, alignItems: 'center' },
});
