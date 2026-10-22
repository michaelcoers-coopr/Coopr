import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { PERSONALITY_LABELS, type CaddiePersonality, type EnvironmentName } from '@coopr/domain';
import {
  buildProfiles,
  parseSimulatorCsv,
  scoreRound,
  withSameMetricBlends,
  type DistanceObservation,
  type DistanceProfile,
  type DistanceUnit,
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
  addShot: (shot: Omit<LocalShot, 'id'>) => void;
  importCsv: (text: string) => string;
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

function placeClub(current: PlayingClub[], club: PlayingClub): PlayingClub[] {
  if (current.some((item) => item.id === club.id)) return current;
  const inPlay = current.filter((item) => item.slot === 'in_play').length;
  return [...current, { ...club, slot: inPlay >= 14 ? 'testing' : club.slot }];
}

export function LocalStoreProvider({ children }: { children: ReactNode }) {
  const [shots, setShots] = useState<LocalShot[]>([]);
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
      addShot: (shot) => setShots((current) => [...current, { ...shot, id: `local-${current.length + 1}` }]),
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
      holes,
      setStrokes: (hole, strokes) =>
        setHoles((current) => current.map((value, index) => (index === hole - 1 ? strokes : value))),
      profiles: withSameMetricBlends([...(SHELL?.profiles ?? []), ...buildProfiles(observations)]),
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
            },
          ]);
        }
      },
    };
  }, [shots, holes, clubs, bagMessage, courseReviews, unit, currentHole, manualYards, tagged]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocalStore(): LocalStore {
  const value = useContext(Ctx);
  if (!value) throw new Error('Local store missing');
  return value;
}
