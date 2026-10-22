import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { PERSONALITY_LABELS, type CaddiePersonality, type EnvironmentName } from '@coopr/domain';
import { buildProfiles, scoreRound, type DistanceObservation, type DistanceProfile } from '@coopr/engine';
import { loadFounderDataset, profilesFromFounder } from '@coopr/seed';
import { FOUNDER_TOOLS_ENABLED } from './founder-flag';

export interface LocalShot {
  id: string;
  clubLabel: string;
  environment: EnvironmentName;
  swingMode: string;
  carry: number | null;
  total: number | null;
}

export interface PlayingClub {
  id: string;
  label: string;
  slot: 'in_play' | 'testing';
  note: string | null;
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
  shots: LocalShot[];
  addShot: (shot: Omit<LocalShot, 'id'>) => void;
  holes: Array<number | null>;
  setStrokes: (hole: number, strokes: number | null) => void;
  profiles: DistanceProfile[];
  score: ReturnType<typeof scoreRound>;
}

const Ctx = createContext<LocalStore | null>(null);

export function LocalStoreProvider({ children }: { children: ReactNode }) {
  const [shots, setShots] = useState<LocalShot[]>([]);
  const [holes, setHoles] = useState<Array<number | null>>(Array.from({ length: 18 }, () => null));
  const [clubs, setClubs] = useState<PlayingClub[]>(SHELL?.clubs ?? []);
  const [bagMessage, setBagMessage] = useState('');

  const value = useMemo<LocalStore>(() => {
    const observations: DistanceObservation[] = [];
    for (const shot of shots) {
      const base = {
        clubId: shot.clubLabel,
        clubLabel: shot.clubLabel,
        environment: shot.environment,
        swingMode: shot.swingMode || 'unknown',
        qualityLabel: 'unknown' as const,
        aggregation: 'shot' as const,
        lateralMiss: 'none' as const,
      };
      if (shot.carry != null) observations.push({ ...base, metric: 'carry', yards: shot.carry });
      if (shot.total != null) observations.push({ ...base, metric: 'total', yards: shot.total });
    }
    const entered = holes.flatMap((strokes, index) => (strokes == null ? [] : [{ hole: index + 1, strokes }]));
    const personality = SHELL?.personality ?? 'funny_knowledgeable';
    return {
      founderTools: FOUNDER_TOOLS_ENABLED,
      displayName: SHELL?.displayName ?? '',
      caddieName: SHELL?.caddieName ?? '',
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
      shots,
      addShot: (shot) => setShots((current) => [...current, { ...shot, id: `local-${current.length + 1}` }]),
      holes,
      setStrokes: (hole, strokes) =>
        setHoles((current) => current.map((value, index) => (index === hole - 1 ? strokes : value))),
      profiles: [...(SHELL?.profiles ?? []), ...buildProfiles(observations)],
      score: scoreRound(entered),
    };
  }, [shots, holes, clubs, bagMessage]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocalStore(): LocalStore {
  const value = useContext(Ctx);
  if (!value) throw new Error('Local store missing');
  return value;
}
