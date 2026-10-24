import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { colors, font, signal } from '@coopr/tokens';
import { CONSOLATION, type ScoreStamp } from './play-polish';
import { useDisplayFace } from './display-font';

const BITS = [
  { left: '6%', delay: 0, color: '#C8102E', spin: '-18deg' },
  { left: '18%', delay: 40, color: '#8AC926', spin: '12deg' },
  { left: '30%', delay: 20, color: '#FFFFFF', spin: '-8deg' },
  { left: '44%', delay: 80, color: '#C8102E', spin: '16deg' },
  { left: '56%', delay: 10, color: '#8AC926', spin: '-14deg' },
  { left: '68%', delay: 60, color: '#FFFFFF', spin: '8deg' },
  { left: '80%', delay: 30, color: '#C8102E', spin: '-20deg' },
  { left: '90%', delay: 90, color: '#8AC926', spin: '10deg' },
  { left: '12%', delay: 70, color: '#FFFFFF', spin: '22deg' },
  { left: '74%', delay: 50, color: '#0B1F3A', spin: '-6deg' },
] as const;

function Bit({ left, delay, color, spin, go }: { left: string; delay: number; color: string; spin: string; go: boolean }) {
  const drop = useSharedValue(go ? 0 : 1);
  useEffect(() => {
    drop.value = go ? 0 : 1;
    if (!go) return;
    drop.value = withDelay(delay, withTiming(1, { duration: 900 }));
  }, [delay, drop, go]);
  const style = useAnimatedStyle(() => ({
    opacity: go ? 1 - drop.value * 0.15 : 0,
    transform: [{ translateY: -40 + drop.value * 280 }, { rotate: spin }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.bit, { left, backgroundColor: color }, style]} />;
}

/** Birdie stamp or the double-or-worse line. Reduce Motion shows the words and skips the burst. */
export function MomentOverlay({
  stamp,
  consolation,
  reduce,
  onDone,
}: {
  stamp: ScoreStamp | null;
  consolation: boolean;
  reduce: boolean;
  onDone: () => void;
}) {
  const face = useDisplayFace();
  const live = stamp != null || consolation;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(() => done.current(), reduce ? 1100 : 1600);
    return () => clearTimeout(timer);
  }, [consolation, live, reduce, stamp]);
  if (!live) return null;
  return (
    <View pointerEvents="none" style={styles.layer} accessibilityLiveRegion="polite">
      {stamp && !reduce ? BITS.map((bit) => <Bit key={`${bit.left}-${bit.delay}`} {...bit} go />) : null}
      {stamp ? (
        <View style={styles.stamp}>
          <Text style={[styles.stampText, { fontFamily: face }]}>{stamp}</Text>
        </View>
      ) : (
        <View style={styles.consolation}>
          <Text style={[styles.consolationText, { fontFamily: face }]}>{CONSOLATION}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bit: {
    position: 'absolute',
    top: '18%',
    width: 14,
    height: 22,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  stamp: {
    backgroundColor: colors.red,
    borderWidth: 4,
    borderColor: colors.white,
    paddingHorizontal: 22,
    paddingVertical: 8,
    transform: [{ rotate: '-8deg' }],
  },
  stampText: {
    color: colors.white,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  consolation: {
    backgroundColor: signal.go,
    borderWidth: 3,
    borderColor: colors.navy,
    paddingHorizontal: 18,
    paddingVertical: 10,
    transform: [{ rotate: '2deg' }],
    maxWidth: 300,
  },
  consolationText: {
    color: colors.navy,
    fontFamily: font.family,
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
  },
});
