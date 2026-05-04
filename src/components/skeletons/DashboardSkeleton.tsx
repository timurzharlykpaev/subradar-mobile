import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Skeleton, SkeletonCard } from './Skeleton';

/**
 * DashboardSkeleton — laid out to match `app/(tabs)/index.tsx` so the
 * cross-fade from skeleton → real content lands every block on roughly
 * the same pixel.
 *
 * Layout (top → bottom):
 *   1. plan badge pill (top-right)
 *   2. AI insight card (only if user is Pro — we assume yes for the
 *      skeleton; if not, the real layout collapses cleanly)
 *   3. Hero spend card (big amount + delta)
 *   4. Forecast snapshot row (3 tiny tiles)
 *   5. Upcoming charges (3 list rows)
 *   6. Trials ending soon (1 row)
 *   7. Category chart placeholder
 *   8. Recent subscriptions (3 list rows)
 */
export function DashboardSkeleton() {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* 1. Plan badge */}
        <View style={styles.badgeRow}>
          <Skeleton width={70} height={22} borderRadius={11} />
        </View>

        {/* 2. AI insight card */}
        <SkeletonCard style={{ marginHorizontal: 20, marginTop: 8 }}>
          <View style={styles.insightRow}>
            <Skeleton width={40} height={40} borderRadius={10} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton height={13} width="80%" />
              <Skeleton height={11} width="50%" />
            </View>
          </View>
        </SkeletonCard>

        {/* 3. Hero spend card */}
        <SkeletonCard style={{ marginHorizontal: 20, marginTop: 12, padding: 20 }}>
          <Skeleton height={12} width={100} />
          <View style={styles.heroAmountRow}>
            <Skeleton height={42} width="58%" borderRadius={8} />
            <Skeleton height={22} width={56} borderRadius={11} />
          </View>
          <Skeleton height={12} width="40%" style={{ marginTop: 6 }} />
        </SkeletonCard>

        {/* 4. Forecast 3-tile row */}
        <View style={styles.forecastRow}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} style={{ flex: 1, padding: 14 }}>
              <Skeleton height={11} width="60%" />
              <Skeleton height={20} width="80%" style={{ marginTop: 8 }} />
            </SkeletonCard>
          ))}
        </View>

        {/* 5. Upcoming section heading + 3 rows */}
        <SectionHeading width={140} />
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <ListRow key={i} colors={colors} />
          ))}
        </View>

        {/* 6. Trials */}
        <SectionHeading width={120} />
        <View style={{ paddingHorizontal: 20 }}>
          <ListRow colors={colors} />
        </View>

        {/* 7. Category chart */}
        <SectionHeading width={170} />
        <SkeletonCard style={{ marginHorizontal: 20 }}>
          <Skeleton height={140} borderRadius={10} />
          <View style={styles.legendRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.legendItem}>
                <Skeleton width={8} height={8} borderRadius={4} />
                <Skeleton width={60} height={10} />
              </View>
            ))}
          </View>
        </SkeletonCard>

        {/* 8. Recent subscriptions */}
        <SectionHeading width={150} />
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <ListRow key={i} colors={colors} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeading({ width }: { width: number }) {
  return (
    <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }}>
      <Skeleton height={14} width={width} />
    </View>
  );
}

function ListRow({ colors }: { colors: any }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <Skeleton width={36} height={36} borderRadius={10} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton height={13} width="55%" />
        <Skeleton height={10} width="35%" />
      </View>
      <Skeleton width={62} height={13} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  badgeRow: { paddingHorizontal: 20, paddingTop: 12, alignItems: 'flex-end' },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  forecastRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
