/** "Where you lose strokes" ranking and "one thing to fix next round". */
import type { Config, Confidence, Insight, LedgerItem } from './types';
import { confidenceFor, ready, weakestQuality } from './gate';
import type { LedgerValue, BlowupValue, ThreePuttValue, PenaltyValue, FairwayValue } from './holes';
import { numFmt } from './holes';
import type { SgValue } from './shots';
import { round2 } from './stats';

export interface RankItem {
  id: string;
  label: string;
  strokesPer18: number;
  confidence: Confidence;
}
export interface Ranking {
  method: 'par_allotment' | 'strokes_gained';
  baselineLabel: string;
  /** Losses first, biggest to smallest. Gains (negative) are returned in `strengths`. */
  losses: RankItem[];
  strengths: RankItem[];
  /** Always shown with the ranking. */
  caveat: string;
}

/**
 * Uses true strokes gained only when a tour or handicap-band baseline was supplied AND enough tracked shots exist.
 * A "vs your own average" profile is NOT a ranking of where you lose strokes (it nets to ~0 by construction),
 * so it never replaces the scorecard ledger.
 */
export function rankLosses(ledgerIns: Insight<LedgerValue>, sgIns: Insight<SgValue> | null): Insight<Ranking> | null {
  if (sgIns && sgIns.status === 'ready' && sgIns.value!.absolute) {
    const cats = sgIns.value!.categories.filter((c) => c.sgPer18 !== null);
    if (cats.length >= 3) {
      const items: RankItem[] = cats.map((c) => ({ id: c.id, label: c.label, strokesPer18: round2(-c.sgPer18!), confidence: c.confidence }));
      const losses = items.filter((i) => i.strokesPer18 > 0).sort((a, b) => b.strokesPer18 - a.strokesPer18);
      const strengths = items.filter((i) => i.strokesPer18 <= 0).sort((a, b) => a.strokesPer18 - b.strokesPer18);
      return { ...sgIns, id: 'ranking', title: 'Where you lose strokes', value: { method: 'strokes_gained', baselineLabel: sgIns.value!.baselineName, losses, strengths, caveat: `Measured against ${sgIns.value!.baselineName}. Not a verdict on you, a yardstick.` }, numbers: [...sgIns.numbers] };
    }
  }
  if (ledgerIns.status !== 'ready') return { ...ledgerIns, id: 'ranking', value: null } as unknown as Insight<Ranking>;
  const conf = ledgerIns.confidence;
  const items: RankItem[] = ledgerIns.value!.items.map((i: LedgerItem) => ({ id: i.id, label: i.label, strokesPer18: i.strokesPer18, confidence: conf }));
  const losses = items.filter((i) => i.strokesPer18 > 0).sort((a, b) => b.strokesPer18 - a.strokesPer18 || a.id.localeCompare(b.id));
  const strengths = items.filter((i) => i.strokesPer18 <= 0).sort((a, b) => a.strokesPer18 - b.strokesPer18 || a.id.localeCompare(b.id));
  return {
    ...ledgerIns, id: 'ranking', title: 'Where you lose strokes',
    value: { method: 'par_allotment', baselineLabel: "par's own allowance (a 2-putt par)", losses, strengths, caveat: "Measured against par's allowance, not against Tour players or players your handicap. It adds up to your score over par." },
  };
}

// ───────────────────────────── One thing to fix ─────────────────────────────

export type FixId = 'penalties' | 'three_putts' | 'blowups' | 'ttg_par3' | 'ttg_par4' | 'ttg_par5' | 'tee_trouble' | 'approach_short_game';
export interface Candidate {
  id: FixId;
  label: string;
  strokesPer18: number;
  confidence: Confidence;
  score: number;
}
export interface Prescription {
  headline: string;
  strategy: string;
  /** Drill parameters (distances, counts) are coaching prescriptions, not claims about the player. */
  drill: { title: string; steps: string[] };
}
export interface OneFixValue {
  fix: { id: FixId; label: string; shortLabel: string; strokesPer18: number; confidence: Confidence; prescription: Prescription; why: string } | null;
  runnerUp: { id: FixId; label: string; strokesPer18: number } | null;
  candidates: Candidate[];
  rotatedAwayFrom: FixId | null;
  note: string;
}
export interface FixInputs {
  ledger: Insight<LedgerValue>;
  blowups: Insight<BlowupValue>;
  threePutt: Insight<ThreePuttValue>;
  penalties: Insight<PenaltyValue>;
  fairways: Insight<FairwayValue>;
  lastFix?: { id: FixId; strokesPer18: number } | null;
}
const SHORT: Record<FixId, string> = { penalties: 'PENALTIES', three_putts: '3-PUTTS', blowups: 'BLOW-UPS', tee_trouble: 'TEE TROUBLE', approach_short_game: 'APPROACH + SHORT GAME', ttg_par3: 'PAR 3S', ttg_par4: 'PAR 4S', ttg_par5: 'PAR 5S' };
const MIN_LOSS = 0.5; // strokes per 18 below which a "fix" is not worth a lecture (proposed default)
export const REPEAT_DAMPING = 0.6;

export function selectOneFix(inp: FixInputs, cfg: Config): Insight<OneFixValue> {
  const base = inp.ledger;
  if (base.status !== 'ready') {
    const missing = base.missingInputs.length > 0;
    const extra = missing ? ' Until then, the one thing is: log putts and penalties on every hole.' : '';
    return { ...base, id: 'one_fix', title: 'One thing to fix', value: null, take: null,
      invitation: `${base.invitation ?? ''}${extra}`.trim() };
  }
  const L = base.value!;
  const cand: Candidate[] = [];
  const add = (id: FixId, label: string, v: number, conf: Confidence) => {
    if (v >= MIN_LOSS && conf !== 'insufficient') cand.push({ id, label, strokesPer18: round2(v), confidence: conf, score: 0 });
  };
  const get = (id: string) => L.items.find((i) => i.id === id)?.strokesPer18 ?? 0;
  if (inp.penalties.status === 'ready') add('penalties', 'Penalty strokes', get('penalties'), inp.penalties.confidence);
  if (inp.threePutt.status === 'ready') add('three_putts', '3-putts', inp.threePutt.value!.excessPer18, inp.threePutt.confidence);
  if (inp.blowups.status === 'ready') add('blowups', 'Blow-up holes', inp.blowups.value!.bogeyCapSavingPer18, inp.blowups.confidence);
  if (L.split === 'by_outcome') {
    add('tee_trouble', 'Missed greens after missing the fairway', get('ttg_fw_miss'), base.confidence);
    add('approach_short_game', 'Missed greens from the fairway or a par 3', get('ttg_miss_green'), base.confidence);
  } else {
    add('ttg_par3', 'Par 3 greens', get('ttg_par3'), base.confidence);
    add('ttg_par4', 'Par 4s, tee to green', get('ttg_par4'), base.confidence);
    add('ttg_par5', 'Par 5s, tee to green', get('ttg_par5'), base.confidence);
  }
  for (const c of cand) {
    let s = c.strokesPer18 * (cfg.fixability[c.id] ?? 0.5) * cfg.confidenceWeight[c.confidence];
    if (inp.lastFix && inp.lastFix.id === c.id) s *= REPEAT_DAMPING; // rotate so we don't nag the same thing every round
    c.score = round2(s);
  }
  cand.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const args = { id: 'one_fix', title: 'One thing to fix', n: base.n, nUnit: base.nUnit, gate: cfg.gate.ledger!, baseline: 'par_allotment' as const, sample: base.sample, quality: weakestQuality([base.quality]), invitationUnit: { text: '' } };
  const { numbers, f } = numFmt();
  if (cand.length === 0) {
    return ready(args, { fix: null, runnerUp: null, candidates: [], rotatedAwayFrom: null, note: 'No leak above the floor.' }, `No single leak is big enough to lecture you about. Play your game and log it. We'll shout when something shows up.`, numbers, base.confidence);
  }
  const top = cand[0]!;
  const second = cand[1] ?? null;
  const rotated = inp.lastFix && cand.find((c) => c.id === inp.lastFix!.id) && top.id !== inp.lastFix.id ? inp.lastFix.id : null;
  const rx = prescribe(top.id, inp, f);
  const why = `${top.label}: ${f(top.strokesPer18)} strokes a round on your last ${f(base.n / 18, 0)} rounds' worth of holes.`;
  return ready(args, {
    fix: { id: top.id, label: top.label, shortLabel: SHORT[top.id], strokesPer18: top.strokesPer18, confidence: top.confidence, prescription: rx, why },
    runnerUp: second ? { id: second.id, label: second.label, strokesPer18: second.strokesPer18 } : null,
    candidates: cand, rotatedAwayFrom: rotated,
    note: 'Ranked by strokes lost x how fixable it is x how sure we are. Fixability weights are COOPR coaching judgments, not measured.',
  }, rx.headline + ' ' + why, numbers, top.confidence);
}

function prescribe(id: FixId, inp: FixInputs, f: (x: number, d?: number) => string): Prescription {
  switch (id) {
    case 'penalties': {
      const repeat = inp.penalties.value?.repeatHoles[0];
      return {
        headline: repeat ? `Next round: safe club off the tee on hole ${f(repeat.hole, 0)}, and any tee where trouble has already cost you.` : 'Next round: before every tee shot, name the trouble and pick the club that stays short of it.',
        strategy: 'Penalties are the only strokes that need zero skill to avoid. Take the club you can keep in play (hybrid, 3-wood, long iron) on any hole where you have lost a ball before. Aim at the fat side, not the pin side.',
        drill: { title: 'Find your safe club', steps: ['Range: hit 10 balls with each of driver, 3-wood and hybrid at one target.', 'Count how many stay inside a fairway-wide corridor.', 'The club that stays in the most is your "trouble club". Write it on the scorecard and use it when trouble is in play.'] },
      };
    }
    case 'three_putts':
      return {
        headline: 'Next round: first putt is a lag, not an attempt. Get it inside three feet.',
        strategy: 'On any putt longer than about 20 feet, your only job is a two-putt. Pick a spot three feet past the hole, and walk up and read the slope from the low side.',
        drill: { title: 'Lag ladder', steps: ['Before you tee off: 3 balls each from 20, 30 and 40 feet.', 'Every ball must finish inside a dinner-plate circle around the hole (about 3 feet).', 'Do not leave until 6 of 9 do.'] },
      };
    case 'blowups':
      return {
        headline: 'Next round: after trouble, the next shot is about getting back in play. Bogey is a win.',
        strategy: 'A double usually starts as a bogey that you tried to fix with a hero shot. After a penalty or bad lie, take the safe route back to the fairway and play for a bogey.',
        drill: { title: 'Bogey-is-fine ledger', steps: ['Write "BOGEY OK" on your glove or scorecard.', 'Every time you take the safe option after trouble, put a tick on the card.', 'Goal: more ticks than blow-ups at the end of the round.'] },
      };
    case 'tee_trouble':
      return {
        headline: inp.fairways.status === 'ready' && inp.fairways.value!.dominantMiss
          ? `Next round: when you miss the fairway you tend to miss the green too. Aim a little ${inp.fairways.value!.dominantMiss.side === 'right' ? 'left' : 'right'} off the tee and put the safer club in your hand.`
          : 'Next round: when you miss the fairway you tend to miss the green too. Take the club that finds the fairway, even if it is short.',
        strategy: 'A missed fairway turns a par 4 into a recovery shot. A 3-wood in the fairway beats a driver in the trees every time. Keep the ball in play first, then play to the middle of the green.',
        drill: { title: 'Fairway finder', steps: ['Range: 10 balls with your tee club at a corridor target.', 'Note which side the misses go.', 'On the course, tee up on the miss side to open the angle and aim away from it.'] },
      };
    case 'approach_short_game':
      return {
        headline: 'Next round: aim every approach at the middle of the green, and chip to the fat side of the hole.',
        strategy: 'These are holes where the tee shot was fine and the green still got missed. Pick the club for the center of the green. When you miss, leave yourself the easiest chip, not the flag.',
        drill: { title: 'Up-and-down ladder', steps: ['Drop 9 balls around a green at different lies.', 'Chip each to inside a club length and then putt out.', 'Score = number of up-and-downs. Beat it next week.'] },
      };
    case 'ttg_par3':
      return {
        headline: 'Next round: on every par 3, aim at the middle of the green and take the club for that number.',
        strategy: 'Pins are for people with a lag wedge and a plan. Pick the club for the center of the green and ignore the flag. A 30-foot putt beats a bunker shot.',
        drill: { title: 'Center-of-the-green habit', steps: ['At each par 3, read the center number (not the pin number).', 'Pick the club for that number and commit to it.', 'Log GIR yes or no. If you miss, note which side.'] },
      };
    case 'ttg_par4':
      return {
        headline: inp.fairways.status === 'ready' && inp.fairways.value!.dominantMiss
          ? `Next round: on par 4s, aim a little ${inp.fairways.value!.dominantMiss.side === 'right' ? 'left' : 'right'} of the center and let your ${inp.fairways.value!.dominantMiss.side} miss land in the fairway.`
          : 'Next round: on par 4s, pick the club that finds the fairway and play the approach to the middle of the green.',
        strategy: 'Par 4 trouble comes from either a poor tee shot or a hero approach. Fairway first, then middle of the green. Two decent shots and a two-putt is a bogey you can live with and a par waiting to happen.',
        drill: { title: 'Fairway finder', steps: ['Range: 10 balls with your tee club at a corridor target.', 'Note which side the misses go.', 'On the course, tee up on that side to open the angle and aim away from the miss.'] },
      };
    case 'ttg_par5':
      return {
        headline: 'Next round: treat every par 5 as three shots. Pick your layup number before you tee off.',
        strategy: 'Par 5s are where hero swings turn pars into sixes. Choose the layup distance that leaves your favorite wedge number and play to it, unless you have a measured club that carries the trouble.',
        drill: { title: 'Pick your number', steps: ['Find your most reliable wedge distance on the range.', 'On each par 5, subtract it from the yardage to get your layup spot.', 'Log the result: did the plan beat going for it?'] },
      };
  }
}
