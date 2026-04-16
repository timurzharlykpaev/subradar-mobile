import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Subscription } from '../types';
import { STATUS_COLORS } from '../constants';
import { CardBadge } from './CardBadge';
import { useTheme, fonts } from '../theme';
import { GiftIcon } from './icons';
import { formatMoney } from '../utils/formatMoney';
import { resolveNextPaymentDate, daysUntil as daysUntilDate } from '../utils/nextPaymentDate';

interface Props {
  subscription: Subscription;
  onSwipeDelete?: () => void;
}

function daysUntilString(date?: string | null): number | null {
  return daysUntilDate(date ? new Date(date) : null);
}

const SubscriptionCardInner: React.FC<Props> = ({ subscription }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [iconError, setIconError] = React.useState(false);
  const statusColor = STATUS_COLORS[subscription.status] || colors.textSecondary;

  const isTrial = subscription.status === 'TRIAL';
  const trialDays = isTrial ? daysUntilString((subscription as any).trialEndDate) : null;
  const nextDate = resolveNextPaymentDate(subscription);
  const nextDateDays = daysUntilDate(nextDate);
  const trialUrgent = trialDays !== null && trialDays <= 3 && trialDays >= 0;
  const trialExpired = trialDays !== null && trialDays < 0;

  return (
    <TouchableOpacity
      testID={`subscription-card-${subscription.id}`}
      style={[styles.card, { backgroundColor: colors.surface }]}
      activeOpacity={0.85}
      onPress={() => router.push(`/subscription/${subscription.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={t('a11y.subscription', { name: subscription.name, defaultValue: `${subscription.name} subscription` })}
    >
      <View style={styles.left}>
        {subscription.iconUrl && !iconError ? (
          <Image
            source={{ uri: subscription.iconUrl }}
            style={styles.logo}
            onError={() => setIconError(true)}
          />
        ) : (
          <View style={[styles.logoPlaceholder, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.logoText, { color: colors.primary }]}>{subscription.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
      </View>

      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{subscription.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(`subscriptions.status_${subscription.status?.toLowerCase()}`, subscription.status)}
            </Text>
          </View>
        </View>

        {/* Subtitle shows category (was currentPlan — confusing UX: "Family" plan read as period). */}
        {subscription.category && (
          <Text style={[styles.plan, { color: colors.textSecondary }]} numberOfLines={1}>
            {t(`categories.${subscription.category.toLowerCase()}`, subscription.category)}
          </Text>
        )}

        <View style={styles.tagsRow}>
          {subscription.paymentCardId && <CardBadge cardId={subscription.paymentCardId} />}
          {subscription.tags?.filter(Boolean).map((tag) => (
            <View key={tag} style={[styles.tagBadge, { backgroundColor: colors.surface2 }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.right}>
        {(() => {
          const primaryAmount = subscription.displayAmount ?? String(subscription.amount);
          const primaryCurrency = subscription.displayCurrency ?? subscription.currency;
          const lang = i18n.language || 'en';
          return (
            <Text
              style={[styles.amount, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {formatMoney(primaryAmount, primaryCurrency, lang)}
            </Text>
          );
        })()}
        {subscription.billingPeriod && (
          <Text style={[styles.period, { color: colors.textSecondary }]} numberOfLines={1}>/{t(`period_short.${(subscription.billingPeriod || 'MONTHLY').toUpperCase()}`, subscription.billingPeriod)}</Text>
        )}
        {isTrial && trialDays !== null ? (
          <View style={[styles.trialBadge, {
            backgroundColor: trialExpired ? '#EF444420' : trialUrgent ? '#F59E0B20' : '#3B82F620',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
          }]}>
            {!trialExpired && trialDays !== 0 && (
              <GiftIcon size={10} color={trialUrgent ? '#F59E0B' : '#3B82F6'} />
            )}
            <Text style={[styles.trialBadgeText, {
              color: trialExpired ? '#EF4444' : trialUrgent ? '#F59E0B' : '#3B82F6',
            }]}>
              {trialExpired ? t('trials.expired') : trialDays === 0 ? t('trials.ends_today') : `${trialDays}d`}
            </Text>
          </View>
        ) : nextDate ? (
          <>
            <Text style={[styles.nextDate, { color: colors.primary }]}>
              {nextDate.toLocaleDateString(i18n.language || 'en', { month: 'short', day: 'numeric' })}
            </Text>
            {(() => {
              if (nextDateDays === null || nextDateDays < 0) return null;
              const isUrgent = nextDateDays <= 2;
              const isToday = nextDateDays === 0;
              return (
                <Text style={[styles.daysUntil, {
                  color: isToday ? '#EF4444' : isUrgent ? '#F59E0B' : colors.textMuted,
                  fontWeight: isToday || isUrgent ? '700' : '400',
                }]}>
                  {isToday ? t('upcoming.today') : nextDateDays === 1 ? t('upcoming.tomorrow') : t('upcoming.in_days', { count: nextDateDays })}
                </Text>
              );
            })()}
          </>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

export const SubscriptionCard = React.memo(SubscriptionCardInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  left: {},
  logo: { width: 44, height: 44, borderRadius: 12 },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 20, fontWeight: '700' },
  middle: { flex: 1, gap: 4, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 2, flexShrink: 0, maxWidth: 110 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', flex: 1, flexShrink: 1, fontFamily: fonts.semiBold },
  plan: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  amount: { fontSize: 15, fontWeight: '800', fontFamily: fonts.bold },
  amountOriginal: { fontSize: 10, marginTop: 1 },
  period: { fontSize: 11 },
  nextDate: { fontSize: 11, fontWeight: '600' },
  daysUntil: { fontSize: 9, marginTop: 1 },
  trialBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
  trialBadgeText: { fontSize: 10, fontWeight: '700' },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '600' },
});
