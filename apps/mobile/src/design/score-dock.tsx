import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MIN_TAP } from './round-chrome';

export type FairwayPick = 'hit' | 'left' | 'right' | 'short' | 'long' | null;

export interface ScoreDraft {
  strokes: number;
  putts: number | null;
  penalties: number | null;
  fairway: FairwayPick;
  gir: boolean | null;
}

export function ScoreDock({
  hole,
  par,
  savedStrokes,
  savedPutts,
  savedPenalties,
  savedFairway,
  savedGir,
  markCount,
  ask,
  screenHeight,
  thruLabel,
  onSave,
  onPrev,
  onNext,
  onMark,
  onPause,
  onEnd,
}: {
  hole: number;
  par: number | null;
  savedStrokes: number | null;
  savedPutts: number | null;
  savedPenalties: number | null;
  savedFairway: FairwayPick;
  savedGir: boolean | null;
  markCount: number;
  ask: ReactNode;
  screenHeight: number;
  thruLabel: string | null;
  onSave: (draft: ScoreDraft, finish: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  onMark: () => void;
  onPause: () => void;
  onEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [strokes, setStrokes] = useState(par ?? 4);
  const [putts, setPutts] = useState<number | null>(savedPutts);
  const [penalties, setPenalties] = useState<number | null>(savedPenalties);
  const [fairway, setFairway] = useState<FairwayPick>(savedFairway);
  const [gir, setGir] = useState<boolean | null>(savedGir);
  const last = hole >= 18;
  const floor = par ?? 4;

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [hole]);

  const show = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setStrokes(savedStrokes ?? floor);
    setPutts(savedPutts);
    setPenalties(savedPenalties);
    setFairway(savedFairway);
    setGir(savedGir);
    setMenu(false);
    setConfirmEnd(false);
    setOpen(true);
  };
  const endSummary = thruLabel
    ? `End the round? ${thruLabel}. Saved holes stay on this phone.`
    : 'End the round? Holes you already saved stay on this phone.';

  const choices = [floor - 1, floor, floor + 1, floor + 2].filter((value) => value >= 1);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {menu ? (
        <View style={styles.panel} accessibilityLabel="Round menu">
          <Pressable accessibilityRole="button" accessibilityLabel="Pause round (keep progress)" onPress={onPause} style={styles.wide}>
            <Text style={styles.wideText}>Pause round (keep progress)</Text>
          </Pressable>
          {confirmEnd ? (
            <View>
              <Text style={styles.kicker}>{endSummary}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Confirm end round" onPress={onEnd} style={styles.wide}>
                <Text style={styles.wideText}>End round</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Keep playing" onPress={() => setConfirmEnd(false)} style={styles.wide}>
                <Text style={styles.wideText}>Keep playing</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="End round" onPress={() => setConfirmEnd(true)} style={styles.wide}>
              <Text style={styles.wideText}>End round</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {open ? (
        <ScrollView style={[styles.panel, { maxHeight: Math.round(Math.max(1, screenHeight) * 0.45) }]} testID="score-entry" accessibilityLabel="Score entry">
          <View style={styles.stepRow}>
            <Text style={styles.kicker}>{`Hole ${hole}${par != null ? ` · par ${par}` : ''}`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close score" onPress={() => setOpen(false)} style={styles.hit}>
              <Text style={styles.sign}>Close</Text>
            </Pressable>
          </View>
          <View style={styles.stepRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fewer strokes" onPress={() => setStrokes((value) => Math.max(1, value - 1))} style={styles.hit}>
              <Text style={styles.sign}>−</Text>
            </Pressable>
            <Text accessibilityLabel={`Strokes ${strokes}`} style={styles.big}>{strokes}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="More strokes" onPress={() => setStrokes((value) => value + 1)} style={styles.hit}>
              <Text style={styles.sign}>+</Text>
            </Pressable>
          </View>
          <View style={styles.choiceRow}>
            {choices.map((value) => (
              <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Strokes ${value}`} onPress={() => setStrokes(value)} style={[styles.choice, strokes === value && styles.choiceOn]}>
                <Text style={[styles.choiceText, strokes === value && styles.choiceTextOn]}>{value}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.label}>Putts</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fewer putts entry" onPress={() => setPutts((value) => Math.max(0, (value ?? 0) - 1))} style={styles.hit}>
              <Text style={styles.sign}>−</Text>
            </Pressable>
            <Text style={styles.mid}>{putts == null ? '—' : String(putts)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="More putts entry" onPress={() => setPutts((value) => (value ?? 0) + 1)} style={styles.hit}>
              <Text style={styles.sign}>+</Text>
            </Pressable>
          </View>
          {par != null && par >= 4 ? (
            <View>
            <Text style={styles.label}>Fairway</Text>
            <View style={styles.choiceRow}>
              {(['hit', 'left', 'right', 'short'] as const).map((side) => (
                <Pressable key={side} accessibilityRole="button" accessibilityLabel={`Fairway ${side}`} onPress={() => setFairway(side)} style={[styles.choice, fairway === side && styles.choiceOn]}>
                  <Text style={[styles.choiceText, fairway === side && styles.choiceTextOn]}>{side}</Text>
                </Pressable>
              ))}
            </View>
            </View>
          ) : null}
          <Text style={styles.label}>Green</Text>
          <View style={styles.choiceRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Green in regulation" onPress={() => setGir(true)} style={[styles.choice, gir === true && styles.choiceOn]}>
              <Text style={[styles.choiceText, gir === true && styles.choiceTextOn]}>GIR</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Missed green" onPress={() => setGir(false)} style={[styles.choice, gir === false && styles.choiceOn]}>
              <Text style={[styles.choiceText, gir === false && styles.choiceTextOn]}>Missed GIR</Text>
            </Pressable>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.label}>Penalties</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fewer penalties" onPress={() => setPenalties((value) => Math.max(0, (value ?? 0) - 1))} style={styles.hit}>
              <Text style={styles.sign}>−</Text>
            </Pressable>
            <Text style={styles.mid}>{penalties == null ? '—' : String(penalties)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="More penalties" onPress={() => setPenalties((value) => (value ?? 0) + 1)} style={styles.hit}>
              <Text style={styles.sign}>+</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={last ? 'Finish round' : 'Save and next hole'}
            testID={last ? 'finish-round' : 'save-next'}
            onPress={() => {
              onSave({ strokes, putts, penalties, fairway, gir }, last);
              setOpen(false);
            }}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{last ? 'Finish round' : 'Save and next hole'}</Text>
          </Pressable>
        </ScrollView>
      ) : null}
      {thruLabel ? <Text accessibilityLabel={thruLabel} style={styles.kicker}>{thruLabel}</Text> : null}
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Score previous hole" onPress={onPrev} style={styles.hit}>
          <Text style={styles.sign}>‹</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Score" testID="open-score" onPress={show} style={styles.primary}>
          <Text style={styles.primaryText}>Score</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Score next hole" accessibilityState={{ disabled: last }} disabled={last} onPress={onNext} style={styles.hit}>
          <Text style={styles.sign}>›</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Mark shot, ${markCount} ${markCount === 1 ? 'mark' : 'marks'}`} testID="mark-shot" onPress={onMark} style={styles.mark}>
          <Text style={styles.markText}>MARK</Text>
          <Text style={styles.markCount}>{markCount}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Round menu" testID="round-menu" onPress={() => { setOpen(false); setMenu((value) => !value); }} style={styles.hit}>
          <Text style={styles.sign}>Menu</Text>
        </Pressable>
        {ask}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  panel: { backgroundColor: '#041018', borderRadius: 16, padding: 8, gap: 6, overflow: 'hidden' },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: MIN_TAP },
  kicker: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  label: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', minWidth: 72 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hit: { minWidth: MIN_TAP, minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  sign: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  big: { color: '#FFFFFF', fontSize: 40, lineHeight: 44, fontWeight: '700', minWidth: 48, textAlign: 'center' },
  mid: { color: '#FFFFFF', fontSize: 22, lineHeight: 26, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  choice: { minHeight: MIN_TAP, minWidth: MIN_TAP, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  choiceOn: { backgroundColor: '#8AC926' },
  choiceText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  choiceTextOn: { color: '#0B1F3A' },
  primary: { minHeight: 48, minWidth: 88, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#8AC926', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0B1F3A', fontSize: 16, fontWeight: '800' },
  wide: { minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: 8 },
  wideText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  mark: { minWidth: 64, minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  markCount: { color: '#8AC926', fontSize: 16, fontWeight: '800' },
});
