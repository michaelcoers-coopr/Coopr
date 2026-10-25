import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { font, type } from '@coopr/tokens';
import { Glass } from './design/glass';
import { useReduceMotion } from './design/reduce-motion';
import { tick } from './haptics';
import type { DistanceProfile, MissMark } from '@coopr/engine';
import type { ShortShotCell } from '@coopr/engine';
import type { LandingResult } from './local-store';

const ASK_MIN = 96;

export interface AskContext {
  hole: number;
  gpsYards: number | null;
  headwindMph: number | null;
  elevationFeet: number | null;
  temperatureF: number | null;
  profiles: readonly DistanceProfile[];
  candidateClubIds?: readonly string[];
  wedges: readonly ShortShotCell[];
  marks: readonly MissMark[];
  club: RefObject<{
    clubId: string | null;
    clubLabel: string;
    carryToClearYards: number | null;
    carry: Pick<DistanceProfile, 'metric' | 'sampleSize' | 'p20' | 'p50' | 'p80'> & { dispersionKnown?: boolean } | null;
  }>;
  readScore: () => number | null;
  readPutts: () => number | null;
  readHole: () => number;
  onScore: (hole: number, strokes: number | null) => void;
  onPutts: (hole: number, count: number | null) => void;
  onNext: () => void;
  onBack: () => void;
  onMiss: (side: LandingResult, clubId: string | null, clubLabel: string) => string;
  onRemoveTag: (id: string) => void;
  /** Opens the on-device conversation. This button does not record or upload audio. */
  onAsk?: () => void;
  /** 56px round button for the right-hand rail. */
  rail?: boolean;
}

export function useAskCoopr(input: AskContext): { banner: ReactNode; button: ReactNode; undo: ReactNode } {
  const latest = useRef(input);
  latest.current = input;
  const reduce = useReduceMotion();
  const orb = useSharedValue(1);
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
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: orb.value * breathe.value }] }));

  const pressIn = () => {
    orb.value = withSpring(0.92, { damping: 14, stiffness: 240 });
    void tick();
    latest.current.onAsk?.();
  };

  const pressOut = () => {
    orb.value = withSpring(1, { damping: 14, stiffness: 220 });
  };

  const rail = input.rail === true;
  const button = (
    <Animated.View style={orbStyle}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ask COOPR" onPressIn={pressIn} onPressOut={pressOut} style={rail ? styles.askRailHit : styles.askHit}>
        <Glass radius={rail ? 28 : 48} intensity={84} style={rail ? styles.askRailHit : styles.ask} contentStyle={rail ? styles.askRailFill : styles.askFill}>
          <View style={rail ? styles.askRailMic : undefined}>
            <Mic />
          </View>
          <Text style={rail ? styles.askRailText : styles.askText}>{rail ? 'ASK' : 'Ask'}</Text>
        </Glass>
      </Pressable>
    </Animated.View>
  );

  return { banner: null, button, undo: null };
}

function Mic() {
  return (
    <View style={styles.mic}>
      <View style={styles.micHead} />
      <View style={styles.micArc} />
      <View style={styles.micStem} />
    </View>
  );
}

const styles = StyleSheet.create({
  askHit: { width: ASK_MIN, height: ASK_MIN },
  ask: { width: ASK_MIN, height: ASK_MIN },
  askFill: { width: ASK_MIN, height: ASK_MIN, alignItems: 'center', justifyContent: 'center', gap: 2 },
  askText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 20, fontWeight: '700' },
  askRailHit: { width: 56, height: 56 },
  askRailFill: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  askRailMic: { transform: [{ scale: 0.72 }] },
  askRailText: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  mic: { width: 28, height: 32, alignItems: 'center' },
  micHead: { width: 14, height: 20, borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF' },
  micArc: {
    width: 22,
    height: 12,
    marginTop: -8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#FFFFFF',
  },
  micStem: { width: 2, height: 8, backgroundColor: '#FFFFFF', marginTop: -1 },
});
