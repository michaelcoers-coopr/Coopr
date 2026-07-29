// The Golf IQ baseline assessment. Computed deterministically by the engine from the
// player's club profiles — the "AI genius" is the math, not a language model. A
// LanguageProvider may later narrate it, but every number and priority here is
// reproducible and offline.

export type IqComponentKey =
  | 'consistency'
  | 'gapping'
  | 'predictability'
  | 'long_game'
  | 'short_game';

export interface IqComponent {
  key: IqComponentKey;
  label: string;
  score: number; // 0..100
  rationale: string;
}

export interface IqInsight {
  code: string;
  severity: 'info' | 'watch' | 'priority';
  text: string;
  clubIds: string[];
}

export interface GapAnomaly {
  kind: 'inversion' | 'overlap' | 'large_gap';
  // The club that SHOULD be longer vs the club that should be shorter, by loft order.
  longerClubId: string;
  longerClubLabel: string;
  shorterClubId: string;
  shorterClubLabel: string;
  gapYards: number; // shorter-should-be stock minus longer-should-be stock
}

export interface PracticePriority {
  clubId: string;
  clubLabel: string;
  leakScore: number; // 0..1, higher = bigger scoring leak
  reason: string;
}

export interface CategoryCoverage {
  category: 'driver' | 'woods_hybrids' | 'irons' | 'wedges';
  clubsWithData: number;
  adequate: boolean; // enough shots to be meaningful
}

export interface GolfIqAssessment {
  overallScore: number; // 0..100
  grade: string;
  components: IqComponent[];
  insights: IqInsight[]; // ranked, most important first
  gapAnomalies: GapAnomaly[];
  practicePriorities: PracticePriority[];
  coverage: CategoryCoverage[];
  baselineCompleteness: number; // 0..1
  confidence: number; // 0..1, data-backed confidence in the assessment
  disclaimers: string[];
}
