import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATEGORIES } from '../constants';
import { CategoryIcon } from './icons';

interface Props {
  categoryId: string;
  size?: 'sm' | 'md';
}

export const CategoryBadge: React.FC<Props> = ({ categoryId, size = 'md' }) => {
  const cat = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: cat.color + '20' }, isSmall && styles.sm]}>
      <CategoryIcon category={cat.id} size={isSmall ? 12 : 14} />
      {!isSmall && (
        <Text style={[styles.label, { color: cat.color }]}>{cat.label}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  sm: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  label: { fontSize: 12, fontWeight: '600' },
});
