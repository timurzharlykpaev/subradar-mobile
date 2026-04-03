import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import type { Recommendation, RecommendationPriority, RecommendationType } from '../types';

interface Props {
  recommendation: Recommendation;
  currency: string;
}

function getTypeIcon(type: RecommendationType): React.ComponentProps<typeof Ionicons>['name'] {
  switch (type) {
    case 'CANCEL':
      return 'close-circle-outline';
    case 'DOWNGRADE':
      return 'arrow-down-circle-outline';
    case 'SWITCH_PLAN':
      return 'swap-horizontal-outline';
    case 'SWITCH_PROVIDER':
      return 'repeat-outline';
    case 'BUNDLE':
      return 'layers-outline';
    case 'LOW_USAGE':
      return 'eye-off-outline';
    default:
      return 'bulb-outline';
  }
}

function getPriorityColor(priority: RecommendationPriority, colors: { error: string; warning: string; success: string }) {
  switch (priority) {
    case 'HIGH':
      return colors.error;
    case 'MEDIUM':
      return colors.warning;
    case 'LOW':
      return colors.success;
  }
}

function getPriorityLabel(priority: RecommendationPriority, t: (key: string, fallback: string) => string): string {
  switch (priority) {
    case 'HIGH':
      return t('priority.high', 'HIGH');
    case 'MEDIUM':
      return t('priority.medium', 'MEDIUM');
    case 'LOW':
      return t('priority.low', 'LOW');
  }
}

export default function AIRecommendationCard({ recommendation, currency }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const priorityColor = getPriorityColor(recommendation.priority, colors);
  const priorityLabel = getPriorityLabel(recommendation.priority, t);
  const typeIcon = getTypeIcon(recommendation.type);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: priorityColor,
        },
      ]}
    >
      {/* Title row */}
      <View style={styles.titleRow}>
        <Ionicons name={typeIcon} size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {recommendation.title}
        </Text>
      </View>

      {/* Description */}
      <Text
        style={[styles.description, { color: colors.textSecondary }]}
        numberOfLines={3}
      >
        {recommendation.description}
      </Text>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '22' }]}>
          <Text style={[styles.priorityText, { color: priorityColor }]}>{priorityLabel}</Text>
        </View>
        {recommendation.estimatedSavingsMonthly > 0 && (
          <Text style={[styles.savings, { color: colors.success }]}>
            {`-${recommendation.estimatedSavingsMonthly.toFixed(2)} ${currency}/mo`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priorityBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  savings: {
    fontSize: 13,
    fontWeight: '700',
  },
});
