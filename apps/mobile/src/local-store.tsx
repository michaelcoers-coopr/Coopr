import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { PERSONALITY_LABELS, type CaddiePersonality, type EnvironmentName } from '@coopr/domain';
import {
  buildProfiles,
  confirmedPhotoImport,
  parseSimulatorCsv,
  reportedDistanceProfile,
  scoreRound,
  withSameMetricBlends,
  type ConfirmedPhotoImport,
  type DistanceObservation,
  type DistanceProfile,
  type DistanceUnit,
  type ExistingPhotoRecords,
  type PhotoReviewItem,
} from '@coopr/engine';
import { loadFounderDataset, profilesFromFounder } from '@coopr/seed';
import { FOUNDER_TOOLS_ENABLED } from './founder-flag';

export type { DistanceUnit };
export type LandingResult = 'fairway' | 'left' | 'right' | 'short' | 'hazard';

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
  setCurrentHole: (hole: number) => void;
  manualYards: Readonly<Record<number, number | null>>;
  setManualYards: (hole: number, yards: number | null) => void;
  tagged: readonly TaggedShot[];
  tagShot: (shot: Omit<TaggedShot, 'id'> & { swingMode: string }) => void;
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

export function LocalStoreProvider({ children }: { children: ReactNode }) {
  const [shots, setShots] = useState<LocalShot[]>([]);
  const [reportedAverages, setReportedAverages] = useState<ReportedAverage[]>([]);
  const [photoScorecards, setPhotoScorecards] = useState<PhotoScorecard[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<KeptPhoto[]>([]);
  const [knownClubs, setKnownClubs] = useState<ExistingPhotoRecords['clubs']>([]);
  const [holes, setHoles] = useState<Array<number | null>>(Array.from({ length: 18 }, () => null));
  const [clubs, setClubs] = useState<PlayingClub[]>(SHELL?.clubs ?? []);
  const [bagMessage, setBagMessage] = useState('');
  const [courseReviews, setCourseReviews] = useState<Record<number, 'verified' | 'rejected'>>({});
  const [unit, setUnit] = useState<DistanceUnit>('yd');
  const [currentHole, setCurrentHole] = useState(1);
  const [manualYards, setManual] = useState<Record<number, number | null>>({});
  const [tagged, setTagged] = useState<TaggedShot[]>([]);

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
    const personality = SHELL?.personality ?? 'funny_knowledgeable';
    return {
      founderTools: FOUNDER_TOOLS_ENABLED,
      displayName: SHELL?.displayName ?? '',
      caddieName: SHELL?.caddieName ?? 'COOPR',
      personality,
      personalityLabel: PERSONALITY_LABELS[personality],
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
      setStrokes: (hole, strokes) =>
        setHoles((current) => current.map((value, index) => (index === hole - 1 ? strokes : value))),
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
      setCurrentHole: (hole) => setCurrentHole(Math.min(18, Math.max(1, hole))),
      manualYards,
      setManualYards: (hole, yards) => setManual((current) => ({ ...current, [hole]: yards })),
      tagged,
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
    };
  }, [shots, reportedAverages, photoScorecards, keptPhotos, knownClubs, holes, clubs, bagMessage, courseReviews, unit, currentHole, manualYards, tagged]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocalStore(): LocalStore {
  const value = useContext(Ctx);
  if (!value) throw new Error('Local store missing');
  return value;
}
