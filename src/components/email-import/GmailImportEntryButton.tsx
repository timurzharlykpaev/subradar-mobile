import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useEffectiveAccess } from '../../hooks/useEffectiveAccess';
import { isGmailOAuthConfigured } from '../../hooks/useGmailAuth';
import { emailImportTelemetry } from '../../utils/emailImportTelemetry';

interface Props {
  onProGate: (feature: string) => void;
  onPress?: () => void; // optional close-sheet callback before navigation
}

export function GmailImportEntryButton({ onProGate, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const access = useEffectiveAccess();

  // Hide the entry tile entirely until Phase-0 OAuth setup is done. Users
  // never see a non-functional "Import from Gmail" button.
  if (!isGmailOAuthConfigured()) return null;

  // Plan gating: gracefully handle null while billing loads — treat as Free.
  // (review C7 — useEffectiveAccess returns null while loading, isPro/isTeamOwner/isTeamMember.)
  const isPaid =
    !!access && (access.isPro || access.isTeamOwner || access.isTeamMember);

  const handlePress = () => {
    emailImportTelemetry.entryViewed('add_sheet');
    if (!isPaid) {
      emailImportTelemetry.paywallShown('add_sheet');
      onProGate('gmail_import');
      return;
    }
    onPress?.();
    router.push('/email-import/connect' as any);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[styles.card, { backgroundColor: colors.card }]}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="mail" size={22} color="#EA4335" />
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {t('emailImport.entry.title')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
        {t('emailImport.entry.subtitle')}
      </Text>
      {!isPaid && (
        <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.proBadgeText}>{t('emailImport.entry.proBadge')}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: 14,
    alignItems: 'flex-start',
    minHeight: 110,
    position: 'relative',
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EA433522',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  subtitle: { fontSize: 12, lineHeight: 16 },
  proBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});
