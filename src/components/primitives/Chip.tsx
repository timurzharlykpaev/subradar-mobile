import React, { memo, useCallback } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface ChipProps {
  id: string;
  label: string;
  /** Icon should be referentially stable (defined once or wrapped in useMemo). Otherwise memo is defeated on every parent render. */
  icon?: React.ReactNode;
  active?: boolean;
  /** Stable callback — parent should wrap in useCallback. */
  onPress: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

function ChipImpl({ id, label, icon, active, onPress, style }: ChipProps) {
  const { colors } = useTheme();
  const handlePress = useCallback(() => onPress(id), [id, onPress]);
  return (
    <TouchableOpacity
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.primary : colors.surface2, borderColor: colors.border },
        style,
      ]}
      activeOpacity={0.7}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, { color: active ? '#FFF' : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const Chip = memo(ChipImpl);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  icon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
});
