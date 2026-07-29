import type { Club, CategoryCoverage } from '@coopr/core';

// Shared club ordering + categorization. Used by the Golf IQ and Bag Intelligence
// engines to reason about gapping. `distanceRank` is a loft-ordered heuristic — lower
// rank = the club that should carry FARTHER. It never sets distances, only orders them.
export function distanceRank(club: Club): number | null {
  if (club.type === 'putter') return null;
  const label = club.label.toUpperCase();
  const numMatch = label.match(/(\d+)/);
  const num = numMatch ? Number(numMatch[1]) : null;
  switch (club.type) {
    case 'driver':
      return 0;
    case 'wood':
      return 5 + (num ?? 3);
    case 'hybrid':
      return 20 + (num ?? 3);
    case 'utility':
      return 38;
    case 'iron':
      if (label === 'PW') return 50;
      if (label === 'AW' || label === 'GW') return 52;
      return 40 + (num ?? 6);
    case 'wedge':
      return 60 + (club.loftDeg ?? 54);
    default:
      return 99;
  }
}

export function category(club: Club): CategoryCoverage['category'] | null {
  if (club.type === 'driver') return 'driver';
  if (club.type === 'wood' || club.type === 'hybrid' || club.type === 'utility') return 'woods_hybrids';
  if (club.type === 'iron') return 'irons';
  if (club.type === 'wedge') return 'wedges';
  return null;
}
