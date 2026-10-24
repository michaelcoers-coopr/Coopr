import { quotedProfile, type DistanceProfile } from './profile';
import { recommend } from './caddie';
import { playsLike } from './phase2';
import { conditionAnswer, parseAsk, type AskMiss } from './voice';

/** Chill is short. Chirpy is the default. Neither may invent a number. */
export type TalkPersona = 'chirpy' | 'chill';

export type TalkPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface TalkClub {
  clubId: string;
  clubLabel: string;
  /** Median carry. Null when this club has no carry sample. */
  carryYards: number | null;
  /** Median total. Null when this club has no total sample. Carry is never copied here. */
  totalYards: number | null;
  /** P80 minus P20, only when dispersion was measured. Null stays null. */
  dispersionYards: number | null;
  sampleSize: number | null;
}

export interface TalkTurn {
  role: 'player' | 'caddie';
  text: string;
}

export interface TalkContext {
  hole: number;
  par: number | null;
  atTee: boolean;
  /** Ground yards to the green center. Null without a GPS fix. */
  gpsYards: number | null;
  frontYards: number | null;
  backYards: number | null;
  /** Null until wind, elevation, and temperature are all known. */
  playsLikeYards: number | null;
  windYards: number | null;
  elevationYards: number | null;
  temperatureYards: number | null;
  playsLikeMissing: string[];
  headwindMph: number | null;
  elevationFeet: number | null;
  temperatureF: number | null;
  windMph: number | null;
  clubs: TalkClub[];
  profiles: readonly DistanceProfile[];
  selectedClubId: string | null;
  selectedClubLabel: string | null;
  scoreStrokes: number | null;
  scorePutts: number | null;
  thruLabel: string | null;
  persona: TalkPersona;
  turns: TalkTurn[];
  /** The sentence already on the card. A club question repeats it so the reply cannot name another club. */
  cardLine: string | null;
}

export interface TalkContextInput {
  hole: number;
  par: number | null;
  atTee?: boolean;
  gpsYards: number | null;
  frontYards?: number | null;
  backYards?: number | null;
  headwindMph?: number | null;
  elevationFeet?: number | null;
  temperatureF?: number | null;
  windMph?: number | null;
  profiles?: readonly DistanceProfile[];
  candidateClubIds?: readonly string[];
  selectedClubId?: string | null;
  selectedClubLabel?: string | null;
  scoreStrokes?: number | null;
  scorePutts?: number | null;
  thruLabel?: string | null;
  persona?: TalkPersona;
  turns?: readonly TalkTurn[];
  cardLine?: string | null;
}

export const TALK_TOOLS = ['get_plays_like', 'recommend_club', 'log_score', 'set_club', 'mark_shot'] as const;
export type TalkToolName = (typeof TALK_TOOLS)[number];

export interface TalkAction {
  tool: 'log_score' | 'set_club' | 'mark_shot' | 'next_hole';
  strokes?: number;
  putts?: number;
  clubId?: string;
  miss?: AskMiss;
}

export interface TalkToolResult {
  name: string;
  ok: boolean;
  data: Record<string, unknown>;
  action: TalkAction | null;
  line: string;
}

export interface TalkReply {
  mode: 'sample' | 'live';
  line: string;
  sentences: string[];
  tools: TalkToolResult[];
  /** Sample mode did not call a model. */
  heard: boolean;
}

export interface TalkMachine {
  phase: TalkPhase;
  handsFree: boolean;
  /** True only when speech in progress must be cut off. */
  stopSpeech: boolean;
}

const TURN_LIMIT = 6;
const OUT_OF_REACH_YARDS = 40;

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function clubHead(label: string): string {
  return label.split('·')[0]?.trim() || label;
}

function roundYards(value: number): number {
  return Math.round(value);
}

function profileDispersion(profile: DistanceProfile): number | null {
  if (!profile.dispersionKnown) return null;
  if (!Number.isFinite(profile.p20) || !Number.isFinite(profile.p80)) return null;
  return roundYards(profile.p80 - profile.p20);
}

function clubsFromProfiles(profiles: readonly DistanceProfile[], candidateClubIds: readonly string[] | undefined): TalkClub[] {
  const ids = new Set<string>();
  for (const profile of profiles) ids.add(profile.clubId);
  for (const id of candidateClubIds ?? []) ids.add(id);
  const clubs: TalkClub[] = [];
  for (const clubId of ids) {
    const rows = profiles.filter((profile) => profile.clubId === clubId);
    const carry = rows.find((profile) => profile.metric === 'carry' && profile.blended) ?? rows.find((profile) => profile.metric === 'carry');
    const total = rows.find((profile) => profile.metric === 'total' && profile.blended) ?? rows.find((profile) => profile.metric === 'total');
    const label = carry?.clubLabel ?? total?.clubLabel ?? clubId;
    const sized = carry ?? total;
    clubs.push({
      clubId,
      clubLabel: clubHead(label),
      carryYards: carry ? finiteOrNull(carry.stockYards) : null,
      totalYards: total ? finiteOrNull(total.stockYards) : null,
      dispersionYards: carry ? profileDispersion(carry) : total ? profileDispersion(total) : null,
      sampleSize: sized ? sized.sampleSize : null,
    });
  }
  return clubs;
}

/** The model sees this. Profiles stay on the server copy for tool calls and are not a license to invent. */
export function talkPromptView(context: TalkContext): Record<string, unknown> {
  return {
    hole: context.hole,
    par: context.par,
    atTee: context.atTee,
    gpsYards: context.gpsYards,
    frontYards: context.frontYards,
    backYards: context.backYards,
    playsLikeYards: context.playsLikeYards,
    windYards: context.windYards,
    elevationYards: context.elevationYards,
    temperatureYards: context.temperatureYards,
    playsLikeMissing: context.playsLikeMissing,
    windMph: context.windMph,
    temperatureF: context.temperatureF,
    clubs: context.clubs,
    selectedClubId: context.selectedClubId,
    selectedClubLabel: context.selectedClubLabel,
    scoreStrokes: context.scoreStrokes,
    scorePutts: context.scorePutts,
    thruLabel: context.thruLabel,
    persona: context.persona,
    turns: context.turns,
    cardLine: context.cardLine,
  };
}

export function buildTalkContext(input: TalkContextInput): TalkContext {
  const gpsYards = finiteOrNull(input.gpsYards);
  const headwindMph = finiteOrNull(input.headwindMph);
  const elevationFeet = finiteOrNull(input.elevationFeet);
  const temperatureF = finiteOrNull(input.temperatureF);
  const sky =
    gpsYards != null && gpsYards > 0
      ? playsLike({ rawYards: gpsYards, headwindMph, elevationFeet, temperatureF })
      : null;
  const computed = sky && !('error' in sky) ? sky : null;
  const turns = (input.turns ?? [])
    .filter((turn) => (turn.role === 'player' || turn.role === 'caddie') && turn.text.trim().length > 0)
    .slice(-TURN_LIMIT)
    .map((turn) => ({ role: turn.role, text: turn.text.trim() }));
  return {
    hole: Number.isFinite(input.hole) ? input.hole : 0,
    par: finiteOrNull(input.par),
    atTee: input.atTee === true,
    gpsYards: gpsYards != null && gpsYards > 0 ? gpsYards : null,
    frontYards: finiteOrNull(input.frontYards),
    backYards: finiteOrNull(input.backYards),
    playsLikeYards: computed?.playsLikeYards ?? null,
    windYards: computed?.wind?.yards ?? null,
    elevationYards: computed?.elevation?.yards ?? null,
    temperatureYards: computed?.temperature?.yards ?? null,
    playsLikeMissing: computed?.missing ?? (gpsYards == null ? ['distance'] : ['wind', 'elevation', 'temperature']),
    headwindMph,
    elevationFeet,
    temperatureF,
    windMph: finiteOrNull(input.windMph),
    clubs: clubsFromProfiles(input.profiles ?? [], input.candidateClubIds),
    profiles: input.profiles ?? [],
    selectedClubId: input.selectedClubId ?? null,
    selectedClubLabel: input.selectedClubLabel ? clubHead(input.selectedClubLabel) : null,
    scoreStrokes: finiteOrNull(input.scoreStrokes),
    scorePutts: finiteOrNull(input.scorePutts),
    thruLabel: input.thruLabel?.trim() ? input.thruLabel.trim() : null,
    persona: input.persona === 'chill' ? 'chill' : 'chirpy',
    turns,
    cardLine: input.cardLine?.trim() ? input.cardLine.trim() : null,
  };
}

/**
 * The club sentence for a known stock and the same target the card uses.
 * Short stays short. "Grip it and rip it" is only for a club that is not short.
 */
export function clubSituationLine(input: {
  persona: TalkPersona;
  clubLabel: string | null;
  stockYards: number | null;
  targetYards: number | null;
}): string | null {
  if (!input.clubLabel || input.stockYards == null || input.targetYards == null) return null;
  if (!Number.isFinite(input.stockYards) || !Number.isFinite(input.targetYards)) return null;
  const stock = roundYards(input.stockYards);
  const target = roundYards(input.targetYards);
  const gap = stock - target;
  const name = clubHead(input.clubLabel);
  if (input.persona === 'chill') {
    if (gap <= -5) return `You're ${target} out. ${name} gets you to about ${stock}, so you'll need another shot.`;
    return `${name}. ${target}.`;
  }
  if (gap <= -5) {
    const short = target - stock;
    return `Short is dead. ${name} is ${short} ${short === 1 ? 'yard' : 'yards'} short of ${target}.`;
  }
  if (gap >= 15) return `That's a lot of club. ${name} covers ${target} by ${gap} ${gap === 1 ? 'yard' : 'yards'}.`;
  return `Grip it and rip it. ${name}, ${target}.`;
}

function playsLikeLine(context: TalkContext, playsLikeYards: number | null, raw: number | null): string {
  if (raw == null) return 'Plays-like needs a distance. Nothing was guessed.';
  if (playsLikeYards == null) return 'Plays-like stays blank until wind, elevation, and temperature are known.';
  const shot = roundYards(raw);
  const plays = roundYards(playsLikeYards);
  if (context.persona === 'chill') return `Plays like ${plays}. The shot is ${shot}.`;
  return `It plays ${plays}. The ground is ${shot}.`;
}

function clubLine(persona: TalkPersona, club: string | null, yards: number | null): string {
  if (!club || yards == null || !Number.isFinite(yards)) return 'A number is missing, so nothing was called.';
  const card = roundYards(yards);
  if (persona === 'chill') return `${club}. ${card}.`;
  return `Grip it and rip it. ${club}, ${card}.`;
}

function teeLine(persona: TalkPersona, par: number, club: string): string {
  const shownPar = roundYards(par);
  if (persona === 'chill') return `Par ${shownPar}. ${club} will not reach the green.`;
  return `Par ${shownPar}. Nobody's getting home. ${club}, find the short grass.`;
}

export function runTalkTool(name: string, args: unknown, context: TalkContext): TalkToolResult {
  const record = typeof args === 'object' && args != null ? (args as Record<string, unknown>) : {};
  if (name === 'get_plays_like') {
    const raw = context.gpsYards;
    const sky =
      raw != null
        ? playsLike({
            rawYards: raw,
            headwindMph: context.headwindMph,
            elevationFeet: context.elevationFeet,
            temperatureF: context.temperatureF,
          })
        : null;
    const computed = sky && !('error' in sky) ? sky : null;
    const playsLikeYards = computed?.playsLikeYards ?? null;
    return {
      name,
      ok: true,
      action: null,
      data: {
        playsLikeYards,
        rawYards: raw,
        windYards: computed?.wind?.yards ?? null,
        elevationYards: computed?.elevation?.yards ?? null,
        temperatureYards: computed?.temperature?.yards ?? null,
        missing: computed?.missing ?? ['distance'],
      },
      line: playsLikeLine(context, playsLikeYards, raw),
    };
  }

  if (name === 'recommend_club') {
    const distance = context.playsLikeYards ?? context.gpsYards;
    const target = distance == null ? null : roundYards(distance);
    const selected = quotedProfile(context.profiles, context.selectedClubId);
    if (target != null && selected) {
      const label = clubHead(selected.clubLabel);
      const line =
        clubSituationLine({ persona: context.persona, clubLabel: label, stockYards: selected.stockYards, targetYards: target }) ??
        clubLine(context.persona, label, target);
      return {
        name,
        ok: true,
        action: null,
        data: { clubId: selected.clubId, clubLabel: label, yards: target, dispersionYards: null },
        line,
      };
    }
    const totals = context.profiles.some(
      (profile) => profile.metric === 'total' && profile.sampleSize >= 1 && Number.isFinite(profile.stockYards) && profile.stockYards > 0,
    );
    if (target == null) {
      return {
        name,
        ok: true,
        action: null,
        data: { clubId: null, clubLabel: null, yards: null, dispersionYards: null },
        line: 'No distance yet.',
      };
    }
    const card = recommend({
      targetDistanceYards: target,
      targetMetric: totals ? 'total' : 'carry',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: context.profiles,
      candidateClubIds: context.clubs.map((club) => club.clubId),
      personality: 'direct_analytical',
    });
    const called = card.posture === 'decline' ? null : card.clubLabel ? clubHead(card.clubLabel) : null;
    const partial = card.swingMode === 'partial' && called != null;
    const known = called ? context.clubs.find((club) => club.clubLabel === called || club.clubId === card.clubId) : null;
    const quoted = quotedProfile(context.profiles, called ? card.clubId : null);
    const situation = clubSituationLine({
      persona: context.persona,
      clubLabel: called,
      stockYards: quoted?.stockYards ?? null,
      targetYards: target,
    });
    return {
      name,
      ok: true,
      action: null,
      data: {
        clubId: called ? card.clubId : null,
        clubLabel: called,
        yards: called && !partial ? target : null,
        dispersionYards: known?.dispersionYards ?? null,
      },
      line: partial || !called ? card.lines.reason.replace(/^Declining\.\s*/, '') : situation ?? clubLine(context.persona, called, target),
    };
  }

  if (name === 'log_score') {
    const strokes = typeof record.strokes === 'number' && record.strokes >= 1 && record.strokes <= 15 ? Math.round(record.strokes) : null;
    const putts = typeof record.putts === 'number' && record.putts >= 0 && record.putts <= 9 ? Math.round(record.putts) : null;
    if (strokes == null && putts == null) {
      return { name, ok: false, action: null, data: { strokes: null, putts: null }, line: 'No score was logged.' };
    }
    const bits: string[] = [];
    if (strokes != null) bits.push(`Score is ${strokes}.`);
    if (putts != null) bits.push(putts === 0 ? 'No putts. Not added to the score.' : putts === 1 ? 'One putt. Not added to the score.' : `${putts} putts. Not added to the score.`);
    return {
      name,
      ok: true,
      action: { tool: 'log_score', ...(strokes != null ? { strokes } : {}), ...(putts != null ? { putts } : {}) },
      data: { strokes, putts },
      line: bits.join(' '),
    };
  }

  if (name === 'set_club') {
    const clubId = typeof record.clubId === 'string' ? record.clubId : '';
    const club = context.clubs.find((item) => item.clubId === clubId || item.clubLabel.toLowerCase() === clubId.toLowerCase());
    if (!club) return { name, ok: false, action: null, data: { clubId: null }, line: 'That club is not in the bag.' };
    const carry = club.carryYards;
    const line = carry == null ? `${club.clubLabel}.` : context.persona === 'chill' ? `${club.clubLabel}. Carry ${roundYards(carry)}.` : `${club.clubLabel}. Carry ${roundYards(carry)}.`;
    return { name, ok: true, action: { tool: 'set_club', clubId: club.clubId }, data: { clubId: club.clubId, carryYards: carry, dispersionYards: club.dispersionYards }, line };
  }

  if (name === 'mark_shot') {
    const side = record.side;
    const miss: AskMiss | null =
      side === 'left' || side === 'right' || side === 'short' || side === 'fairway' || side === 'hazard' ? side : null;
    if (!miss) return { name, ok: false, action: null, data: { side: null }, line: 'No shot was marked.' };
    const word = miss === 'fairway' ? 'Fairway.' : miss === 'hazard' ? 'Hazard.' : `${miss[0]?.toUpperCase()}${miss.slice(1)}.`;
    return { name, ok: true, action: { tool: 'mark_shot', miss }, data: { side: miss }, line: word };
  }

  return { name, ok: false, action: null, data: {}, line: 'That is not a thing I can do.' };
}

export function talkSentences(line: string): string[] {
  const parts = line
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts;
}

function mentionedClub(text: string, clubs: readonly TalkClub[]): TalkClub | null {
  const spoken = text.toLowerCase();
  const ranked = [...clubs].sort((a, b) => b.clubLabel.length - a.clubLabel.length);
  return ranked.find((club) => spoken.includes(club.clubLabel.toLowerCase())) ?? null;
}

function wantsClubChange(text: string): boolean {
  return /\b(use|grab|take|set|switch to|hit the|i'm hitting|im hitting)\b/.test(text.toLowerCase());
}

function outOfReach(context: TalkContext): { club: string } | null {
  if (!context.atTee || context.par == null || context.par < 4 || context.gpsYards == null) return null;
  const selected = context.clubs.find((club) => club.clubId === context.selectedClubId);
  const known = context.clubs.filter((club) => club.carryYards != null);
  const inHand = selected?.carryYards != null ? selected : known.sort((a, b) => (b.carryYards ?? 0) - (a.carryYards ?? 0))[0];
  if (!inHand?.carryYards || context.gpsYards <= inHand.carryYards + OUT_OF_REACH_YARDS) return null;
  return { club: inHand.clubLabel };
}

/** Scripted answer from the real context. Used when the server has no model key. */
export async function sampleTalkReply(context: TalkContext, transcript: string): Promise<TalkReply> {
  const spoken = transcript.trim();
  if (!spoken) {
    const line = "I didn't catch that.";
    return { mode: 'sample', line, sentences: talkSentences(line), tools: [], heard: false };
  }
  const intent = await parseAsk(spoken);
  const tools: TalkToolResult[] = [];
  const say = (result: TalkToolResult) => {
    tools.push(result);
    return result.line;
  };

  if (intent.command?.kind === 'score') {
    const line = say(runTalkTool('log_score', { strokes: intent.command.strokes }, context));
    return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
  }
  if (intent.command?.kind === 'putts') {
    const line = say(runTalkTool('log_score', { putts: intent.command.putts }, context));
    return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
  }
  if (intent.command?.kind === 'miss') {
    const line = say(runTalkTool('mark_shot', { side: intent.command.side }, context));
    return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
  }
  if (intent.command?.kind === 'next') {
    const line = 'Next hole.';
    return {
      mode: 'sample',
      line,
      sentences: talkSentences(line),
      tools: [{ name: 'next_hole', ok: true, action: { tool: 'next_hole' }, data: {}, line }],
      heard: false,
    };
  }
  if (intent.question === 'plays_like' || (/\bplay/.test(spoken.toLowerCase()) && /like/.test(spoken.toLowerCase()))) {
    const line = say(runTalkTool('get_plays_like', {}, context));
    return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
  }
  if (intent.question === 'wind' || intent.question === 'elevation' || intent.question === 'temperature' || intent.question === 'distance') {
    const line = conditionAnswer(intent.question, {
      windMph: context.windMph,
      headwindMph: context.headwindMph,
      windYards: context.windYards,
      elevationFeet: context.elevationFeet,
      temperatureF: context.temperatureF,
      distanceYards: intent.distanceYards ?? context.gpsYards,
    });
    return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
  }
  const named = mentionedClub(spoken, context.clubs);
  if (named && wantsClubChange(spoken)) {
    const line = say(runTalkTool('set_club', { clubId: named.clubId }, context));
    return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
  }
  const reach = outOfReach(context);
  if (reach && (intent.question === 'club' || intent.question == null)) {
    const line = teeLine(context.persona, context.par ?? 0, reach.club);
    return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
  }
  if (intent.question === 'club' || intent.question == null) {
    if (context.cardLine) {
      const line = context.cardLine;
      return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
    }
    const line = say(runTalkTool('recommend_club', {}, context));
    return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
  }
  const line = context.persona === 'chill' ? 'Say the club, the score, or the distance.' : "Ask me the club, the number, or the score.";
  return { mode: 'sample', line, sentences: talkSentences(line), tools, heard: false };
}

export const NEAR_SHOT_YARDS = 30;

/** One short line when the player reaches a new tee, or comes within 30 yards of the last mark. */
export function proactiveCallout(input: {
  enabled: boolean;
  persona: TalkPersona;
  hole: number;
  par: number | null;
  atTee: boolean;
  clubLabel: string | null;
  stockYards: number | null;
  greenYards: number | null;
  yardsFromLastShot: number | null;
  lastShotId: string | null;
  spokenKey: string | null;
}): { key: string; line: string } | null {
  if (!input.enabled) return null;
  if (input.atTee && input.hole > 0) {
    const key = `tee:${input.hole}`;
    if (input.spokenKey === key) return null;
    const stock = finiteOrNull(input.stockYards);
    const green = finiteOrNull(input.greenYards);
    const club = input.clubLabel ? clubHead(input.clubLabel) : null;
    if (input.par != null && input.par >= 4 && club && stock != null && green != null && green - stock >= OUT_OF_REACH_YARDS) {
      return { key, line: teeLine(input.persona, input.par, club) };
    }
    if (input.par != null) {
      const par = roundYards(input.par);
      return { key, line: input.persona === 'chill' ? `Hole ${input.hole}. Par ${par}.` : `Hole ${input.hole}. Par ${par}. Let's go.` };
    }
    return { key, line: `Hole ${input.hole}.` };
  }
  const yards = finiteOrNull(input.yardsFromLastShot);
  if (yards != null && yards <= NEAR_SHOT_YARDS && input.lastShotId) {
    const key = `shot:${input.lastShotId}`;
    if (input.spokenKey === key) return null;
    const shown = roundYards(yards);
    return {
      key,
      line: input.persona === 'chill' ? `${shown} yards from the last mark.` : `You're ${shown} from the last mark.`,
    };
  }
  return null;
}

export function createTalkMachine(handsFree = false): TalkMachine {
  return { phase: 'idle', handsFree, stopSpeech: false };
}

export function talkTransition(state: TalkMachine, event: 'listen' | 'think' | 'speak' | 'finish' | 'barge' | 'close'): TalkMachine {
  if (event === 'close') return { phase: 'idle', handsFree: state.handsFree, stopSpeech: state.phase === 'speaking' };
  if (event === 'barge') {
    if (state.phase !== 'speaking') return { ...state, stopSpeech: false };
    return { phase: 'listening', handsFree: state.handsFree, stopSpeech: true };
  }
  if (event === 'listen') {
    return { phase: 'listening', handsFree: state.handsFree, stopSpeech: state.phase === 'speaking' };
  }
  if (event === 'think' && state.phase === 'listening') return { phase: 'thinking', handsFree: state.handsFree, stopSpeech: false };
  if (event === 'speak' && state.phase === 'thinking') return { phase: 'speaking', handsFree: state.handsFree, stopSpeech: false };
  if (event === 'finish' && state.phase === 'speaking') {
    return { phase: state.handsFree ? 'listening' : 'idle', handsFree: state.handsFree, stopSpeech: false };
  }
  return { ...state, stopSpeech: false };
}

export function talkToolSpecs(): { name: TalkToolName; description: string; parameters: Record<string, unknown> }[] {
  return [
    {
      name: 'get_plays_like',
      description: 'Recompute plays-like from the posted wind, elevation, and temperature. Null stays null.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'recommend_club',
      description: 'Call a club from measured carries only. Do not invent a stock or a dispersion.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'log_score',
      description: 'Log a hole score, putts, or both. Omit a field that was not spoken.',
      parameters: {
        type: 'object',
        properties: { strokes: { type: 'number' }, putts: { type: 'number' } },
        additionalProperties: false,
      },
    },
    {
      name: 'set_club',
      description: 'Select a club that is already in the bag.',
      parameters: {
        type: 'object',
        properties: { clubId: { type: 'string' } },
        required: ['clubId'],
        additionalProperties: false,
      },
    },
    {
      name: 'mark_shot',
      description: 'Mark the finish of the last shot. side is left, right, short, fairway, or hazard.',
      parameters: {
        type: 'object',
        properties: { side: { type: 'string', enum: ['left', 'right', 'short', 'fairway', 'hazard'] } },
        required: ['side'],
        additionalProperties: false,
      },
    },
  ];
}
