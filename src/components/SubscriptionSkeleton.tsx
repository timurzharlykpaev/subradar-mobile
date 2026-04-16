import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

/**
 * SubscriptionSkeleton — placeholder card shown while the subscriptions list
 * is loading for the first time. Uses a subtle shimmer to signal activity
 * without the visual noise of a spinner.
 */
export function SubscriptionSkeleton() {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, opacity }]}>
      <View style={[styles.logo, { backgroundColor: colors.border }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.bar, { width: '60%', backgroundColor: colors.border }]} />
        <View style={[styles.bar, { width: '40%', backgroundColor: colors.border, height: 12 }]} />
      </View>
      <View style={[styles.amount, { backgroundColor: colors.border }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    gap: 12,
  },
  logo: { width: 44, height: 44, borderRadius: 12 },
  bar: { height: 14, borderRadius: 4 },
  amount: { width: 60, height: 18, borderRadius: 4 },
});
