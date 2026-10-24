import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildTalkContext,
  createTalkMachine,
  talkTransition,
  type TalkAction,
  type TalkContextInput,
  type TalkMachine,
  type TalkTurn,
} from '@coopr/engine';
import { font, type } from '@coopr/tokens';
import { useDisplayFace } from './design/display-font';
import { BlurView } from 'expo-blur';
import { tick } from './haptics';
import { deviceSpeechAvailable, listenForSpeech, type HeardSpeech } from './speech/recognize';
import { caddieSpeaker, speakSentences } from './speech/tts';
import { requestTalk } from './talk-client';
import { useTalkPrefs } from './talk-prefs';

const BARS = [0.35, 0.62, 0.9, 0.48, 1, 0.7, 0.4, 0.82, 0.55];

export interface TalkHandlers {
  onScore: (hole: number, strokes: number | null) => void;
  onPutts: (hole: number, count: number | null) => void;
  onSetClub: (clubId: string) => void;
  onMiss: (side: 'left' | 'right' | 'short' | 'fairway' | 'hazard', clubId: string | null, clubLabel: string) => void;
  onNext: () => void;
}

export function YardageLine({ text }: { text: string }) {
  const face = useDisplayFace();
  const parts = text.split(/(\d+(?:\.\d+)?)/);
  return (
    <Text style={styles.reply}>
      {parts.map((part, index) =>
        /^\d/.test(part) ? (
          <Text key={index} style={[styles.yards, { fontFamily: face }]}>
            {part}
          </Text>
        ) : (
          <Text key={index}>{part}</Text>
        ),
      )}
    </Text>
  );
}

export function Waveform({ live, compact = false }: { live: boolean; compact?: boolean }) {
  return (
    <View style={styles.wave} accessibilityLabel={live ? 'Live waveform' : 'Waveform'}>
      {BARS.map((height, index) => (
        <View key={index} style={[styles.bar, { height: (compact ? 6 : 16) + height * (compact ? 18 : 52), opacity: live ? 0.95 : 0.35 }]} />
      ))}
    </View>
  );
}

export function useTalkCaddie(input: TalkContextInput & TalkHandlers & { surface?: 'overlay' | 'sheet' }): {
  overlay: ReactNode;
  open: () => void;
  close: () => void;
  phase: TalkMachine['phase'];
  transcript: string;
  reply: string;
  sample: boolean;
  typed: boolean;
  draft: string;
  setDraft: (value: string) => void;
  askKind: 'typed' | 'voice' | null;
  ask: (text: string, kind?: 'typed' | 'voice') => Promise<void>;
} {
  const latest = useRef(input);
  latest.current = input;
  const prefs = useTalkPrefs();
  const machine = useRef(createTalkMachine(false));
  const gate = useRef({ stopped: false });
  const ear = useRef<HeardSpeech | null>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<TalkMachine['phase']>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [sample, setSample] = useState(false);
  const [typed, setTyped] = useState(true);
  const [draft, setDraft] = useState('');
  const [askKind, setAskKind] = useState<'typed' | 'voice' | null>(null);
  const turns = useRef<TalkTurn[]>([]);
  const preview = useRef(false);
  const speaker = useRef(caddieSpeaker('device'));

  const apply = (actions: TalkAction[]) => {
    const ctx = latest.current;
    for (const action of actions) {
      if (action.tool === 'log_score') {
        if (action.strokes != null) ctx.onScore(ctx.hole, action.strokes);
        if (action.putts != null) ctx.onPutts(ctx.hole, action.putts);
      } else if (action.tool === 'set_club' && action.clubId) {
        ctx.onSetClub(action.clubId);
      } else if (action.tool === 'mark_shot' && action.miss) {
        ctx.onMiss(action.miss, ctx.selectedClubId ?? null, ctx.selectedClubLabel ?? 'Shot');
      } else if (action.tool === 'next_hole') {
        ctx.onNext();
      }
    }
  };

  const stopEar = () => {
    ear.current?.stop();
    ear.current = null;
  };

  const move = (event: 'listen' | 'think' | 'speak' | 'finish' | 'barge' | 'close') => {
    machine.current = { ...machine.current, handsFree: prefs.handsFree };
    const next = talkTransition(machine.current, event);
    machine.current = next;
    setPhase(next.phase);
    if (next.stopSpeech) {
      gate.current.stopped = true;
      speaker.current.stop();
    }
    return next;
  };

  const ask = async (text: string, kind: 'typed' | 'voice' = 'voice') => {
    const spoken = text.trim();
    if (!spoken) return;
    setAskKind(kind);
    stopEar();
    gate.current = { stopped: false };
    move('think');
    setTranscript(spoken);
    setReply('');
    const context = buildTalkContext({ ...latest.current, turns: turns.current });
    const result = await requestTalk(spoken, context);
    if (gate.current.stopped) return;
    setSample(result.mode === 'sample');
    const nextTurns: TalkTurn[] = [...turns.current, { role: 'player', text: spoken }, { role: 'caddie', text: result.line }];
    turns.current = nextTurns.slice(-6);
    apply(result.tools.flatMap((tool) => (tool.action ? [tool.action] : [])));
    move('speak');
    const saying = speakSentences(speaker.current, result.sentences, gate.current);
    let shown = '';
    for (const sentence of result.sentences) {
      if (gate.current.stopped) break;
      shown = shown ? `${shown} ${sentence}` : sentence;
      setReply(shown);
      void tick();
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    await saying;
    if (gate.current.stopped) return;
    const done = move('finish');
    if (done.phase === 'listening') void startEar();
  };

  const startEar = async () => {
    stopEar();
    const heard = await listenForSpeech((text, final) => {
      if (!text) return;
      setTranscript(text);
      if (final) void ask(text, 'voice');
    });
    ear.current = heard;
    setTyped(heard == null);
    if (heard == null) setPhase(machine.current.phase);
  };

  const closeTalk = () => {
    move('close');
    gate.current.stopped = true;
    speaker.current.stop();
    stopEar();
    setOpen(false);
  };

  const openTalk = () => {
    const next = move(machine.current.phase === 'speaking' ? 'barge' : 'listen');
    if (next.stopSpeech) gate.current.stopped = true;
    setOpen(true);
    setReply('');
    void tick();
    void deviceSpeechAvailable().then((ready) => {
      setTyped(!ready);
      if (ready && machine.current.phase === 'listening') void startEar();
    });
  };

  useEffect(() => {
    if (preview.current || input.hole < 1) return;
    if (input.gpsYards == null || input.gpsYards <= 0) return;
    if (typeof localStorage === 'undefined' || localStorage.getItem('coopr.talk.open') !== '1') return;
    preview.current = true;
    const sim = localStorage.getItem('coopr.voice.sim')?.trim() || 'What should I hit?';
    setOpen(true);
    setTranscript(sim);
    setTyped(true);
    move('listen');
    void ask(sim, 'typed');
    // The preview sentence is a desk check. It runs once a real distance is on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.hole, input.gpsYards]);

  useEffect(() => () => stopEar(), []);

  const insets = useSafeAreaInsets();
  const live = phase === 'listening' || phase === 'speaking';
  const overlay = input.surface === 'sheet' || !open ? null : (
    <View style={styles.bleed} accessibilityViewIsModal>
      <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.shade} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.panel, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close caddie"
            onPress={closeTalk}
            style={styles.close}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={prefs.handsFree ? 'Hands-free on' : 'Hands-free off'}
            onPress={() => prefs.setHandsFree(!prefs.handsFree)}
            style={styles.close}
          >
            <Text style={styles.closeText}>{prefs.handsFree ? 'Hands-free' : 'Hold to talk'}</Text>
          </Pressable>
        </View>
        {sample ? <Text style={styles.sample}>Sample mode. No live model on this server.</Text> : null}
        <Waveform live={live} />
        <Text style={styles.kicker}>{phase === 'listening' ? 'Listening' : phase === 'thinking' ? 'Thinking' : 'You'}</Text>
        <Text style={styles.heard}>{transcript || 'Hold Ask, or type it.'}</Text>
        <Text style={styles.kicker}>Caddie</Text>
        {reply ? <YardageLine text={reply} /> : <Text style={styles.reply}> </Text>}
        {typed ? (
          <View style={styles.typeRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask your caddie…"
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.input}
              accessibilityLabel="Typed ask"
              onSubmitEditing={() => {
                const text = draft;
                setDraft('');
                void ask(text, 'typed');
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send question"
              onPress={() => {
                const text = draft;
                setDraft('');
                void ask(text, 'typed');
              }}
              style={styles.send}
            >
              <Text style={styles.closeText}>Send</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Talk"
            onPressIn={() => {
              move('barge');
              void tick();
              void startEar();
            }}
            style={styles.mic}
          >
            <Text style={styles.micText}>Talk</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </View>
  );

  return { overlay, open: openTalk, close: closeTalk, phase, transcript, reply, sample, typed, draft, setDraft, askKind, ask };
}

const styles = StyleSheet.create({
  bleed: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
  },
  shade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4,10,24,0.97)',
  },
  panel: { flex: 1, paddingHorizontal: 22, gap: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  close: { minHeight: 44, justifyContent: 'center' },
  closeText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
  sample: { color: '#8AC926', fontFamily: font.family, fontSize: type.caption, fontWeight: '700' },
  wave: { height: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  bar: { width: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  kicker: { color: 'rgba(255,255,255,0.62)', fontFamily: font.family, fontSize: type.caption, fontWeight: '700', letterSpacing: 0.6 },
  heard: { color: '#FFFFFF', fontFamily: font.family, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  reply: { color: '#FFFFFF', fontFamily: font.family, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  yards: { fontSize: 40, lineHeight: 44 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto' },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.08)',
    fontFamily: font.family,
    fontSize: type.body,
  },
  send: { minWidth: 64, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  mic: {
    marginTop: 'auto',
    minHeight: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C8102E',
  },
  micText: { color: '#FFFFFF', fontFamily: font.family, fontSize: 20, fontWeight: '700' },
});
