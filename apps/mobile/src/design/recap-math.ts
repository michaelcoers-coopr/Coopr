export interface RecapHole {
  par: number | null;
  strokes: number | null;
  putts: number | null;
  fairway: string | null;
  gir: boolean | null;
}

function versus(diff: number): string {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : String(diff);
}

export function recapSummary(holes: readonly RecapHole[]) {
  let gross = 0;
  let parSum = 0;
  let scored = 0;
  let puttSum = 0;
  let fairwayHits = 0;
  let fairwayHoles = 0;
  let girHits = 0;
  let girHoles = 0;
  const front = { strokes: 0, par: 0, scored: 0 };
  const back = { strokes: 0, par: 0, scored: 0 };
  holes.forEach((hole, index) => {
    const par = hole.par;
    if (hole.strokes == null || par == null) return;
    scored += 1;
    gross += hole.strokes;
    parSum += par;
    const side = index < 9 ? front : back;
    side.strokes += hole.strokes;
    side.par += par;
    side.scored += 1;
    if (hole.putts != null) puttSum += hole.putts;
    if (par >= 4) {
      fairwayHoles += 1;
      if (hole.fairway === 'hit') fairwayHits += 1;
    }
    girHoles += 1;
    if (hole.gir === true) girHits += 1;
  });
  const headline = scored === 0 ? 'No score saved' : `Gross ${gross} · ${versus(gross - parSum)}`;
  const nines = `Front ${front.scored ? front.strokes : '—'} (${versus(front.strokes - front.par)}) · Back ${back.scored ? back.strokes : '—'} (${versus(back.strokes - back.par)})`;
  return { headline, nines, putts: `Putts ${puttSum}`, fairways: `Fairways ${fairwayHits} of ${fairwayHoles}`, greens: `Greens ${girHits} of ${girHoles}`, scored };
}
