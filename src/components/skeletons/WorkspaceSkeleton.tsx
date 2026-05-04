import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { Skeleton } from './Skeleton';

/**
 * Member-list skeleton for the Workspace screen. Shows 3 rows by default
 * — feels populated, but not overwhelming. Real list grows from this.
 */
export function WorkspaceMembersSkeleton({ rows = 3 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.row,
            {
              borderBottomColor: colors.border,
              borderBottomWidth: i === rows - 1 ? 0 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton height={14} width="55%" />
            <Skeleton height={11} width="70%" />
          </View>
          <Skeleton width={56} height={22} borderRadius={11} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
