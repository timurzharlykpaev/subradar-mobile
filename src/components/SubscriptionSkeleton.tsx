import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, Dimensions } from 'react-native';
import { useTheme } from '../theme';

/**
 * SubscriptionSkeleton — placeholder card shown while the subscriptions list
 * is loading for the first time. Uses a horizontally travelling shimmer
 * overlay to feel like a real loading state rather than a flat pulse.
 */
export function SubscriptionSkeleton() {
  const { colors, isDark } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.6)).current;
  const cardWidthRef = useRef(Dimensions.get('window').width - 40);

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    shimmerLoop.start();
    pulseLoop.start();
    return () => {
      shimmerLoop.stop();
      pulseLoop.stop();
    };
  }, [shimmer, pulse]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-cardWidthRef.current, cardWidthRef.current],
  });

  const shimmerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)';
  const block = { backgroundColor: colors.border };

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pulse },
      ]}
      onLayout={(e) => {
        cardWidthRef.current = e.nativeEvent.layout.width;
      }}
    >
      <View style={[styles.logo, block]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.bar, { width: '55%', height: 14 }, block]} />
        <View style={[styles.bar, { width: '35%', height: 11 }, block]} />
      </View>
      <View style={[styles.amount, block]} />

      {/* Travelling shimmer strip */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmer,
          {
            backgroundColor: shimmerColor,
            transform: [{ translateX }, { skewX: '-18deg' }],
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  logo: { width: 44, height: 44, borderRadius: 12 },
  bar: { borderRadius: 6 },
  amount: { width: 68, height: 18, borderRadius: 6 },
  shimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 90,
  },
});
