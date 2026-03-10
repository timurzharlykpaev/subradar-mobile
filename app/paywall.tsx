import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/constants';
import { useTheme } from '../src/theme';

const FEATURES = [
  'Unlimited subscriptions',
  '200 AI requests/month',
  'Advanced analytics',
  '+1 invite slot',
];

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '',
    popular: false,
    trialDays: 0,
    included: [true, false, false, false],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$2.99',
    period: '/mo',
    popular: true,
    trialDays: 7,
    included: [true, true, true, true],
  },
  {
    id: 'org',
    name: 'Organization',
    price: '$9.99',
    period: '/mo',
    popular: false,
    trialDays: 0,
    included: [true, true, true, true],
  },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selected, setSelected] = useState('pro');

  const handleStartTrial = () => {
    // TODO: integrate with billing API
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Unlock SubRadar Pro</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>7-day free trial, cancel anytime</Text>
        </View>

        {/* Plan cards */}
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }, isSelected && { borderColor: colors.primary, backgroundColor: colors.surface2 }]}
              onPress={() => setSelected(plan.id)}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                  {plan.trialDays > 0 && (
                    <Text style={styles.trialLabel}>{plan.trialDays}-day free trial</Text>
                  )}
                </View>
                <View style={styles.priceContainer}>
                  <Text style={[styles.planPrice, { color: colors.text }]}>{plan.price}</Text>
                  {plan.period ? (
                    <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>{plan.period}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.featureList}>
                {FEATURES.map((feature, idx) => {
                  const included = plan.included[idx];
                  return (
                    <View key={feature} style={styles.featureRow}>
                      <Ionicons
                        name={included ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={included ? COLORS.success : COLORS.textMuted}
                      />
                      <Text
                        style={[
                          styles.featureText,
                          { color: colors.text },
                          !included && { color: colors.textMuted },
                        ]}
                      >
                        {feature}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {isSelected && (
                <View style={styles.selectedIndicator}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* CTA Buttons */}
        <TouchableOpacity style={styles.trialBtn} onPress={handleStartTrial}>
          <Text style={styles.trialBtnText}>Start Free Trial</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.laterBtn, { borderColor: colors.border }]} onPress={() => router.back()}>
          <Text style={[styles.laterBtnText, { color: colors.textSecondary }]}>Maybe Later</Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Cancel anytime. No charge during trial.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  planCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface2,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -60 }],
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 4,
  },
  planName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  trialLabel: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  planPeriod: {
    fontSize: 13,
    color: COLORS.textSecondary,
    paddingBottom: 2,
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  featureTextDisabled: {
    color: COLORS.textMuted,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  trialBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  trialBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  laterBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  laterBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 16,
    paddingHorizontal: 32,
  },
});
