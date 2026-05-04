import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

/**
 * Skeleton primitive.
 *
 * One solid rectangle that pulses its opacity and is overlaid by a single
 * traveling shimmer strip. Both animations are module-level Animated.Values
 * so every Skeleton on screen pulses and shimmers in lockstep — that
 * synchrony is what makes the loading state feel like a single coherent
 * surface rather than a flickering grid of independent placeholders.
 *
 * Aesthetic principle: the shimmer is a slow GLIDE, not a flash. ~1500ms
 * per pass with eased timing reads as "calm" — appropriate for a finance
 * app where loading shouldn't feel anxious.
 */

const SCREEN_WIDTH = Dimensions.get('window').width;

// Single shared shimmer — every Skeleton instance subscribes to the same
// driver, so they all glide together. Started lazily on first mount; never
// stopped (cheap, native-driven).
const sharedShimmer = new Animated.Value(0);
const sharedPulse = new Animated.Value(0.55);
let started = false;

const ensureRunning = () => {
  if (started) return;
  started = true;
  Animated.loop(
    Animated.timing(sharedShimmer, {
      toValue: 1,
      duration: 1500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
  ).start();
  Animated.loop(
    Animated.sequence([
      Animated.timing(sharedPulse, {
        toValue: 1,
        duration: 950,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(sharedPulse, {
        toValue: 0.55,
        duration: 950,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]),
  ).start();
};

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
}

export function Skeleton({ width, height = 14, borderRadius = 6, style }: SkeletonProps) {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    ensureRunning();
  }, []);

  const widthRef = useRef(typeof width === 'number' ? width : SCREEN_WIDTH);

  const translateX = sharedShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-widthRef.current, widthRef.current],
  });
  const shimmerColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)';

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity: sharedPulse,
          overflow: 'hidden',
        },
        style as any,
      ]}
      onLayout={(e) => {
        if (typeof width !== 'number') {
          widthRef.current = e.nativeEvent.layout.width;
        }
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmer,
          { backgroundColor: shimmerColor, transform: [{ translateX }, { skewX: '-18deg' }] },
        ]}
      />
    </Animated.View>
  );
}

/**
 * Card-shaped wrapper around Skeleton blocks. Matches the visual chrome of
 * real content cards in the app (same border, radius, padding) so the
 * transition from skeleton → loaded card is seamless.
 */
export function SkeletonCard({
  children,
  height,
  style,
}: {
  children?: React.ReactNode;
  height?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 14,
          padding: 16,
          height,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shimmer: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: 0,
    width: 100,
  },
});
