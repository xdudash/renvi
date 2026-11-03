import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
// One driver (JS) for every value on this view: native and JS animations cannot share one transform.
import { AccessibilityInfo, Animated, Easing, PanResponder, StyleSheet, Text, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/tokens';

export type SwipeCardHandle = {
  /** Animate the card off screen, then run the action (button presses use the same motion as a swipe). */
  fling: (dir: 'left' | 'right') => Promise<void>;
  /** Bring the card back to the centre (the action was cancelled or failed). */
  reset: () => void;
};

const THRESHOLD = 0.28; // share of the screen width that counts as a decision

/**
 * Draggable profile card: drag left to skip, right to send a spark. The card tilts with the finger and shows a
 * stamp; it springs back if released early. Taps (photo switching) still reach the content: the pan only takes over
 * after a clearly horizontal move. A new card enters with a short scale-and-fade.
 */
export const SwipeCard = forwardRef<SwipeCardHandle, {
  children: React.ReactNode;
  onSwipe: (dir: 'left' | 'right') => void;
  labels: { left: string; right: string };
  disabled?: boolean;
}>(function SwipeCard({ children, onSwipe, labels, disabled }, ref) {
  const { width } = useWindowDimensions();
  const x = useState(() => new Animated.Value(0))[0];
  const enter = useState(() => new Animated.Value(0))[0];
  const reduce = useRef(false);
  const decided = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduce.current = v; }).catch(() => {});
    Animated.spring(enter, { toValue: 1, useNativeDriver: false, friction: 7, tension: 70 }).start();
  }, [enter]);

  const out = (dir: 'left' | 'right') => new Promise<void>((resolve) => {
    Animated.timing(x, {
      toValue: (dir === 'right' ? 1 : -1) * width * 1.4,
      duration: reduce.current ? 0 : 230,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(() => resolve());
  });
  const back = () => Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 6, tension: 80 }).start();

  useImperativeHandle(ref, () => ({
    fling: async (dir) => { decided.current = true; await out(dir); },
    reset: () => { decided.current = false; back(); },
  }));

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !disabled && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
    onMoveShouldSetPanResponderCapture: (_, g) => !disabled && Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderMove: Animated.event([null, { dx: x }], { useNativeDriver: false }),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, g) => {
      const far = Math.abs(g.dx) > width * THRESHOLD || Math.abs(g.vx) > 0.9;
      if (!far || decided.current) { back(); return; }
      const dir = g.dx > 0 ? 'right' : 'left';
      decided.current = true;
      Haptics.impactAsync(dir === 'right' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      out(dir).then(() => onSwipe(dir));
    },
    onPanResponderTerminate: back,
  }), [disabled, width, onSwipe]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotate = x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-12deg', '0deg', '12deg'] });
  const likeOpacity = x.interpolate({ inputRange: [0, width * THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = x.interpolate({ inputRange: [-width * THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[s.card, { opacity: enter, transform: [{ translateX: x }, { rotate }, { scale }] }]}
    >
      {children}
      <Animated.View pointerEvents="none" style={[s.stamp, s.stampRight, { opacity: likeOpacity }]}>
        <Text style={[s.stampText, { color: colors.red }]}>{labels.right}</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[s.stamp, s.stampLeft, { opacity: nopeOpacity }]}>
        <Text style={[s.stampText, { color: colors.ink }]}>{labels.left}</Text>
      </Animated.View>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  card: { flex: 1 },
  stamp: { position: 'absolute', top: 36, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.88)' },
  stampRight: { left: 18, borderColor: colors.red, transform: [{ rotate: '-12deg' }] },
  stampLeft: { right: 18, borderColor: colors.ink, transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
});
