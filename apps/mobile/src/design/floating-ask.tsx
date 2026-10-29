import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, type } from '@coopr/tokens';
import { Glass } from './glass';
import { useReduceMotion } from './reduce-motion';

const SIZE = 72;

/** Ask on every screen except the hole, where the recorder already floats. */
export function FloatingAsk() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const breathe = useSharedValue(1);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(breathe);
      breathe.value = 1;
      return;
    }
    breathe.value = withRepeat(withTiming(1.06, { duration: 1800 }), -1, true);
    return () => cancelAnimation(breathe);
  }, [reduce, breathe]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));
  const root = segments[0];
  if (root == null || root === 'index' || root === 'play' || root === 'analysis' || root === 'games' || root === 'onboard' || root === 'rounds' || root === 'round' || root === 'recap' || root === 'course') return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="box-none" style={[styles.slot, { top: insets.top + 8 }, pulse]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ask COOPR" onPress={() => router.push('/play')} style={styles.hit}>
          <Glass radius={36} intensity={84} style={styles.orb} contentStyle={styles.fill}>
            <View style={styles.mic}>
              <View style={styles.micHead} />
              <View style={styles.micArc} />
              <View style={styles.micStem} />
            </View>
            <Text style={styles.label}>Ask</Text>
          </Glass>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', right: 12 },
  hit: { width: SIZE, height: SIZE, minWidth: 56, minHeight: 56 },
  orb: { width: SIZE, height: SIZE },
  fill: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', gap: 1 },
  label: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 20, fontWeight: '700' },
  mic: { width: 22, height: 26, alignItems: 'center' },
  micHead: { width: 12, height: 16, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF' },
  micArc: {
    width: 18,
    height: 10,
    marginTop: -6,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#FFFFFF',
  },
  micStem: { width: 2, height: 6, backgroundColor: '#FFFFFF', marginTop: -1 },
});
