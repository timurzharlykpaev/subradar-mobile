import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  ScrollView,
  StyleSheet,
  Switch,
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
import { useGmailScan, GmailScanError } from '../../hooks/useGmailScan';
import { useEmailImportStatus } from '../../hooks/useEmailImportStatus';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { emailImportTelemetry } from '../../utils/emailImportTelemetry';

export function ConnectedAccountsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const auth = useGmailAuth();
  const status = useEmailImportStatus();
  const { scan } = useGmailScan();
  const userId = useAuthStore((s) => s.user?.id);
  const autoScan = useSettingsStore((s) => s.emailImportAutoScan);
  const setAutoScan = useSettingsStore((s) => s.setEmailImportAutoScan);
  const windowDays = useSettingsStore((s) => s.emailImportWindowDays);
  const setWindowDays = useSettingsStore((s) => s.setEmailImportWindowDays);

  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);

  const forwardingAddress = userId ? `import+${userId}@subradar.ai` : '';

  const handleScanNow = async () => {
    setScanning(true);
    try {
      const r = await scan({ mode: 'shallow' });
      router.push({
        pathname: '/email-import/review' as any,
        params: { result: JSON.stringify(r) },
      });
    } catch (e: any) {
      if (e instanceof GmailScanError && e.code === 'pro_required') {
        router.push('/paywall' as any);
        return;
      }
      Alert.alert(t('common.error'), e?.message ?? 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      t('emailImport.settings.disconnectConfirm'),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('emailImport.settings.disconnect'),
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.disconnect();
              emailImportTelemetry.disconnected('user');
              status.refetch();
            } catch (e: any) {
              Alert.alert(t('common.error'), e?.message ?? 'Disconnect failed');
            }
          },
        },
      ],
    );
  };

  const handleCopy = () => {
    if (!forwardingAddress) return;
    Clipboard.setString(forwardingAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lastScanLabel = status.data?.lastScanAt
    ? t('emailImport.settings.lastScan', {
        when: new Date(status.data.lastScanAt).toLocaleDateString(),
      })
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('emailImport.settings.sectionTitle')}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Gmail card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#EA433522' }]}>
              <Ionicons name="mail" size={20} color="#EA4335" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {auth.isConnected
                  ? t('emailImport.settings.gmailConnected')
                  : t('emailImport.settings.gmailDisconnected')}
              </Text>
              {auth.isConnected && lastScanLabel && (
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  {lastScanLabel}
                </Text>
              )}
            </View>
          </View>

          {auth.isConnected ? (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {t('emailImport.settings.autoScanLabel')}
                  </Text>
                  <Text style={[styles.rowHelp, { color: colors.textSecondary }]}>
                    {t('emailImport.settings.autoScanHelp')}
                  </Text>
                </View>
                <Switch value={autoScan} onValueChange={setAutoScan} />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {t('emailImport.settings.windowLabel')}
                </Text>
                <View style={styles.windowPicker}>
                  {([90, 180, 365] as const).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setWindowDays(d)}
                      style={[
                        styles.windowOption,
                        {
                          backgroundColor: windowDays === d ? colors.primary : 'transparent',
                          borderColor: windowDays === d ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: windowDays === d ? '#FFF' : colors.text,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {d === 90
                          ? t('emailImport.settings.window90')
                          : d === 180
                            ? t('emailImport.settings.window180')
                            : t('emailImport.settings.window365')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleScanNow}
                disabled={scanning}
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: scanning ? 0.7 : 1 }]}
              >
                {scanning ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('emailImport.settings.scanNow')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleDisconnect} style={styles.dangerBtn}>
                <Text style={[styles.dangerBtnText, { color: '#EF4444' }]}>
                  {t('emailImport.settings.disconnect')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/email-import/connect' as any)}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
            >
              <Text style={styles.primaryBtnText}>
                {t('emailImport.settings.gmailDisconnected')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Forwarding card */}
        <Text style={[styles.fwdHeader, { color: colors.textSecondary }]}>
          {t('emailImport.forwarding.heading')}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.fwdBody, { color: colors.text }]}>
            {t('emailImport.forwarding.body')}
          </Text>
          <View style={[styles.addressBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={1}>
              {forwardingAddress}
            </Text>
            <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                {copied
                  ? t('emailImport.forwarding.copied')
                  : t('emailImport.forwarding.copyAddress')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowHelp: { fontSize: 12, marginTop: 2 },
  windowPicker: { flexDirection: 'row', gap: 6 },
  windowOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  dangerBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  dangerBtnText: { fontSize: 14, fontWeight: '600' },
  fwdHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  fwdBody: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addressText: { flex: 1, fontSize: 13, fontFamily: 'Menlo', marginRight: 8 },
  copyBtn: { paddingHorizontal: 6 },
});
