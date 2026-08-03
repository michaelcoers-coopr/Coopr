import type {
  CoachAnswer, CoachContext, CoachTopic, CoachBullet, Club, ClubProfile,
} from '@coopr/core';

// Deterministic "Ask COOPR" coach. Classifies the question by keywords and answers
// entirely from the engines' output — practice priorities, bag intelligence, Golf IQ,
// and club profiles. It never invents a number or a club choice. A LanguageProvider can
// rewrite these answers conversationally; the facts here stay fixed.

export const SUGGESTED_QUESTIONS = [
  'What should I work on?',
  'What clubs need work?',
  'What equipment should I get?',
  "What's wrong with my bag?",
  'How far do I hit my 7 iron?',
  "What's my best club?",
  "How's my game overall?",
];

function classify(q: string): CoachTopic {
  const s = q.toLowerCase();
  if (/(how far|carry|distance|how long|yardage)/.test(s) || /\b(\d\s?i(ron)?|driver|wedge|hybrid|pw|aw|\d{2}°)\b/.test(s)) {
    if (/(equipment|buy|replace|upgrade|get|purchase|new)/.test(s)) return 'equipment';
    if (/(how far|carry|distance|how long|yardage)/.test(s)) return 'club_distance';
  }
  if (/(work on|practice|improve|priorit|focus|better|weak)/.test(s)) return 'practice';
  if (/(equipment|buy|replace|upgrade|purchase|new club|what club should i (get|buy)|shaft|fitting)/.test(s)) return 'equipment';
  if (/(bag|gap|overlap|14 club|too many|redundan)/.test(s)) return 'bag';
  if (/(best|most reliable|strength|good at|trust)/.test(s)) return 'strengths';
  if (/(overall|golf iq|my game|how am i|assessment|score)/.test(s)) return 'overview';
  return 'help';
}

function findClub(q: string, clubs: Club[]): Club | null {
  const s = q.toLowerCase();
  for (const c of clubs) {
    const label = c.label.toLowerCase();
    if (s.includes(label)) return c;
    const m = label.match(/^(\d)i$/); // "7i" -> "7 iron"
    if (m && (s.includes(`${m[1]} iron`) || s.includes(`${m[1]}-iron`))) return c;
    if (c.type === 'driver' && s.includes('driver')) return c;
    if (label === 'pw' && s.includes('pitching wedge')) return c;
  }
  return null;
}

function bestProfileFor(clubId: string, profiles: ClubProfile[]): ClubProfile | null {
  return profiles.filter((p) => p.clubId === clubId).sort((a, b) => b.sampleSize - a.sampleSize)[0] ?? null;
}

const answer = (
  topic: CoachTopic, title: string, paragraphs: string[], bullets: CoachBullet[], followUps: string[],
): CoachAnswer => ({ topic, title, paragraphs, bullets, followUps, grounded: true });

export function askCoach(question: string, ctx: CoachContext): CoachAnswer {
  const topic = classify(question);
  const { assessment, bag, profiles, clubs } = ctx;

  if (topic === 'practice') {
    const pri = assessment.practicePriorities;
    const weakest = [...assessment.components].sort((a, b) => a.score - b.score)[0];
    const bullets: CoachBullet[] = pri.map((p) => ({ label: p.clubLabel, detail: p.reason }));
    const lead = pri[0]
      ? `Start with your ${pri[0].clubLabel} — ${pri[0].reason.toLowerCase()} It's your biggest scoring leak, so reps there pay off fastest.`
      : 'Log a few sessions and I can rank exactly what to work on.';
    return answer(
      'practice',
      'What to work on',
      [lead, weakest ? `Your weakest area right now is ${weakest.label.toLowerCase()} (${weakest.score}/100). ${weakest.rationale}` : ''],
      bullets,
      ['What clubs need work?', "What's my best club?", "How's my game overall?"],
    );
  }

  if (topic === 'equipment') {
    const test = bag.clubReports.filter((r) => r.status === 'test' || r.status === 'replace');
    const remove = bag.clubReports.filter((r) => r.status === 'remove');
    const bullets: CoachBullet[] = [
      ...test.map((r) => ({ label: `Test ${r.clubLabel}`, detail: r.reasons[0] ?? '' })),
      ...remove.map((r) => ({ label: `Drop ${r.clubLabel}`, detail: r.reasons[0] ?? '' })),
    ];
    const lead = test.length
      ? `From your own data, the clubs worth testing are ${test.map((r) => r.clubLabel).join(', ')}. These are directions to test — a forgiving alternative in the same slot — not a verdict on a specific model.`
      : 'Your gaps look reasonable from the data I have — nothing screams "replace" yet.';
    return answer(
      'equipment',
      'Equipment direction',
      [
        lead,
        'For specific current models, prices, and shaft profiles, COOPR runs a live market research pass — that turns on when equipment research is enabled (needs internet). Until then I stick to what your numbers justify: categories and profiles to test, and professional fitting as the final step.',
      ],
      bullets,
      ["What's wrong with my bag?", 'What should I work on?'],
    );
  }

  if (topic === 'bag') {
    const inv = bag.gaps.filter((g) => g.kind === 'inversion');
    const ov = bag.gaps.filter((g) => g.kind === 'overlap');
    const big = bag.gaps.filter((g) => g.kind === 'large_gap');
    const bullets: CoachBullet[] = [
      ...inv.map((g) => ({ label: `${g.longerLabel} / ${g.shorterLabel}`, detail: `Inverted — ${g.shorterLabel} carries farther. Verify strike/lofts.` })),
      ...ov.map((g) => ({ label: `${g.longerLabel} / ${g.shorterLabel}`, detail: `Overlap (~${Math.abs(g.gapYards)} yд apart) — you may only need one.` })),
      ...big.map((g) => ({ label: `${g.longerLabel} → ${g.shorterLabel}`, detail: `${Math.round(g.gapYards)} yд gap — a club may be missing.` })),
    ];
    const lead = bullets.length
      ? `Your bag has ${inv.length} inversion(s), ${ov.length} overlap(s), and ${big.length} large gap(s). By your performance, an ideal set is about ${bag.carryCount} clubs.`
      : `Your gapping looks clean — about ${bag.carryCount} clubs carry their weight.`;
    return answer('bag', 'Your bag, examined', [lead], bullets, ['What equipment should I get?', 'What should I work on?']);
  }

  if (topic === 'club_distance') {
    const club = findClub(question, clubs);
    const p = club ? bestProfileFor(club.id, profiles) : null;
    if (!club || !p) {
      return answer(
        'club_distance', 'Club distance',
        ['Tell me which club — e.g. "how far do I hit my 7 iron?" — and I\'ll give your stock number and honest spread.'],
        [], SUGGESTED_QUESTIONS.slice(0, 3),
      );
    }
    const q = p.metric === 'carry' ? p.carry : p.total;
    const spread = q ? `Your typical spread runs ${Math.round(q.p20)}–${Math.round(q.p80)} ${p.metric}.` : '';
    return answer(
      'club_distance', `${club.label} distance`,
      [
        `Your ${club.label} stock ${p.metric} is about ${Math.round(p.stockDistanceYards)} yд — that's the median of ${p.sampleSize} shots, not your best one. ${spread}`,
        `Short-miss rate ${Math.round(p.shortMissRate * 100)}%, confidence ${Math.round(p.confidence * 100)}%. ${p.confidence < 0.4 ? 'That confidence is low — log more shots to tighten it.' : 'That number is reasonably trustworthy.'}`,
      ],
      [],
      ['What should I work on?', "What's my best club?"],
    );
  }

  if (topic === 'strengths') {
    const reliable = bag.clubReports
      .filter((r) => r.status === 'keep' && r.stockYards != null)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    const bullets: CoachBullet[] = reliable.map((r) => ({
      label: r.clubLabel, detail: `~${Math.round(r.stockYards!)} yд · confidence ${Math.round(r.confidence * 100)}%`,
    }));
    const lead = reliable[0]
      ? `Your most trusted club is your ${reliable[0].clubLabel}. Lean on it when you need a shot you can count on.`
      : 'Log a full-bag session and I can tell you which club to trust under pressure.';
    return answer('strengths', 'What you can trust', [lead], bullets, ['What should I work on?', "What's wrong with my bag?"]);
  }

  if (topic === 'overview') {
    const top = assessment.insights[0];
    return answer(
      'overview', 'Your game right now',
      [
        `Your Golf IQ is ${assessment.overallScore}/100 (${assessment.grade}), built from ${assessment.baselineCompleteness < 1 ? 'a partial' : 'a full'} baseline.`,
        top ? top.text : 'Add sessions across every category to complete the picture.',
      ],
      assessment.components.map((c) => ({ label: c.label, detail: `${c.score}/100` })),
      ['What should I work on?', 'What equipment should I get?'],
    );
  }

  // help / unknown
  return answer(
    'help', 'Ask me about your game',
    ["I work off your actual numbers, not vibes — practice priorities, club distances, bag gaps, gear direction. Ask away, or tap one below and pretend it was your idea:"],
    [],
    SUGGESTED_QUESTIONS,
  );
}
