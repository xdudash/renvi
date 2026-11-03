import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

/** Fades and lifts its content in on mount; `delay` staggers items of a list. Respects "Reduce Motion". */
export function FadeIn({ children, delay = 0, from = 12, style }: { children: React.ReactNode; delay?: number; from?: number; style?: StyleProp<ViewStyle> }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (!alive) return;
      if (reduce) { v.setValue(1); return; }
      Animated.timing(v, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    return () => { alive = false; };
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** Springs its content in from a smaller size (the match screen's faces and spark). */
export function PopIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const t = setTimeout(() => Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 14 }).start(), delay);
    return () => clearTimeout(t);
  }, [v, delay]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return <Animated.View style={[style, { opacity: v, transform: [{ scale }] }]}>{children}</Animated.View>;
}
