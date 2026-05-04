import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { Skeleton, SkeletonCard } from './Skeleton';

/**
 * AnalyticsSkeleton — content-only (no SafeAreaView, no header) so the
 * caller can keep its real header rendered while the body skeletonizes.
 * The screen's own header has the icon + title visible immediately,
 * which is faster perceived load than blanking everything.
 */
export function AnalyticsSkeleton() {
  const { colors } = useTheme();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 80 }}
    >
      {/* Total monthly + yearly row */}
      <View style={styles.tileRow}>
        <SkeletonCard style={{ flex: 1, padding: 16 }}>
          <Skeleton height={11} width="60%" />
          <Skeleton height={28} width="75%" style={{ marginTop: 10 }} />
          <Skeleton height={10} width="45%" style={{ marginTop: 8 }} />
        </SkeletonCard>
        <SkeletonCard style={{ flex: 1, padding: 16 }}>
          <Skeleton height={11} width="60%" />
          <Skeleton height={28} width="75%" style={{ marginTop: 10 }} />
          <Skeleton height={10} width="45%" style={{ marginTop: 8 }} />
        </SkeletonCard>
      </View>

      {/* Trend chart */}
      <SkeletonCard style={{ marginHorizontal: 20, marginTop: 16, padding: 20 }}>
        <Skeleton height={14} width={150} />
        <Skeleton height={10} width={100} style={{ marginTop: 6 }} />
        <View style={styles.barChart}>
          {/* Hand-tuned heights for a credible bar-chart silhouette */}
          {[35, 50, 42, 65, 55, 80, 72, 60, 90, 70, 85, 95].map((h, i) => (
            <View key={i} style={styles.barColumn}>
              <Skeleton width="100%" height={h} borderRadius={4} />
            </View>
          ))}
        </View>
        <View style={styles.chartAxis}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={9} width={28} />
          ))}
        </View>
      </SkeletonCard>

      {/* Category breakdown */}
      <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }}>
        <Skeleton height={14} width={170} />
      </View>
      <SkeletonCard style={{ marginHorizontal: 20, paddingVertical: 8 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <CategoryRow key={i} isLast={i === 4} colors={colors} />
        ))}
      </SkeletonCard>

      {/* Most expensive */}
      <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }}>
        <Skeleton height={14} width={140} />
      </View>
      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
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
            <Skeleton width={32} height={32} borderRadius={8} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton height={13} width="55%" />
              <Skeleton height={10} width="35%" />
            </View>
            <Skeleton width={56} height={13} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function CategoryRow({ isLast, colors }: { isLast: boolean; colors: any }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        gap: 12,
      }}
    >
      <Skeleton width={28} height={28} borderRadius={8} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton height={12} width="40%" />
        <Skeleton height={6} width="80%" borderRadius={3} />
      </View>
      <Skeleton width={50} height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  tileRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 110,
    marginTop: 16,
  },
  barColumn: { flex: 1, justifyContent: 'flex-end' },
  chartAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
