import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

export default function AITeaser() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const features = [
    {
      icon: 'copy-outline' as const,
      label: t('ai_teaser.feat_duplicates', 'Detect duplicate subscriptions'),
    },
    {
      icon: 'trending-down-outline' as const,
      label: t('ai_teaser.feat_savings', 'Find savings opportunities'),
    },
    {
      icon: 'mail-outline' as const,
      label: t('ai_teaser.feat_recommendations', 'Get personalized recommendations'),
    },
  ];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="sparkles" size={22} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('ai_teaser.title', 'AI Analysis')}
        </Text>
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t(
          'ai_teaser.description',
          'Let AI analyze your subscriptions and find ways to save money every month.',
        )}
      </Text>

      {/* Feature rows */}
      <View style={styles.featureList}>
        {features.map((item, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons name={item.icon} size={18} color={colors.primary} />
            <Text style={[styles.featureLabel, { color: colors.text }]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA button */}
      <TouchableOpacity
        style={[styles.ctaButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/paywall' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-up-circle-outline" size={18} color="#FFF" />
        <Text style={styles.ctaText}>
          {t('ai_teaser.cta', 'Upgrade to Pro')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  featureList: {
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
