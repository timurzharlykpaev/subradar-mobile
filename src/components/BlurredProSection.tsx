import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface Props {
  isPro: boolean;
  onUpgrade: () => void;
  children: React.ReactNode;
}

export default function BlurredProSection({ isPro, onUpgrade, children }: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  if (isPro) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {/* Blurred content */}
      <View style={styles.contentWrapper}>
        {children}
      </View>

      {/* Overlay */}
      <View style={[
        styles.overlay,
        { backgroundColor: isDark ? 'rgba(15, 15, 25, 0.85)' : 'rgba(255, 255, 255, 0.85)' },
      ]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="lock-closed" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('retention.upgrade_to_pro', 'Upgrade to Pro')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('retention.unlock_feature', 'Unlock this feature with Pro')}
        </Text>
        <TouchableOpacity
          onPress={onUpgrade}
          style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name="diamond" size={16} color="#FFF" />
          <Text style={styles.upgradeBtnText}>
            {t('retention.upgrade_to_pro', 'Upgrade to Pro')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
  },
  contentWrapper: {
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  upgradeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
