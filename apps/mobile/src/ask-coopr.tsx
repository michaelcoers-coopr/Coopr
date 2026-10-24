import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import { font, play as field, type } from '@coopr/tokens';
import { Glass } from './design/glass';
import { useReduceMotion } from './design/reduce-motion';
import { tick } from './haptics';
import {
  answerAsk,
  cycleAskChip,
  parseAsk,
  type AskAnswer,
  type AskIntent,
  type DistanceProfile,
  type MissMark,
} from '@coopr/engine';
import type { ShortShotCell } from '@coopr/engine';
import type { LandingResult } from './local-store';
import { audioUriToBase64, requestTranscript } from './voice-client';

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
  /** When set, the mic opens the live conversation instead of the one-shot recorder. */
  onAsk?: () => void;
  /** 56px round button for the right-hand rail. */
  rail?: boolean;
}

interface Heard {
  intent: AskIntent;
  answer: AskAnswer;
  sample: boolean;
}

interface Undo {
  label: string;
  run: () => void;
}

function deskTranscript(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem('coopr.voice.sim');
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function useAskCoopr(input: AskContext): { banner: ReactNode; button: ReactNode; undo: ReactNode } {
  const latest = useRef(input);
  latest.current = input;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const holding = useRef(false);
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
  const [phase, setPhase] = useState<'idle' | 'listening' | 'answer'>('idle');
  const [heard, setHeard] = useState<Heard | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);

  const speak = (line: string) => {
    try {
      Speech.stop();
      Speech.speak(line, { language: 'en-US', rate: 1.02 });
    } catch {
      /* Expo Go web can lack a voice. The line is still on screen. */
    }
  };

  const apply = (intent: AskIntent, line: string) => {
    const command = intent.command;
    if (!command) {
      setUndo(null);
      return;
    }
    const ctx = latest.current;
    const hole = ctx.readHole();
    if (command.kind === 'score') {
      const previous = ctx.readScore();
      ctx.onScore(hole, command.strokes);
      setUndo({ label: line, run: () => ctx.onScore(hole, previous) });
      return;
    }
    if (command.kind === 'putts') {
      const previous = ctx.readPutts();
      ctx.onPutts(hole, command.putts);
      setUndo({ label: line, run: () => ctx.onPutts(hole, previous) });
      return;
    }
    if (command.kind === 'next') {
      const previous = hole;
      ctx.onNext();
      setUndo({ label: line, run: () => ctx.onBack() });
      void previous;
      return;
    }
    const club = ctx.club.current;
    const id = ctx.onMiss(command.side, club?.clubId ?? null, club?.clubLabel ?? 'Shot');
    setUndo({ label: line, run: () => ctx.onRemoveTag(id) });
  };

  const show = async (transcript: string, sample: boolean) => {
    const intent = await parseAsk(transcript);
    const ctx = latest.current;
    const answer = answerAsk({
      intent,
      gpsYards: ctx.gpsYards,
      headwindMph: ctx.headwindMph,
      elevationFeet: ctx.elevationFeet,
      temperatureF: ctx.temperatureF,
      profiles: ctx.profiles,
      candidateClubIds: ctx.candidateClubIds,
      wedges: ctx.wedges,
      marks: ctx.marks,
      carryToClearYards: ctx.club.current?.carryToClearYards ?? null,
      carry: ctx.club.current?.carry ?? null,
    });
    setHeard({ intent, answer, sample });
    setPhase('answer');
    setTrouble(null);
    apply(intent, answer.line);
    speak(answer.line);
  };

  const pressIn = () => {
    if (latest.current.onAsk) {
      void tick();
      latest.current.onAsk();
      return;
    }
    holding.current = true;
    orb.value = withSpring(0.92, { damping: 14, stiffness: 240 });
    void tick();
    setPhase('listening');
    setTrouble(null);
    if (deskTranscript()) return;
    void (async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!holding.current) return;
        if (!permission.granted) {
          setTrouble('The microphone stayed off.');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (!holding.current) return;
        recorder.record();
      } catch {
        if (holding.current) setTrouble('This phone did not start a recording.');
      }
    })();
  };

  const pressOut = () => {
    orb.value = withSpring(1, { damping: 14, stiffness: 220 });
    if (!holding.current) return;
    holding.current = false;
    const sim = deskTranscript();
    if (sim) {
      void show(sim, false);
      return;
    }
    void (async () => {
      try {
        await recorder.stop();
      } catch {
        /* A tap with no start still ends quietly. */
      }
      const uri = recorder.uri;
      if (!uri) {
        setPhase(heard ? 'answer' : 'idle');
        setTrouble('Nothing was recorded.');
        return;
      }
      try {
        const audioBase64 = await audioUriToBase64(uri);
        const result = await requestTranscript({ audioBase64, mediaType: 'audio/m4a' });
        if ('error' in result) {
          setPhase(heard ? 'answer' : 'idle');
          setTrouble(result.error);
          return;
        }
        await show(result.transcript, result.mode === 'sample');
      } catch {
        setPhase(heard ? 'answer' : 'idle');
        setTrouble('The recording could not be read. Nothing was invented.');
      }
    })();
  };

  const correct = (chipId: string, direction: 1 | -1) => {
    if (!heard) return;
    const intent = cycleAskChip(heard.intent, chipId, direction);
    const ctx = latest.current;
    const answer = answerAsk({
      intent,
      gpsYards: ctx.gpsYards,
      headwindMph: ctx.headwindMph,
      elevationFeet: ctx.elevationFeet,
      temperatureF: ctx.temperatureF,
      profiles: ctx.profiles,
      candidateClubIds: ctx.candidateClubIds,
      wedges: ctx.wedges,
      marks: ctx.marks,
      carryToClearYards: ctx.club.current?.carryToClearYards ?? null,
      carry: ctx.club.current?.carry ?? null,
    });
    setHeard({ ...heard, intent, answer });
    speak(answer.line);
  };

  const banner =
    phase === 'idle' && !trouble ? null : (
    <View>
      {phase === 'listening' ? <Text style={styles.listening}>Listening</Text> : null}
      {phase === 'answer' && heard ? (
        <View style={styles.answerBlock}>
          <Text style={styles.answer}>{heard.answer.line}</Text>
          {heard.sample ? <Text style={styles.sample}>Sample transcript. The recording was not heard.</Text> : null}
          {heard.answer.chips.length > 0 ? (
            <View style={styles.chips}>
              {heard.answer.chips.map((chip) =>
                chip.id === 'distance' ? (
                  <View key={chip.id} style={styles.chip}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Distance minus" onPress={() => correct('distance', -1)} style={styles.chipHit}>
                      <Text style={styles.chipText}>−</Text>
                    </Pressable>
                    <Text style={styles.chipText}>{chip.label}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Distance plus" onPress={() => correct('distance', 1)} style={styles.chipHit}>
                      <Text style={styles.chipText}>+</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    key={chip.id}
                    accessibilityRole="button"
                    accessibilityLabel={chip.id === 'lie' ? `Lie ${chip.label}` : `Hazard ${chip.label}`}
                    onPress={() => correct(chip.id, 1)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{chip.label}</Text>
                  </Pressable>
                ),
              )}
            </View>
          ) : null}
        </View>
      ) : null}
      {trouble ? <Text style={styles.sample}>{trouble}</Text> : null}
    </View>
    );

  const rail = input.rail === true;
  const button = (
    <Animated.View style={orbStyle}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ask COOPR" onPressIn={pressIn} onPressOut={pressOut} style={rail ? styles.askRailHit : styles.askHit}>
        <Glass
          radius={rail ? 28 : 48}
          intensity={84}
          overlay={phase === 'listening' ? 'rgba(200,16,46,0.92)' : undefined}
          style={rail ? styles.askRailHit : styles.ask}
          contentStyle={rail ? styles.askRailFill : styles.askFill}
        >
          <View style={rail ? styles.askRailMic : undefined}>
            <Mic />
          </View>
          <Text style={rail ? styles.askRailText : styles.askText}>{rail ? 'ASK' : 'Ask'}</Text>
        </Glass>
      </Pressable>
    </Animated.View>
  );

  const undoBar = undo ? (
    <View style={styles.undo}>
      <Text style={styles.undoText}>{undo.label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo"
        onPress={() => {
          undo.run();
          setUndo(null);
        }}
        style={styles.undoHit}
      >
        <Text style={styles.undoAction}>Undo</Text>
      </Pressable>
    </View>
  ) : null;

  return { banner, button, undo: undoBar };
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
  listening: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  answerBlock: { gap: 10 },
  answer: { color: field.ink, fontFamily: font.family, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  sample: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: field.line,
    backgroundColor: field.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipHit: { minWidth: 44, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: field.ink, fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
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
  undo: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(11,31,58,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    gap: 8,
  },
  undoText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '600', flex: 1 },
  undoHit: { minHeight: 56, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  undoAction: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
});
