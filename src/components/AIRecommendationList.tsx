import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import type { Recommendation } from '../types';
import AIRecommendationCard from './AIRecommendationCard';

interface Props {
  recommendations: Recommendation[];
  currency: string;
}

export default function AIRecommendationList({ recommendations, currency }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('analysis.recommendations_title', 'Recommendations')}
      </Text>
      {recommendations.map((rec, index) => (
        <AIRecommendationCard
          key={`${rec.subscriptionId}-${index}`}
          recommendation={rec}
          currency={currency}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
});
