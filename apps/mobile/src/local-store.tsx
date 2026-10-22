import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { EnvironmentName } from '@coopr/domain';
import { buildProfiles, scoreRound, type DistanceObservation, type DistanceProfile } from '@coopr/engine';

export interface LocalShot {
  id: string;
  clubLabel: string;
  environment: EnvironmentName;
  swingMode: string;
  carry: number | null;
  total: number | null;
}

interface LocalStore {
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
    return {
      shots,
      addShot: (shot) => setShots((current) => [...current, { ...shot, id: `local-${current.length + 1}` }]),
      holes,
      setStrokes: (hole, strokes) =>
        setHoles((current) => current.map((value, index) => (index === hole - 1 ? strokes : value))),
      profiles: buildProfiles(observations),
      score: scoreRound(entered),
    };
  }, [shots, holes]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocalStore(): LocalStore {
  const value = useContext(Ctx);
  if (!value) throw new Error('Local store missing');
  return value;
}
