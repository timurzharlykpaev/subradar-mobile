/**
 * PlansStage — shown when `/ai/wizard` returns multiple pricing tiers for
 * a single service (e.g. "Netflix Basic / Standard / Premium"). Lets the
 * user pick one tier and advance to the confirm screen.
 *
 * Why this exists:
 *   The `ui.kind === 'plans'` branch used to render inline as an IIFE
 *   inside `AIWizard.tsx`. Each row had an inline `onPress={() => ...}`
 *   arrow function that re-allocated on every render, so tapping any
 *   plan re-rendered every other plan too. Extracting into a memoized
 *   `PlanRow` with a stable `(plan, idx) => void` dispatcher means only
 *   the tapped row re-renders.
 *
 * Shape:
 *   - Header: service logo + name + "Choose plan" subtitle.
 *   - List: ScrollView of `PlanRow` cards.
 *   - Footer: "Enter manually" link that opens the manual add form
 *     pre-filled with the service metadata (no plan).
 *
 * Icon resolution is identical to `ConfirmStage` — parent passes the
 * matched SVG component via `QuickIcon` when the service name is in the
 * built-in catalogue.
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { PencilIcon } from '../icons';
import type { PlanOption } from './types';

interface Props {
  plans: PlanOption[];
  serviceName: string;
  iconUrl?: string;
  serviceUrl?: string;
  cancelUrl?: string;
  category?: string;
  /** Optional SVG icon from the QUICK catalogue. */
  QuickIcon?: React.ComponentType<{ size?: number }>;
  /** User picked a plan — parent advances UI to the confirm stage. */
  onSelectPlan: (plan: PlanOption) => void;
  /** User chose to skip the plan picker and enter details manually. */
  onEditManually: () => void;
}

interface PlanRowProps {
  plan: PlanOption;
  periodLabel: string;
  onPress: (plan: PlanOption) => void;
}

/**
 * Individual plan card. Memoized so tapping one plan doesn't re-render
 * the others (the parent ScrollView maps 2-4 rows typically, but this
 * also keeps `onPress` identity stable for React DevTools profiling).
 */
const PlanRow = React.memo(function PlanRow({ plan, periodLabel, onPress }: PlanRowProps) {
  const { colors, isDark } = useTheme();
  const card = isDark ? '#252538' : '#FFFFFF';

  const handlePress = useCallback(() => onPress(plan), [onPress, plan]);

  return (
    <TouchableOpacity
      style={[styles.planCard, { backgroundColor: card, borderColor: colors.border }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
        <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>{periodLabel}</Text>
      </View>
      <Text style={[styles.planPrice, { color: colors.primary }]}>
        {plan.currency} {plan.amount.toFixed(2)}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
});

function PlansStageImpl({
  plans,
  serviceName,
  iconUrl,
  QuickIcon,
  onSelectPlan,
  onEditManually,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const periodLabel = useCallback(
    (p: string) => {
      const map: Record<string, string> = {
        MONTHLY: t('billing.monthly', 'мес'),
        YEARLY: t('billing.yearly', 'год'),
        WEEKLY: t('billing.weekly', 'нед'),
        QUARTERLY: t('billing.quarterly', 'кварт'),
      };
      return map[p] ?? p.toLowerCase();
    },
    [t],
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {/* Service header */}
        <View style={styles.plansHeader}>
          {QuickIcon ? (
            <QuickIcon size={44} />
          ) : iconUrl ? (
            <Image source={{ uri: iconUrl }} style={styles.plansLogo} />
          ) : (
            <View
              style={[
                styles.fallbackIcon,
                { backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 11 },
              ]}
            >
              <Text style={[styles.fallbackLetter, { fontSize: 20 }]}>
                {(serviceName || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.plansTitle, { color: colors.text }]}>{serviceName}</Text>
        </View>
        <Text style={[styles.plansSubtitle, { color: colors.textSecondary }]}>
          {t('add.choose_plan', 'Выбери тариф')}
        </Text>

        {/* Plan cards */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {plans.map((plan, idx) => (
            <PlanRow
              key={idx}
              plan={plan}
              periodLabel={periodLabel(plan.billingPeriod)}
              onPress={onSelectPlan}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 14 }} onPress={onEditManually}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PencilIcon size={14} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
              {t('add.enter_manually', 'Ввести вручную')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const PlansStage = React.memo(PlansStageImpl);

const styles = StyleSheet.create({
  plansHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  plansLogo: { width: 44, height: 44, borderRadius: 11 },
  plansTitle: { fontSize: 24, fontWeight: '800' },
  plansSubtitle: { fontSize: 14, marginBottom: 12 },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  planName: { fontSize: 16, fontWeight: '700' },
  planPeriod: { fontSize: 13, marginTop: 2 },
  planPrice: { fontSize: 18, fontWeight: '800', marginRight: 8 },
  fallbackIcon: { alignItems: 'center', justifyContent: 'center' },
  fallbackLetter: { color: '#fff', fontWeight: '800' },
  footer: { paddingTop: 12 },
});
