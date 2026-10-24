import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PERSONALITY_LABELS, type CaddiePersonality, type EnvironmentName } from '@coopr/domain';
import {
  buildProfiles,
  confirmedPhotoImport,
  parseSimulatorCsv,
  rememberDebrief,
  reportedDistanceProfile,
  scoreRound,
  withSameMetricBlends,
  type ConfirmedPhotoImport,
  type DistanceObservation,
  type DistanceProfile,
  type DistanceUnit,
  type ExistingPhotoRecords,
  type PhotoReviewItem,
  type WedgeLength,
} from '@coopr/engine';
import { loadFounderDataset, profilesFromFounder } from '@coopr/seed';
import { DEFAULT_VOICE, parseVoice, VOICE_LABELS, type CaddieVoice } from './design/caddie-voice';
import { FOUNDER_TOOLS_ENABLED } from './founder-flag';
import { hasWebStorage, readRound, readRoundSync, writeRound } from './round-save-io';
import { EMPTY_PUTTS, FRESH_CONDITIONS, type RoundConditions, type RoundSave, type SavedLie, type SavedMark } from './round-save';

export type { DistanceUnit };
export type LandingResult = 'fairway' | 'left' | 'right' | 'short' | 'rough' | 'green' | 'hazard';
export type { SavedMark };

export interface LocalShot {
  id: string;
  clubId: string;
  clubLabel: string;
  environment: EnvironmentName;
  swingMode: string;
  carry: number | null;
  total: number | null;
  lateralMiss: 'left' | 'right' | 'none';
  origin: 'manual' | 'csv' | 'photo' | 'tag';
  sourceApp: string | null;
  capturedOn: string | null;
}

export interface ReportedAverage {
  id: string;
  clubLabel: string;
  metric: 'carry' | 'total';
  yards: number;
  sampleSize: number | null;
  environment: EnvironmentName | null;
  sourceApp: string | null;
  capturedOn: string | null;
}

export interface PhotoScoreHole {
  hole: number;
  par: number | null;
  strokeIndex: number | null;
  yardage: number | null;
  strokes: number | null;
}

export interface PhotoScorecard {
  id: string;
  courseName: string | null;
  sourceApp: string | null;
  capturedOn: string | null;
  holes: PhotoScoreHole[];
}

export interface KeptPhoto {
  id: string;
  uri: string;
}

export interface PlayingClub {
  id: string;
  label: string;
  slot: 'in_play' | 'testing';
  note: string | null;
}

export interface TaggedShot {
  id: string;
  hole: number;
  clubId: string;
  clubLabel: string;
  result: LandingResult;
  /** The yardage on screen when the shot was tagged. Not a measured carry or total. */
  shownYards: number | null;
  carry: number | null;
  total: number | null;
}

interface FounderShell {
  displayName: string;
  caddieName: string;
  personality: CaddiePersonality;
  bagStatus: 'provisional' | 'confirmed' | null;
  bagNote: string | null;
  clubs: PlayingClub[];
  profiles: DistanceProfile[];
}

function loadShell(): FounderShell | null {
  if (!FOUNDER_TOOLS_ENABLED) return null;
  const dataset = loadFounderDataset();
  const inPlay = dataset.bags.find((bag) => bag.kind === 'in_play');
  const testing = dataset.bags.find((bag) => bag.kind === 'testing');
  const clubs: PlayingClub[] = [];
  const take = (bagId: string | undefined, slot: PlayingClub['slot']) => {
    if (!bagId) return;
    for (const membership of dataset.memberships.filter((item) => item.bagId === bagId)) {
      const club = dataset.clubs.find((item) => item.id === membership.clubId);
      if (!club) continue;
      const identity = [club.brand, club.model].filter((part) => part && !club.label.includes(part)).join(' ');
      clubs.push({
        id: club.id,
        label: identity ? `${club.label} · ${identity}` : club.label,
        slot,
        note: membership.note,
      });
    }
  };
  take(inPlay?.id, 'in_play');
  take(testing?.id, 'testing');
  return {
    displayName: dataset.user.displayName,
    caddieName: dataset.caddie.name,
    personality: dataset.caddie.personality,
    bagStatus: inPlay?.status ?? null,
    bagNote: inPlay?.note ?? null,
    clubs,
    profiles: profilesFromFounder(dataset),
  };
}

const SHELL = loadShell();

interface LocalStore {
  founderTools: boolean;
  displayName: string;
  caddieName: string;
  personality: CaddiePersonality;
  personalityLabel: string;
  voice: CaddieVoice;
  voiceLabel: string;
  setVoice: (voice: CaddieVoice) => void;
  bagStatus: 'provisional' | 'confirmed' | null;
  bagNote: string | null;
  clubs: PlayingClub[];
  bagMessage: string;
  moveClub: (id: string, slot: PlayingClub['slot']) => void;
  addClub: (label: string) => void;
  shots: LocalShot[];
  addShot: (shot: Omit<LocalShot, 'id' | 'origin' | 'sourceApp' | 'capturedOn'> & Partial<Pick<LocalShot, 'origin' | 'sourceApp' | 'capturedOn'>>) => void;
  importCsv: (text: string) => string;
  reportedAverages: ReportedAverage[];
  photoScorecards: PhotoScorecard[];
  keptPhotos: KeptPhoto[];
  photoExisting: () => ExistingPhotoRecords;
  savePhotoImport: (input: { items: readonly PhotoReviewItem[]; applyStrokes: boolean; imageUris: readonly string[] }) => { saved: boolean; message: string };
  holes: Array<number | null>;
  setStrokes: (hole: number, strokes: number | null) => void;
  profiles: DistanceProfile[];
  score: ReturnType<typeof scoreRound>;
  courseReviews: Readonly<Record<number, 'verified' | 'rejected'>>;
  setCourseReview: (hole: number, decision: 'verified' | 'rejected') => void;
  unit: DistanceUnit;
  setUnit: (unit: DistanceUnit) => void;
  currentHole: number;
  setCurrentHole: (hole: number | ((current: number) => number)) => void;
  manualYards: Readonly<Record<number, number | null>>;
  setManualYards: (hole: number, yards: number | null) => void;
  tagged: readonly TaggedShot[];
  tagShot: (shot: Omit<TaggedShot, 'id'> & { swingMode: string }) => void;
  removeTag: (id: string) => void;
  setCaddieName: (name: string) => void;
  setPersonality: (personality: CaddiePersonality) => void;
  plans: Readonly<Record<number, { clubLabel: string; target: string }>>;
  setPlan: (hole: number, patch: { clubLabel?: string; target?: string }) => void;
  debriefs: readonly { hole: number; choice: 'plan' | 'swing'; note: string }[];
  setDebrief: (entry: { hole: number; choice: 'plan' | 'swing'; note: string }) => void;
  wedges: Readonly<Record<string, Partial<Record<WedgeLength, number | null>>>>;
  setWedgeCarry: (clubId: string, length: WedgeLength, yards: number | null) => void;
  putts: readonly (number | null)[];
  setPutts: (hole: number, count: number | null) => void;
  marks: readonly SavedMark[];
  recordMark: (mark: { hole: number; lat: number; lon: number; clubId: string | null; clubLabel: string | null; close: { yards: number; lie: SavedLie | null } | null }) => void;
  conditions: RoundConditions;
  setConditions: (patch: Partial<RoundConditions>) => void;
  startNewRound: () => void;
}

const Ctx = createContext<LocalStore | null>(null);

function sideMiss(side: number | null): 'left' | 'right' | 'none' {
  if (side == null || Math.abs(side) <= 2) return 'none';
  return side > 0 ? 'right' : 'left';
}

function applyConfirmed(
  confirmed: ConfirmedPhotoImport,
  input: { applyStrokes: boolean; imageUris: readonly string[]; holes: Array<number | null> },
): {
  shots: LocalShot[];
  reported: ReportedAverage[];
  scorecards: PhotoScorecard[];
  photos: KeptPhoto[];
  clubKeys: ExistingPhotoRecords['clubs'];
  clubs: PlayingClub[];
  strokes: Array<number | null> | null;
  bagMessage: string;
  message: string;
} {
  const stamp = Date.now();
  const shots: LocalShot[] = confirmed.shots.map((shot, index) => ({
    id: `photo-shot-${stamp}-${index + 1}`,
    clubId: shot.clubLabel,
    clubLabel: shot.clubLabel,
    environment: 'simulator',
    swingMode: 'unknown',
    carry: shot.carry,
    total: shot.total,
    lateralMiss: sideMiss(shot.side),
    origin: 'photo',
    sourceApp: shot.sourceApp,
    capturedOn: shot.capturedOn,
  }));
  const reported: ReportedAverage[] = confirmed.reported.map((row, index) => ({
    id: `photo-reported-${stamp}-${index + 1}`,
    clubLabel: row.clubLabel,
    metric: row.metric,
    yards: row.yards,
    sampleSize: row.sampleSize,
    environment: row.environment,
    sourceApp: row.sourceApp,
    capturedOn: row.capturedOn,
  }));
  const byCard = new Map<string, PhotoScorecard>();
  for (const score of confirmed.scores) {
    const key = `${score.courseName ?? ''}|${score.sourceApp ?? ''}|${score.capturedOn ?? ''}`;
    const card = byCard.get(key) ?? {
      id: `photo-card-${stamp}-${byCard.size + 1}`,
      courseName: score.courseName,
      sourceApp: score.sourceApp,
      capturedOn: score.capturedOn,
      holes: [],
    };
    card.holes.push({
      hole: score.hole,
      par: score.par,
      strokeIndex: score.strokeIndex,
      yardage: score.yardage,
      strokes: score.strokes,
    });
    byCard.set(key, card);
  }
  const clubNotes = new Map<string, string>();
  for (const shot of confirmed.shots) {
    const where = [shot.sourceApp, shot.capturedOn].filter(Boolean).join(', ');
    clubNotes.set(shot.clubLabel, `Photo of a launch monitor${where ? `, ${where}` : ''}. You confirmed this read.`);
  }
  for (const row of confirmed.reported) {
    const where = [row.sourceApp, row.capturedOn].filter(Boolean).join(', ');
    clubNotes.set(row.clubLabel, `Their reported number${where ? `, ${where}` : ''}. Not a COOPR measurement.`);
  }
  for (const club of confirmed.clubs) {
    const where = [club.sourceApp, club.capturedOn].filter(Boolean).join(', ');
    clubNotes.set(club.label, `Photo${where ? `, ${where}` : ''}. Shaft ${club.shaft ?? 'unknown'}.`);
  }
  const clubs: PlayingClub[] = [...clubNotes.entries()].map(([label, note]) => ({
    id: label,
    label,
    slot: 'in_play',
    note,
  }));
  let strokes: Array<number | null> | null = null;
  let strokeNote = 'Strokes were not written onto the High Cedars card.';
  if (input.applyStrokes) {
    strokes = [...input.holes];
    let written = 0;
    let skipped = 0;
    for (const score of confirmed.scores) {
      if (score.strokes == null) continue;
      const current = strokes[score.hole - 1];
      if (current != null) {
        skipped += 1;
        continue;
      }
      strokes[score.hole - 1] = score.strokes;
      written += 1;
    }
    strokeNote = `Wrote ${written} stroke${written === 1 ? '' : 's'} onto blank High Cedars holes.${skipped ? ` Left ${skipped} hole${skipped === 1 ? '' : 's'} that already had a score.` : ''} Photo pars were not copied onto the open course.`;
  }
  const held = reported.filter((row) => row.sampleSize == null || row.environment == null).length;
  const photos = input.imageUris.map((uri, index) => ({ id: `photo-file-${stamp}-${index + 1}`, uri }));
  const parts = [
    `${shots.length} launch-monitor shot${shots.length === 1 ? '' : 's'} saved as a simulator read you confirmed.`,
    `${reported.length} reported number${reported.length === 1 ? '' : 's'} saved.`,
    held ? `${held} stay out of the blend until you set a sample size and an environment.` : '',
    `${confirmed.scores.length} scorecard row${confirmed.scores.length === 1 ? '' : 's'} kept beside the open course.`,
    strokeNote,
    `${confirmed.clubs.length} club${confirmed.clubs.length === 1 ? '' : 's'} from a photo. A full in-play bag sends a new club to testing.`,
    photos.length ? `${photos.length} photo URI${photos.length === 1 ? '' : 's'} kept on this phone for this session.` : 'No photo was kept on this phone.',
  ].filter(Boolean);
  return {
    shots,
    reported,
    scorecards: [...byCard.values()],
    photos,
    clubKeys: confirmed.clubs.map((club) => ({ brand: club.brand, model: club.model, loft: club.loft })),
    clubs,
    strokes,
    bagMessage: confirmed.clubs.length ? 'A club read from a photo goes to testing when the in-play 14 is already full.' : '',
    message: parts.join(' '),
  };
}

function placeClub(current: PlayingClub[], club: PlayingClub): PlayingClub[] {
  if (current.some((item) => item.id === club.id)) return current;
  const inPlay = current.filter((item) => item.slot === 'in_play').length;
  return [...current, { ...club, slot: inPlay >= 14 ? 'testing' : club.slot }];
}

const EMPTY_HOLES = Array.from({ length: 18 }, () => null) as Array<number | null>;

function manualFrom(save: RoundSave | null): Record<number, number | null> {
  if (!save) return {};
  return Object.fromEntries(Object.entries(save.manualYards).map(([hole, yards]) => [Number(hole), yards]));
}

function plansFrom(save: RoundSave | null): Record<number, { clubLabel: string; target: string }> {
  if (!save) return {};
  return Object.fromEntries(Object.entries(save.plans).map(([hole, plan]) => [Number(hole), plan]));
}

function applySavedRound(
  save: RoundSave | null,
  apply: {
    setShots: (shots: LocalShot[]) => void;
    setHoles: (holes: Array<number | null>) => void;
    setUnit: (unit: DistanceUnit) => void;
    setCurrentHole: (hole: number) => void;
    setManual: (yards: Record<number, number | null>) => void;
    setTagged: (shots: TaggedShot[]) => void;
    setPlans: (plans: Record<number, { clubLabel: string; target: string }>) => void;
    setDebriefs: (debriefs: Array<{ hole: number; choice: 'plan' | 'swing'; note: string }>) => void;
    setWedges: (wedges: Record<string, Partial<Record<WedgeLength, number | null>>>) => void;
    setPutts: (putts: Array<number | null>) => void;
    setMarks: (marks: SavedMark[]) => void;
    setConditionsState: (conditions: RoundConditions) => void;
  },
) {
  if (!save) return;
  apply.setShots(save.localShots);
  apply.setHoles(save.holes);
  apply.setUnit(save.unit);
  apply.setCurrentHole(save.currentHole);
  apply.setManual(manualFrom(save));
  apply.setTagged(save.tagged);
  apply.setPlans(plansFrom(save));
  apply.setDebriefs(save.debriefs);
  apply.setWedges(save.wedges);
  apply.setPutts(save.putts);
  apply.setMarks(save.marks);
  apply.setConditionsState(save.conditions);
}

export function LocalStoreProvider({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  // Server rendering has no localStorage. Reading it in useState made the
  // server paint nothing and the browser paint the round, which is the
  // hydration mismatch. Both sides start empty; the effect fills the round.
  const [hydrated, setHydrated] = useState(false);
  const [shots, setShots] = useState<LocalShot[]>([]);
  const [reportedAverages, setReportedAverages] = useState<ReportedAverage[]>([]);
  const [photoScorecards, setPhotoScorecards] = useState<PhotoScorecard[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<KeptPhoto[]>([]);
  const [knownClubs, setKnownClubs] = useState<ExistingPhotoRecords['clubs']>([]);
  const [holes, setHoles] = useState<Array<number | null>>(EMPTY_HOLES);
  const [clubs, setClubs] = useState<PlayingClub[]>(SHELL?.clubs ?? []);
  const [bagMessage, setBagMessage] = useState('');
  const [courseReviews, setCourseReviews] = useState<Record<number, 'verified' | 'rejected'>>({});
  const [unit, setUnit] = useState<DistanceUnit>('yd');
  const [currentHole, setCurrentHole] = useState(1);
  const [manualYards, setManual] = useState<Record<number, number | null>>({});
  const [tagged, setTagged] = useState<TaggedShot[]>([]);
  const [caddieName, setCaddieName] = useState(SHELL?.caddieName ?? 'COOPR');
  const [personality, setPersonality] = useState<CaddiePersonality>(SHELL?.personality ?? 'funny_knowledgeable');
  const [voice, setVoiceState] = useState<CaddieVoice>(DEFAULT_VOICE);
  const [plans, setPlans] = useState<Record<number, { clubLabel: string; target: string }>>({});
  const [debriefs, setDebriefs] = useState<Array<{ hole: number; choice: 'plan' | 'swing'; note: string }>>([]);
  const [wedges, setWedges] = useState<Record<string, Partial<Record<WedgeLength, number | null>>>>({});
  const [putts, setPutts] = useState<Array<number | null>>([...EMPTY_PUTTS]);
  const [marks, setMarks] = useState<SavedMark[]>([]);
  const [conditions, setConditionsState] = useState<RoundConditions>({ ...FRESH_CONDITIONS });

  const value = useMemo<LocalStore>(() => {
    const observations: DistanceObservation[] = [];
    for (const shot of shots) {
      const base = {
        clubId: shot.clubId,
        clubLabel: shot.clubLabel,
        environment: shot.environment,
        swingMode: shot.swingMode || 'unknown',
        qualityLabel: 'unknown' as const,
        aggregation: 'shot' as const,
        lateralMiss: shot.lateralMiss,
      };
      if (shot.carry != null) observations.push({ ...base, metric: 'carry', yards: shot.carry });
      if (shot.total != null) observations.push({ ...base, metric: 'total', yards: shot.total });
    }
    const entered = holes.flatMap((strokes, index) => (strokes == null ? [] : [{ hole: index + 1, strokes }]));
    return {
      founderTools: FOUNDER_TOOLS_ENABLED,
      displayName: SHELL?.displayName ?? '',
      caddieName,
      personality,
      personalityLabel: PERSONALITY_LABELS[personality],
      voice,
      voiceLabel: VOICE_LABELS[voice],
      setVoice: (next) => {
        const parsed = parseVoice(next);
        setVoiceState(parsed);
        try {
          if (typeof localStorage !== 'undefined') localStorage.setItem('coopr.voice', parsed);
        } catch {
          // A private browser can refuse the write. The choice still holds for this visit.
        }
      },
      bagStatus: SHELL?.bagStatus ?? null,
      bagNote: SHELL?.bagNote ?? null,
      clubs,
      bagMessage,
      moveClub: (id, slot) => {
        const inPlay = clubs.filter((club) => club.slot === 'in_play').length;
        const target = clubs.find((club) => club.id === id);
        if (!target || target.slot === slot) return;
        if (slot === 'in_play' && inPlay >= 14) {
          setBagMessage('In-play bag is limited to 14 clubs. Move one out before adding another.');
          return;
        }
        setBagMessage('');
        setClubs((current) => current.map((club) => (club.id === id ? { ...club, slot } : club)));
      },
      addClub: (label) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        setClubs((current) => {
          if (current.some((club) => club.label.toLowerCase() === trimmed.toLowerCase())) {
            setBagMessage(`${trimmed} is already in the bag.`);
            return current;
          }
          const inPlay = current.filter((club) => club.slot === 'in_play').length;
          if (inPlay >= 14) {
            setBagMessage('In-play bag is limited to 14 clubs. The new club was set aside for testing.');
          } else setBagMessage('');
          return placeClub(current, { id: trimmed, label: trimmed, slot: 'in_play', note: 'Added on this device' });
        });
      },
      shots,
      addShot: (shot) =>
        setShots((current) => [
          ...current,
          {
            ...shot,
            id: `local-${current.length + 1}`,
            origin: shot.origin ?? 'manual',
            sourceApp: shot.sourceApp ?? null,
            capturedOn: shot.capturedOn ?? null,
          },
        ]),
      importCsv: (text) => {
        const result = parseSimulatorCsv(text);
        if (result.error) return result.error;
        setShots((current) => [
          ...current,
          ...result.shots.map((shot, index) => ({
            id: `csv-${current.length + index + 1}`,
            clubId: shot.clubLabel,
            clubLabel: shot.clubLabel,
            environment: shot.environment,
            swingMode: shot.swingMode,
            carry: shot.carry,
            total: shot.total,
            lateralMiss: shot.lateralMiss,
            origin: 'csv' as const,
            sourceApp: null,
            capturedOn: null,
          })),
        ]);
        setClubs((current) => {
          let next = current;
          for (const shot of result.shots) {
            next = placeClub(next, { id: shot.clubLabel, label: shot.clubLabel, slot: 'in_play', note: 'CSV import on this device' });
          }
          return next;
        });
        const imported = `${result.shots.length} shot${result.shots.length === 1 ? '' : 's'} imported.`;
        return [imported, ...result.warnings].join(' ');
      },
      reportedAverages,
      photoScorecards,
      keptPhotos,
      photoExisting: () => ({
        shots: shots.map((shot) => ({ clubLabel: shot.clubLabel, carry: shot.carry, total: shot.total })),
        reported: reportedAverages.map((row) => ({
          sourceApp: row.sourceApp,
          clubLabel: row.clubLabel,
          metric: row.metric,
          yards: row.yards,
        })),
        scores: [
          ...photoScorecards.flatMap((card) =>
            card.holes.flatMap((hole) =>
              hole.strokes == null ? [] : [{ courseName: card.courseName, hole: hole.hole, strokes: hole.strokes }],
            ),
          ),
          ...holes.flatMap((strokes, index) => (strokes == null ? [] : [{ courseName: 'High Cedars', hole: index + 1, strokes }])),
        ],
        clubs: knownClubs,
      }),
      savePhotoImport: ({ items, applyStrokes, imageUris }) => {
        const confirmed = confirmedPhotoImport(items);
        if ('error' in confirmed) return { saved: false, message: confirmed.error };
        const saved = applyConfirmed(confirmed, { applyStrokes, imageUris, holes });
        setShots((current) => [...current, ...saved.shots]);
        setReportedAverages((current) => [...current, ...saved.reported]);
        setPhotoScorecards((current) => [...current, ...saved.scorecards]);
        setKeptPhotos((current) => [...current, ...saved.photos]);
        setKnownClubs((current) => [...current, ...saved.clubKeys]);
        setClubs((current) => saved.clubs.reduce((next, club) => placeClub(next, club), current));
        if (saved.strokes) setHoles(saved.strokes);
        if (saved.bagMessage) setBagMessage(saved.bagMessage);
        return { saved: true, message: saved.message };
      },
      holes,
      setStrokes: (hole, strokes) => {
        setHoles((current) => current.map((value, index) => (index === hole - 1 ? strokes : value)));
        setDebriefs((current) => current.filter((item) => item.hole !== hole));
      },
      profiles: withSameMetricBlends([
        ...(SHELL?.profiles ?? []),
        ...buildProfiles(observations),
        ...reportedAverages.flatMap((average) =>
          average.sampleSize == null || average.environment == null
            ? []
            : [
                reportedDistanceProfile({
                  clubLabel: average.clubLabel,
                  metric: average.metric,
                  yards: average.yards,
                  sampleSize: average.sampleSize,
                  environment: average.environment,
                  sourceApp: average.sourceApp,
                }),
              ],
        ),
      ]),
      score: scoreRound(entered),
      courseReviews,
      setCourseReview: (hole, decision) => {
        if (!FOUNDER_TOOLS_ENABLED) return;
        setCourseReviews((current) => ({ ...current, [hole]: decision }));
      },
      unit,
      setUnit,
      currentHole,
      setCurrentHole: (hole) =>
        setCurrentHole((current) => {
          const next = typeof hole === 'function' ? hole(current) : hole;
          if (!Number.isFinite(next)) return current;
          return Math.min(18, Math.max(1, Math.round(next)));
        }),
      manualYards,
      setManualYards: (hole, yards) => setManual((current) => ({ ...current, [hole]: yards })),
      tagged,
      removeTag: (id) => setTagged((current) => current.filter((shot) => shot.id !== id)),
      tagShot: (shot) => {
        const id = `tag-${tagged.length + 1}`;
        setTagged((current) => [...current, { ...shot, id }]);
        if (shot.carry != null || shot.total != null) {
          setShots((current) => [
            ...current,
            {
              id: `local-tag-${current.length + 1}`,
              clubId: shot.clubId,
              clubLabel: shot.clubLabel,
              environment: 'course',
              swingMode: shot.swingMode,
              carry: shot.carry,
              total: shot.total,
              lateralMiss: shot.result === 'left' ? 'left' : shot.result === 'right' ? 'right' : 'none',
              origin: 'tag',
              sourceApp: null,
              capturedOn: null,
            },
          ]);
        }
      },
      setCaddieName: (name) => setCaddieName(name.trim() || 'COOPR'),
      setPersonality,
      plans,
      setPlan: (hole, patch) =>
        setPlans((current) => ({
          ...current,
          [hole]: {
            clubLabel: patch.clubLabel ?? current[hole]?.clubLabel ?? '',
            target: patch.target ?? current[hole]?.target ?? '',
          },
        })),
      debriefs,
      setDebrief: (entry) => setDebriefs((current) => rememberDebrief(current, entry)),
      wedges,
      setWedgeCarry: (clubId, length, yards) =>
        setWedges((current) => ({ ...current, [clubId]: { ...current[clubId], [length]: yards } })),
      putts,
      setPutts: (hole, count) => {
        setPutts((current) => current.map((value, index) => (index === hole - 1 ? count : value)));
      },
      marks,
      recordMark: (mark) => {
        setMarks((current) => {
          const next = current.map((item) => ({ ...item }));
          if (mark.close) {
            for (let index = next.length - 1; index >= 0; index -= 1) {
              const prior = next[index];
              if (prior && prior.hole === mark.hole && prior.yards == null) {
                next[index] = { ...prior, yards: mark.close.yards, lie: mark.close.lie };
                break;
              }
            }
          }
          next.push({
            id: `mark-${next.length + 1}`,
            hole: mark.hole,
            lat: mark.lat,
            lon: mark.lon,
            clubId: mark.clubId,
            clubLabel: mark.clubLabel,
            yards: null,
            lie: null,
          });
          return next;
        });
      },
      conditions,
      setConditions: (patch) => setConditionsState((current) => ({ ...current, ...patch })),
      startNewRound: () => {
        setHoles(EMPTY_HOLES);
        setCurrentHole(1);
        setManual({});
        setTagged([]);
        setMarks([]);
        setDebriefs([]);
        setPlans({});
        setShots((current) => current.filter((shot) => shot.origin !== 'tag'));
        setUnit('yd');
        setPutts([...EMPTY_PUTTS]);
        setConditionsState({ ...FRESH_CONDITIONS });
      },
    };
  }, [shots, reportedAverages, photoScorecards, keptPhotos, knownClubs, holes, clubs, bagMessage, courseReviews, unit, currentHole, manualYards, tagged, caddieName, personality, voice, plans, debriefs, wedges, putts, conditions, marks]);

  useEffect(() => {
    let cancel = false;
    const apply = (save: RoundSave | null) => {
      if (cancel) return;
      applySavedRound(save, {
        setShots,
        setHoles,
        setUnit,
        setCurrentHole,
        setManual,
        setTagged,
        setPlans,
        setDebriefs,
        setWedges,
        setPutts,
        setMarks,
        setConditionsState,
      });
    };
    const finish = () => {
      if (!cancel) setHydrated(true);
    };
    if (hasWebStorage()) {
      apply(readRoundSync());
      try {
        setVoiceState(parseVoice(localStorage.getItem('coopr.voice')));
      } catch {
        setVoiceState(DEFAULT_VOICE);
      }
      finish();
      return () => {
        cancel = true;
      };
    }
    readRound().then(apply).catch(() => undefined).finally(finish);
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const manual: Record<string, number> = {};
    for (const [hole, yards] of Object.entries(manualYards)) {
      if (yards != null && yards > 0) manual[hole] = yards;
    }
    const wedgeSave: RoundSave['wedges'] = {};
    for (const [clubId, cells] of Object.entries(wedges)) {
      const next: Partial<Record<WedgeLength, number>> = {};
      for (const [length, yards] of Object.entries(cells ?? {})) {
        if (typeof yards === 'number' && yards > 0) next[length as WedgeLength] = yards;
      }
      if (Object.keys(next).length > 0) wedgeSave[clubId] = next;
    }
    const planSave: RoundSave['plans'] = {};
    for (const [hole, plan] of Object.entries(plans)) planSave[hole] = plan;
    void writeRound({
      version: 1,
      holes,
      currentHole,
      manualYards: manual,
      tagged,
      debriefs,
      wedges: wedgeSave,
      unit,
      plans: planSave,
      localShots: shots,
      putts,
      conditions,
      marks,
    });
  }, [hydrated, holes, currentHole, manualYards, tagged, debriefs, wedges, unit, plans, shots, putts, conditions, marks]);

  if (!hydrated) return fallback;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocalStore(): LocalStore {
  const value = useContext(Ctx);
  if (!value) throw new Error('Local store missing');
  return value;
}
