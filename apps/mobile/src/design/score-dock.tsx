import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { DOCK_GAP, DOCK_PAD, DOCK_ROW, scorePanelBudget } from './responsive';
import { MIN_TAP } from './round-chrome';

export type FairwayPick = 'hit' | 'left' | 'right' | 'short' | 'long' | null;

export interface ScoreDraft {
  strokes: number;
  putts: number | null;
  penalties: number | null;
  fairway: FairwayPick;
  gir: boolean | null;
}

/** Putts cannot exceed the strokes on the hole. */
export function clampPutts(strokes: number, putts: number): number {
  const score = Number.isFinite(strokes) ? Math.max(1, Math.round(strokes)) : 1;
  const count = Number.isFinite(putts) ? Math.round(putts) : 0;
  return Math.max(0, Math.min(score, count));
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
  screenHeight,
  thruLabel,
  onSave,
  onMark,
  onPause,
  onEnd,
  voiceMuted,
  handsFree,
  onToggleMute,
  onToggleHandsFree,
  holeShots = [],
  reviewShotId = null,
  onReviewShot,
  onCycleShot,
  shotYards,
  onDeleteShot,
  onAdjustShot,
  onSetShotYards,
  scoreAsk = 0,
  pendingStrokes = null,
  justYards = false,
  onToggleJustYards,
  batterySaver = false,
  onToggleBattery,
  canUndoScore = false,
  onUndoScore,
  onQuickPar,
}: {
  hole: number;
  par: number | null;
  savedStrokes: number | null;
  savedPutts: number | null;
  savedPenalties: number | null;
  savedFairway: FairwayPick;
  savedGir: boolean | null;
  markCount: number;
  screenHeight: number;
  thruLabel: string | null;
  onSave: (draft: ScoreDraft, finish: boolean) => void;
  onMark: () => void;
  onPause: () => void;
  onEnd: () => void;
  voiceMuted?: boolean;
  handsFree?: boolean;
  onToggleMute?: () => void;
  onToggleHandsFree?: () => void;
  holeShots?: { id: string; label: string; yards: number }[];
  reviewShotId?: string | null;
  onReviewShot?: (id: string) => void;
  onCycleShot?: (id: string) => void;
  shotYards?: number | null;
  onDeleteShot?: () => void;
  onAdjustShot?: (delta: number) => void;
  onSetShotYards?: (yards: number) => void;
  scoreAsk?: number;
  /** Spoken score waiting on Confirm. The bar shows this, not the last saved number. */
  pendingStrokes?: number | null;
  justYards?: boolean;
  onToggleJustYards?: () => void;
  batterySaver?: boolean;
  onToggleBattery?: () => void;
  canUndoScore?: boolean;
  onUndoScore?: () => void;
  /** Fired only by the one-tap Par button, after the score is written. */
  onQuickPar?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [strokes, setStrokes] = useState(par ?? 4);
  const [putts, setPutts] = useState(0);
  const [penalties, setPenalties] = useState(0);
  const [fairway, setFairway] = useState<FairwayPick>(savedFairway);
  const [gir, setGir] = useState<boolean | null>(savedGir);
  const window = useWindowDimensions();
  const [yardDraft, setYardDraft] = useState(shotYards == null ? '' : String(Math.round(shotYards)));
  const edited = useRef(false);
  const last = hole >= 18;
  const floor = par ?? 4;
  const shown = pendingStrokes ?? strokes;
  const budget = scorePanelBudget(window.height || screenHeight, window.width);
  const compactMenu = window.height < 420;
  const menuHit = compactMenu ? styles.menuCell : styles.wide;

  // A new hole loads that hole's score. Opening Score must not.
  useEffect(() => {
    edited.current = false;
    setOpen(false);
    setMenu(false);
    setConfirmEnd(false);
    const next = savedStrokes ?? par ?? 4;
    setStrokes(next);
    setPutts(clampPutts(next, savedPutts ?? 0));
    setPenalties(savedPenalties ?? 0);
    setFairway(savedFairway);
    setGir(savedGir);
  }, [hole]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (edited.current) return;
    const next = savedStrokes ?? par ?? 4;
    setStrokes(next);
    setPutts(clampPutts(next, savedPutts ?? 0));
    setPenalties(savedPenalties ?? 0);
  }, [savedStrokes, savedPutts, savedPenalties, par]);

  useEffect(() => {
    if (shotYards == null) return;
    setYardDraft(String(Math.round(shotYards)));
  }, [shotYards]);

  useEffect(() => {
    if (!scoreAsk) return;
    setMenu(false);
    setConfirmEnd(false);
    setOpen(true);
  }, [scoreAsk]);

  useEffect(() => {
    if (!menu || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const close = (event: Event) => {
      const target = event.target as { closest?: (selector: string) => unknown } | null;
      if (target?.closest?.('[data-testid="round-menu-panel"], [data-testid="round-menu"]')) return;
      setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const show = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setMenu(false);
    setConfirmEnd(false);
    setOpen(true);
  };
  const endSummary = thruLabel
    ? `End the round? ${thruLabel}. Saved holes stay on this phone.`
    : 'End the round? Holes you already saved stay on this phone.';

  const writeStrokes = (next: number) => {
    edited.current = true;
    const score = Math.max(1, next);
    setStrokes(score);
    setPutts((current) => clampPutts(score, current));
  };
  const closeMenu = () => setMenu(false);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, menu && styles.wrapOpen]}>
      {menu ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
          testID="round-menu-backdrop"
          pointerEvents="none"
          onPress={closeMenu}
          style={styles.backdrop}
        />
      ) : null}
      <View pointerEvents="box-none" style={styles.dock}>
      {menu ? (
        <View accessibilityLabel="Round menu" testID="round-menu-panel" style={[styles.panel, compactMenu && styles.menuGrid, { maxHeight: window.height - 16 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Pause round (keep progress)" onPress={onPause} style={menuHit}>
            <Text style={styles.wideText}>Pause round (keep progress)</Text>
          </Pressable>
          {onToggleMute ? (
            <Pressable accessibilityRole="button" accessibilityLabel={voiceMuted ? 'Caddie voice on' : 'Mute caddie'} onPress={onToggleMute} style={menuHit}>
              <Text style={styles.wideText}>{voiceMuted ? 'Caddie voice on' : 'Mute caddie'}</Text>
            </Pressable>
          ) : null}
          {onToggleHandsFree ? (
            <Pressable accessibilityRole="button" accessibilityLabel={handsFree ? 'Hands-free on' : 'Hands-free off'} onPress={onToggleHandsFree} style={menuHit}>
              <Text style={styles.wideText}>{handsFree ? 'Hands-free on' : 'Hands-free off'}</Text>
            </Pressable>
          ) : null}
          {canUndoScore && onUndoScore ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Undo last score" onPress={onUndoScore} style={menuHit}>
              <Text style={styles.wideText}>Undo last score</Text>
            </Pressable>
          ) : null}
          {confirmEnd ? (
            <View>
              <Text style={styles.kicker}>{endSummary}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Confirm end round" onPress={onEnd} style={menuHit}>
                <Text style={styles.wideText}>End round</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Keep playing"
                onPress={() => {
                  setConfirmEnd(false);
                  setMenu(false);
                }}
                style={menuHit}
              >
                <Text style={styles.wideText}>Keep playing</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="End round" onPress={() => setConfirmEnd(true)} style={menuHit}>
              <Text style={styles.wideText}>End round</Text>
            </Pressable>
          )}
          <ScrollView
            testID="shot-list"
            style={{ maxHeight: compactMenu ? 56 : 88, width: '100%' }}
            keyboardShouldPersistTaps="handled"
          >
          {onToggleJustYards ? (
            <Pressable accessibilityRole="button" accessibilityLabel={justYards ? 'Just yards on' : 'Just yards'} accessibilityState={{ checked: justYards }} {...({ 'aria-checked': justYards } as object)} onPress={onToggleJustYards} style={styles.wide}>
              <Text style={styles.wideText}>{justYards ? 'Just yards on' : 'Just yards'}</Text>
            </Pressable>
          ) : null}
          {onToggleBattery ? (
            <Pressable accessibilityRole="button" accessibilityLabel={batterySaver ? 'Battery saver on' : 'Battery saver'} accessibilityState={{ checked: batterySaver }} {...({ 'aria-checked': batterySaver } as object)} onPress={onToggleBattery} style={styles.wide}>
              <Text style={styles.wideText}>{batterySaver ? 'Battery saver on' : 'Battery saver'}</Text>
            </Pressable>
          ) : null}
          {holeShots.map((shot) => (
            <View key={shot.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Review ${shot.label} ${Math.round(shot.yards)} yards`}
                testID="hole-shot"
                onPress={() => onReviewShot?.(shot.id)}
                style={[styles.wide, reviewShotId === shot.id && styles.choiceOn]}
              >
                <Text style={styles.wideText}>{`${Math.round(shot.yards)} yards · ${shot.label}`}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Change club for ${shot.label}`} testID="reassign-shot" onPress={() => onCycleShot?.(shot.id)} style={styles.wide}>
                <Text style={styles.wideText}>Change club</Text>
              </Pressable>
            </View>
          ))}
          {shotYards != null ? (
            <View>
              <Text accessibilityLabel={`Shot ${Math.round(shotYards)} yards`} testID="shot-readout" style={styles.kicker}>{`Shot ${Math.round(shotYards)} yards`}</Text>
              <View style={styles.stepRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Fewer shot yards" onPress={() => onAdjustShot?.(-1)} style={styles.hit}>
                  <Text style={styles.sign}>−</Text>
                </Pressable>
                <TextInput
                  accessibilityLabel="Shot yards"
                  testID="shot-yards"
                  value={yardDraft}
                  keyboardType="number-pad"
                  onChangeText={(text) => {
                    setYardDraft(text);
                    const next = Number(text);
                    if (Number.isFinite(next) && next >= 1 && next <= 400) onSetShotYards?.(next);
                  }}
                  onEndEditing={(event) => {
                    const next = Number(event.nativeEvent.text);
                    if (Number.isFinite(next)) onSetShotYards?.(next);
                  }}
                  style={styles.yardInput}
                />
                <Pressable accessibilityRole="button" accessibilityLabel="More shot yards" onPress={() => onAdjustShot?.(1)} style={styles.hit}>
                  <Text style={styles.sign}>+</Text>
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Delete last shot" onPress={onDeleteShot} style={styles.wide}>
                <Text style={styles.wideText}>Delete last shot</Text>
              </Pressable>
            </View>
          ) : null}
          </ScrollView>
        </View>
      ) : null}
      {open ? (
        <View style={[styles.panel, { maxHeight: budget }]} testID="score-entry" accessibilityLabel="Score entry">
          <ScrollView
            testID="score-fields"
            style={{ maxHeight: budget - 64 }}
            contentContainerStyle={styles.fields}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.stepRow}>
              <Text style={styles.kicker}>{`Hole ${hole}${par != null ? ` · par ${par}` : ''}`}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close score" onPress={() => setOpen(false)} style={styles.hit}>
                <Text style={styles.sign}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.stepRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Fewer strokes" onPress={() => writeStrokes(strokes - 1)} style={styles.hit}>
                <Text style={styles.sign}>−</Text>
              </Pressable>
              <Text accessibilityLabel={`Strokes ${strokes}`} style={styles.big}>{strokes}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="More strokes" onPress={() => writeStrokes(strokes + 1)} style={styles.hit}>
                <Text style={styles.sign}>+</Text>
              </Pressable>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.label}>Putts</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fewer putts entry" onPress={() => setPutts((value) => clampPutts(strokes, value - 1))} style={styles.hit}>
                <Text style={styles.sign}>−</Text>
              </Pressable>
              <Text accessibilityLabel={`Putts ${putts}`} style={styles.mid}>{String(putts)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="More putts entry" onPress={() => setPutts((value) => clampPutts(strokes, value + 1))} style={styles.hit}>
                <Text style={styles.sign}>+</Text>
              </Pressable>
            </View>
            {par != null && par >= 4 ? (
              <View style={styles.block}>
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
            <View style={styles.block}>
              <Text style={styles.label}>Green</Text>
              <View style={styles.choiceRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Green in regulation" onPress={() => setGir(true)} style={[styles.choice, gir === true && styles.choiceOn]}>
                  <Text style={[styles.choiceText, gir === true && styles.choiceTextOn]}>GIR</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Missed green" onPress={() => setGir(false)} style={[styles.choice, gir === false && styles.choiceOn]}>
                  <Text style={[styles.choiceText, gir === false && styles.choiceTextOn]}>Missed GIR</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.label}>Penalties</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fewer penalties" onPress={() => setPenalties((value) => Math.max(0, value - 1))} style={styles.hit}>
                <Text style={styles.sign}>−</Text>
              </Pressable>
              <Text accessibilityLabel={`Penalties ${penalties}`} style={styles.mid}>{String(penalties)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="More penalties" onPress={() => setPenalties((value) => value + 1)} style={styles.hit}>
                <Text style={styles.sign}>+</Text>
              </Pressable>
            </View>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={last ? 'Finish round' : 'Save and next hole'}
            testID={last ? 'finish-round' : 'save-next'}
            onPress={() => {
              onSave({ strokes, putts: clampPutts(strokes, putts), penalties, fairway, gir }, last);
              setOpen(false);
            }}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{last ? 'Finish round' : 'Save and next hole'}</Text>
          </Pressable>
        </View>
      ) : null}
      <View testID="score-dock" style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={last ? 'Finish' : shown === floor ? 'Par' : 'Next'}
          testID={last ? 'hole-finish' : 'par-next'}
          onPress={() => {
            closeMenu();
            onSave({ strokes: shown, putts: clampPutts(shown, putts), penalties, fairway, gir }, last);
            if (!last && shown === floor) onQuickPar?.();
            setOpen(false);
          }}
          style={styles.par}
        >
          <Text style={styles.parText}>{last ? 'Finish' : shown === floor ? 'Par' : 'Next'}</Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Lower the score" onPress={() => { closeMenu(); writeStrokes(strokes - 1); }} style={styles.cell}>
            <Text style={styles.sign}>−</Text>
          </Pressable>
          <View accessibilityLabel={`Score on the bar ${shown}`} style={styles.cell}>
            <Text style={styles.big}>{String(shown)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Raise the score" onPress={() => { closeMenu(); writeStrokes(strokes + 1); }} style={styles.cell}>
            <Text style={styles.sign}>+</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Score" testID="open-score" onPress={show} style={[styles.cell, styles.scoreBtn]}>
            <Text style={styles.primaryText}>Score</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Mark shot, ${markCount} ${markCount === 1 ? 'mark' : 'marks'}`} testID="mark-shot" onPress={() => { closeMenu(); onMark(); }} style={styles.cell}>
            <Text style={styles.markText}>MARK</Text>
            <Text style={styles.markCount}>{markCount}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Round menu" testID="round-menu" onPress={() => { setOpen(false); setMenu((value) => !value); }} style={styles.cell}>
            <Text style={styles.menuText}>Menu</Text>
          </Pressable>
        </View>
      </View>
      </View>
    </View>
  );
}

const TAP = 56;

const styles = StyleSheet.create({
  wrap: { gap: 6, width: '100%', alignSelf: 'stretch', pointerEvents: 'box-none' },
  wrapOpen: { position: 'absolute', left: -8, right: -8, bottom: 0, top: -1600 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none' },
  dock: { marginTop: 'auto', gap: 6, zIndex: 2, width: '100%', alignSelf: 'stretch' },
  panel: { backgroundColor: '#041018', borderRadius: 16, padding: 6, gap: 4, overflow: 'hidden', zIndex: 2 },
  fields: { gap: 4 },
  block: { gap: 2 },
  bar: {
    width: '100%',
    alignSelf: 'stretch',
    height: DOCK_PAD * 2 + DOCK_ROW + DOCK_GAP + DOCK_ROW,
    backgroundColor: '#041018',
    borderRadius: 16,
    paddingVertical: DOCK_PAD,
    gap: DOCK_GAP,
  },
  row: { flexDirection: 'row', alignItems: 'stretch', height: DOCK_ROW, width: '100%' },
  cell: { flex: 1, minWidth: 0, height: DOCK_ROW, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flex: 1 },
  yardInput: { minWidth: 64, minHeight: MIN_TAP, color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  label: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', minWidth: 72 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hit: { minWidth: TAP, minHeight: TAP, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  sign: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  finish: { color: '#8AC926', fontSize: 14, fontWeight: '800' },
  big: { color: '#FFFFFF', fontSize: 22, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  mid: { color: '#FFFFFF', fontSize: 20, lineHeight: 24, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  choice: { minHeight: TAP, minWidth: TAP, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  choiceOn: { backgroundColor: '#8AC926' },
  choiceText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  choiceTextOn: { color: '#0B1F3A' },
  par: { height: DOCK_ROW, width: '100%', borderRadius: 14, backgroundColor: '#C8102E', alignItems: 'center', justifyContent: 'center' },
  parText: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '800' },
  scoreBtn: { backgroundColor: '#8AC926', borderRadius: 14 },
  menuText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  primary: { minHeight: TAP, minWidth: 88, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#8AC926', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0B1F3A', fontSize: 16, fontWeight: '800' },
  wide: { minHeight: TAP, justifyContent: 'center', paddingHorizontal: 8 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  menuCell: { width: '48%', minHeight: TAP, justifyContent: 'center', paddingHorizontal: 8 },
  wideText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  mark: { height: TAP, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  markCount: { color: '#8AC926', fontSize: 16, fontWeight: '800' },
});
