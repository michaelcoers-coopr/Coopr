import { useEffect, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { font, type } from '@coopr/tokens';
import { scoreCommit, scoreDrag, scoreGlance, scoreGlow } from './play-polish';
import { Glass } from './glass';
import { useDisplayFace } from './display-font';
import { tick } from '../haptics';

/**
 * One score control. Swipe up adds a stroke, swipe down takes one off, and a tap keeps the shown number.
 * Par or better fills the glass with a glow. An unconfirmed number stays still.
 */
export function CountChip({
  value,
  confirmed,
  par,
  floor,
  idleLabel,
  onWrite,
  minHeight = 88,
}: {
  value: number | null;
  confirmed: boolean;
  par: number | null;
  floor: number;
  idleLabel: string;
  onWrite: (next: number) => void;
  minHeight?: number;
}) {
  const display = useDisplayFace();
  const glance = scoreGlance(value, par, confirmed);
  const glow = scoreGlow(glance.motion);
  const hot = glance.motion === 'birdie';
  const scale = useSharedValue(1);
  const halo = useSharedValue(0);
  const latest = useRef({ value, floor, onWrite });
  latest.current = { value, floor, onWrite };

  useEffect(() => {
    if (!glance.motion) {
      halo.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(1, { duration: 160 });
      return;
    }
    scale.value = 0.86;
    scale.value = withSpring(1, { damping: 9, stiffness: 180 });
    halo.value = 0;
    halo.value = withTiming(1, { duration: 240 });
  }, [glance.motion, glance.name, value, halo, scale]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ring = useAnimatedStyle(() => ({
    opacity: halo.value,
    transform: [{ scale: 0.92 + halo.value * 0.12 }],
  }));

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderRelease: (_, gesture) => {
        const move = scoreDrag(gesture.dy, gesture.dx);
        const current = latest.current;
        if (!move || move === 'tap' || current.value == null) return;
        current.onWrite(scoreCommit(current.value, move, current.floor));
        void tick();
      },
    }),
  ).current;

  const caption = !confirmed ? idleLabel : glance.name ?? glance.versus ?? idleLabel;
  const spoken = value == null ? idleLabel : confirmed ? `${idleLabel} ${value}, ${caption}` : `${idleLabel} ${value}, not kept yet`;

  return (
    <Pressable
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={spoken}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
      onAccessibilityAction={(event) => {
        if (value == null) return;
        const action = event.nativeEvent.actionName;
        const move = action === 'increment' ? 'up' : action === 'decrement' ? 'down' : action === 'activate' ? 'tap' : null;
        if (!move) return;
        onWrite(scoreCommit(value, move, floor));
        void tick();
      }}
      onPress={() => {
        const current = latest.current;
        if (current.value == null) return;
        current.onWrite(scoreCommit(current.value, 'tap', current.floor));
        void tick();
      }}
      style={[styles.hit, { minHeight }]}
    >
      {glow ? <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: glow }, ring]} /> : null}
      <Glass
        radius={24}
        intensity={80}
        overlay={hot ? 'rgba(200,16,46,0.92)' : undefined}
        style={[styles.shell, { minHeight }]}
        contentStyle={[styles.fill, { minHeight }]}
      >
        <Animated.View style={[styles.fill, { minHeight }, pop]}>
          <Text style={[styles.value, { fontFamily: display }]}>{value == null ? '' : String(value)}</Text>
          <Text style={styles.caption}>{caption}</Text>
        </Animated.View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { minWidth: 96, minHeight: 88, justifyContent: 'center' },
  shell: { minWidth: 96, minHeight: 88 },
  fill: { minHeight: 88, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  halo: {
    position: 'absolute',
    left: -8,
    right: -8,
    top: -8,
    bottom: -8,
    borderRadius: 32,
  },
  value: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: font.bold,
    fontVariant: ['tabular-nums'],
  },
  caption: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 22, fontWeight: '700' },
});
