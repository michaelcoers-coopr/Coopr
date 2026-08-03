import { STANDARD_BAG, AVG_CARRY, BAND_DISPERSION } from '@coopr/core';
import { ensureActiveBag, ensureClub } from './bag-writer';
import { saveBaselineSession, type NewShot } from './session-writer';

// Generates an ESTIMATED bag for a handicap band: a standard set with ~12 synthetic
// carries per club around the band's average, with a realistic spread and short-miss
// rate. Every shot is source='estimate' and clearly labeled in the UI — it lets the
// whole app work immediately and gets replaced the moment the golfer logs real shots.

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng: () => number): number {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function quickStartWithHandicap(userId: string, band: string): void {
  const avg = AVG_CARRY[band];
  const disp = BAND_DISPERSION[band];
  if (!avg || !disp) return;

  const bagId = ensureActiveBag(userId);
  const shots: NewShot[] = [];

  const N = 12;
  for (const c of STANDARD_BAG) {
    const clubId = ensureClub(bagId, { label: c.label, type: c.type, loftDeg: c.loftDeg ?? null });
    if (c.type === 'putter') continue;
    const mean = avg[c.label];
    if (mean == null) continue;
    const rng = mulberry32(hashSeed(`${band}:${c.label}`));
    const nShort = Math.round(N * disp.shortMissRate);
    // Good strikes as antithetic gaussian pairs (g and −g): the multiset is symmetric
    // about the mean, so the median is EXACTLY the band's average — no small-sample bias.
    const carries: number[] = [];
    for (let i = 0; i < N; i += 2) {
      const g = gauss(rng) * disp.relSpread;
      carries.push(mean * (1 + g));
      carries.push(mean * (1 - g));
    }
    // Deepen the lowest nShort strikes into real short-misses — chunks / thin ones that
    // come up 15–40% short. They stay in the lower tail BELOW the median, so the stock
    // number is unmoved: honest bad-shot spread without dragging down the average.
    carries.sort((a, b) => a - b);
    for (let i = 0; i < nShort; i++) {
      carries[i] = mean * (1 - (0.15 + rng() * 0.25));
    }
    for (const raw of carries) {
      const carry = Math.max(10, Math.round(raw * 10) / 10);
      shots.push({ clubId, clubLabel: c.label, loftDeg: c.loftDeg ?? null, carryYards: carry, source: 'estimate' });
    }
  }

  saveBaselineSession({ userId, category: 'estimate', environment: 'range', shots });
}
