import type { DistanceProfile } from './profile';
import { layupDecision } from './layup';
import { missReport, type MissMark, playsLike, shortShotCall, type ShortShotCell, SHORT_SHOT_YARDS } from './phase2';
import { recommend } from './caddie';

/**
 * English is the live lexicon. German and Spanish keep the same intent shape
 * and stay empty until their phrases are written. They do not borrow English.
 */
export const ASK_LANGUAGES = ['en', 'de', 'es'] as const;
export type AskLanguage = (typeof ASK_LANGUAGES)[number];

export type AskLie = 'tee' | 'fairway' | 'rough' | 'sand' | 'green';
export type AskSide = 'left' | 'right' | 'front';
export type AskQuestion = 'club' | 'plays_like' | 'layup' | 'miss' | 'wind' | 'elevation' | 'temperature' | 'distance';
export type AskMiss = 'left' | 'right' | 'short' | 'fairway' | 'hazard';

export interface AskHazard {
  kind: 'bunker' | 'water' | 'hazard';
  side: AskSide;
}

export type AskCommand =
  | { kind: 'score'; strokes: number }
  | { kind: 'putts'; putts: number }
  | { kind: 'next' }
  | { kind: 'miss'; side: AskMiss };

export interface AskIntent {
  language: AskLanguage;
  distanceYards: number | null;
  lie: AskLie | null;
  hazards: AskHazard[];
  question: AskQuestion | null;
  command: AskCommand | null;
  /** True when a model filled a field the rules left empty. It cannot replace a rule. */
  usedModel: boolean;
}

export interface AskModel {
  complete(transcript: string): Promise<unknown>;
}

/**
 * Yards a lie takes off the shot you can expect. Added to the number the club
 * has to cover. An estimate, never a measurement.
 *
 * Rough: 4 under 100, 6 from 100 to 169, 8 from 170.
 * Sand: 6 under 40, 10 from 40 to 99, 14 from 100.
 * Tee, fairway, and green take nothing. Green is not a full swing.
 */
export const LIE_ESTIMATE_TABLE = [
  { lie: 'rough', belowYards: 100, takenOff: 4 },
  { lie: 'rough', belowYards: 170, takenOff: 6 },
  { lie: 'rough', belowYards: Number.POSITIVE_INFINITY, takenOff: 8 },
  { lie: 'sand', belowYards: 40, takenOff: 6 },
  { lie: 'sand', belowYards: 100, takenOff: 10 },
  { lie: 'sand', belowYards: Number.POSITIVE_INFINITY, takenOff: 14 },
] as const;

export interface AskChip {
  id: string;
  label: string;
}

export interface AskAnswer {
  line: string;
  clubLabel: string | null;
  distanceYards: number | null;
  distanceSource: 'spoken' | 'gps' | null;
  lie: AskLie | null;
  /** Yards the lie table took off. Null when the lie is unknown or takes nothing. */
  lieEstimateYards: number | null;
  estimate: boolean;
  playsLikeYards: number | null;
  chips: AskChip[];
}

const LIE_CYCLE: AskLie[] = ['tee', 'fairway', 'rough', 'sand', 'green'];
const SIDE_CYCLE: AskSide[] = ['left', 'right', 'front'];

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const NUMBER_WORD = Object.keys(WORD_NUMBERS).join('|');

export function lieEstimateYards(lie: AskLie | null, distanceYards: number | null): number | null {
  if (lie == null || distanceYards == null || !Number.isFinite(distanceYards) || distanceYards <= 0) return null;
  if (lie === 'tee' || lie === 'fairway' || lie === 'green') return 0;
  const row = LIE_ESTIMATE_TABLE.find((item) => item.lie === lie && distanceYards < item.belowYards);
  return row ? row.takenOff : null;
}

export function blankAsk(language: AskLanguage = 'en'): AskIntent {
  return { language, distanceYards: null, lie: null, hazards: [], question: null, command: null, usedModel: false };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectLanguage(text: string): AskLanguage {
  if (/\b(ich|schlag|schlagen|soll|grun|abschlag|loch)\b/.test(text)) return 'de';
  if (/\b(golpe|bunker|hoyos|siguiente|hierba)\b/.test(text) && /\b(el|la|que|para)\b/.test(text)) return 'es';
  return 'en';
}

function readNumber(token: string | undefined): number | null {
  if (!token) return null;
  if (/^\d{1,3}$/.test(token)) return Number(token);
  return WORD_NUMBERS[token] ?? null;
}

function hazardKind(word: string): AskHazard['kind'] {
  if (/water|creek|pond/.test(word)) return 'water';
  if (/bunker|trap/.test(word)) return 'bunker';
  return 'hazard';
}

function readHazards(text: string): AskHazard[] {
  const found: AskHazard[] = [];
  const push = (kindWord: string, sideWord: string) => {
    const side: AskSide | null = sideWord === 'short' ? 'front' : sideWord === 'left' || sideWord === 'right' || sideWord === 'front' ? sideWord : null;
    if (!side) return;
    const hazard: AskHazard = { kind: hazardKind(kindWord), side };
    if (found.some((item) => item.kind === hazard.kind && item.side === hazard.side)) return;
    found.push(hazard);
  };
  const noun = 'bunkers?|sand traps?|traps?|water|hazards?|creeks?|ponds?';
  for (const match of text.matchAll(new RegExp(`\\b(${noun})\\s+(?:on\\s+|in\\s+)?(?:the\\s+)?(left|right|front|short)\\b`, 'g'))) {
    push(match[1] ?? '', match[2] ?? '');
  }
  for (const match of text.matchAll(new RegExp(`\\b(left|right|front|short)\\s+(${noun})\\b`, 'g'))) {
    push(match[2] ?? '', match[1] ?? '');
  }
  return found;
}

function readCommand(text: string): AskCommand | null {
  if (/^(next|next hole|next hole please|go to the next hole|on to the next hole|onto the next hole)$/.test(text)) return { kind: 'next' };
  const putt = text.match(new RegExp(`\\b(zero|no|${NUMBER_WORD}|\\d{1,2})\\s+putts?\\b`));
  if (putt) {
    const count = putt[1] === 'no' ? 0 : readNumber(putt[1]);
    if (count != null && count >= 0 && count <= 9) return { kind: 'putts', putts: count };
  }
  const score = text.match(
    new RegExp(`\\b(?:i made|made|scored|i shot|shot|i had|had|carded|put me down for|score is|score of)\\s+(?:an?\\s+)?(${NUMBER_WORD}|\\d{1,2})\\b`),
  );
  if (score) {
    const strokes = readNumber(score[1]);
    if (strokes != null && strokes >= 1 && strokes <= 15) return { kind: 'score', strokes };
  }
  if (/\b(i hit it right|hit it right|pushed it right|pushed right)\b/.test(text)) return { kind: 'miss', side: 'right' };
  if (/\b(i hit it left|hit it left|pulled it left|pulled left)\b/.test(text)) return { kind: 'miss', side: 'left' };
  if (/\b(i hit it short|hit it short)\b/.test(text)) return { kind: 'miss', side: 'short' };
  if (/\b(i hit the fairway|hit the fairway|found the fairway)\b/.test(text)) return { kind: 'miss', side: 'fairway' };
  if (/\b(i hit it in the hazard|hit it in the hazard|found the hazard)\b/.test(text)) return { kind: 'miss', side: 'hazard' };
  return null;
}

function readDistance(text: string): number | null {
  const stripped = text
    .replace(new RegExp(`\\b(?:i made|made|scored|i shot|shot|i had|had|carded|put me down for|score is|score of)\\s+(?:an?\\s+)?(?:${NUMBER_WORD}|\\d{1,2})\\b`, 'g'), ' ')
    .replace(new RegExp(`\\b(?:zero|no|${NUMBER_WORD}|\\d{1,2})\\s+putts?\\b`, 'g'), ' ');
  const patterns = [
    /\b(\d{1,3})\s*(?:yards|yard|yds|yd)\b/,
    /\b(\d{1,3})\s+out\b/,
    /\bout\s+(\d{1,3})\b/,
    /\b(\d{1,3})\s+to the (?:pin|hole|green)\b/,
    /\byards to the pin\s+(\d{1,3})\b/,
    /\b(\d{1,3})\s+away\b/,
  ];
  for (const pattern of patterns) {
    const match = stripped.match(pattern);
    const value = readNumber(match?.[1]);
    if (value != null && value > 0 && value <= 500) return value;
  }
  const bare = stripped.match(/\b(\d{2,3})\b/);
  const bareValue = readNumber(bare?.[1]);
  if (bareValue != null && bareValue >= 20 && bareValue <= 500) return bareValue;
  return null;
}

function readLie(text: string, command: AskCommand | null): AskLie | null {
  if (/\b(in the sand|in a bunker|in the bunker|from the sand|from the bunker|out of the sand|greenside bunker)\b/.test(text)) return 'sand';
  if (/\b(off the tee|on the tee|tee box|from the tee)\b/.test(text)) return 'tee';
  if (/\b(on the green|im on the green)\b/.test(text)) return 'green';
  if (/\b(rough|first cut|deep grass|in the junk|the junk)\b/.test(text)) return 'rough';
  if (command?.kind === 'miss' && command.side === 'fairway') return null;
  if (/\b(from the fairway|in the fairway|on the fairway|off the fairway)\b/.test(text) || /\bfairway\b/.test(text)) return 'fairway';
  return null;
}

function readQuestion(text: string, command: AskCommand | null, distance: number | null, lie: AskLie | null): AskQuestion | null {
  if (command) return null;
  if (/\b(play like|plays like|playing like|how does it play|whats it play)\b/.test(text)) return 'plays_like';
  if (/\b(wind|windy|breeze)\b/.test(text)) return 'wind';
  if (/\b(elevation|uphill|downhill|how steep)\b/.test(text)) return 'elevation';
  if (/\b(temperature|how hot|how cold|the temp)\b/.test(text)) return 'temperature';
  if (/\b(how far|whats the distance|how many yards|the yardage)\b/.test(text)) return 'distance';
  if (/\blay[\s-]?up\b/.test(text)) return 'layup';
  if (/\b(my miss|miss side|where do i miss|whats the miss)\b/.test(text)) return 'miss';
  if (/\b(what should i hit|what do i hit|what club|which club|what iron|what do i play)\b/.test(text)) return 'club';
  if (distance != null || lie != null) return 'club';
  return null;
}

function asLie(value: unknown): AskLie | null {
  return value === 'tee' || value === 'fairway' || value === 'rough' || value === 'sand' || value === 'green' ? value : null;
}

function asQuestion(value: unknown): AskQuestion | null {
  return value === 'club' ||
    value === 'plays_like' ||
    value === 'layup' ||
    value === 'miss' ||
    value === 'wind' ||
    value === 'elevation' ||
    value === 'temperature' ||
    value === 'distance'
    ? value
    : null;
}

function asSide(value: unknown): AskSide | null {
  return value === 'left' || value === 'right' || value === 'front' ? value : null;
}

function asHazardKind(value: unknown): AskHazard['kind'] | null {
  return value === 'bunker' || value === 'water' || value === 'hazard' ? value : null;
}

/** Fills only fields the rules left empty. A model cannot change a score, a lie, or a hazard the rules already named. */
export function fillAskFromModel(intent: AskIntent, raw: unknown): AskIntent {
  if (typeof raw !== 'object' || raw == null) return intent;
  const record = raw as Record<string, unknown>;
  const next: AskIntent = { ...intent, hazards: [...intent.hazards] };
  let filled = false;
  if (next.distanceYards == null && typeof record.distanceYards === 'number' && record.distanceYards > 0 && record.distanceYards <= 500) {
    next.distanceYards = Math.round(record.distanceYards);
    filled = true;
  }
  const lie = asLie(record.lie);
  if (next.lie == null && lie) {
    next.lie = lie;
    filled = true;
  }
  const question = asQuestion(record.question);
  if (next.question == null && next.command == null && question) {
    next.question = question;
    filled = true;
  }
  if (next.hazards.length === 0 && Array.isArray(record.hazards)) {
    const hazards: AskHazard[] = [];
    for (const item of record.hazards) {
      if (typeof item !== 'object' || item == null) continue;
      const kind = asHazardKind((item as { kind?: unknown }).kind);
      const side = asSide((item as { side?: unknown }).side);
      if (kind && side) hazards.push({ kind, side });
    }
    if (hazards.length > 0) {
      next.hazards = hazards;
      filled = true;
    }
  }
  if (next.command == null && next.question == null && record.command && typeof record.command === 'object') {
    const command = record.command as { kind?: unknown; strokes?: unknown; putts?: unknown; side?: unknown };
    if (command.kind === 'next') {
      next.command = { kind: 'next' };
      filled = true;
    } else if (command.kind === 'score' && typeof command.strokes === 'number' && command.strokes >= 1 && command.strokes <= 15) {
      next.command = { kind: 'score', strokes: command.strokes };
      filled = true;
    } else if (command.kind === 'putts' && typeof command.putts === 'number' && command.putts >= 0 && command.putts <= 9) {
      next.command = { kind: 'putts', putts: command.putts };
      filled = true;
    } else if (
      command.kind === 'miss' &&
      (command.side === 'left' || command.side === 'right' || command.side === 'short' || command.side === 'fairway' || command.side === 'hazard')
    ) {
      next.command = { kind: 'miss', side: command.side };
      filled = true;
    }
  }
  next.usedModel = filled;
  return next;
}

export async function parseAsk(text: string, options?: { language?: AskLanguage; model?: AskModel }): Promise<AskIntent> {
  const spoken = normalize(text);
  const language = options?.language ?? detectLanguage(spoken);
  if (!spoken) return blankAsk(language);
  if (language !== 'en') return blankAsk(language);
  const command = readCommand(spoken);
  const distanceYards = readDistance(spoken);
  const lie = readLie(spoken, command);
  const hazards = readHazards(spoken);
  const question = readQuestion(spoken, command, distanceYards, lie);
  const rules: AskIntent = { language, distanceYards, lie, hazards, question, command, usedModel: false };
  const incomplete = rules.question == null && rules.command == null && (rules.distanceYards == null || rules.lie == null || rules.hazards.length === 0);
  if (!options?.model || !incomplete) return rules;
  try {
    const raw = await options.model.complete(spoken);
    return fillAskFromModel(rules, raw);
  } catch {
    return rules;
  }
}

export function cycleAskChip(intent: AskIntent, chipId: string, direction: 1 | -1 = 1): AskIntent {
  if (chipId === 'distance' && intent.distanceYards != null) {
    const next = Math.min(500, Math.max(1, intent.distanceYards + direction * 5));
    return { ...intent, distanceYards: next, command: null, question: intent.question ?? 'club' };
  }
  if (chipId === 'lie' && intent.lie != null) {
    const index = LIE_CYCLE.indexOf(intent.lie);
    const lie = LIE_CYCLE[(index + (direction === 1 ? 1 : LIE_CYCLE.length - 1)) % LIE_CYCLE.length] ?? intent.lie;
    return { ...intent, lie, command: null, question: intent.question ?? 'club' };
  }
  if (chipId.startsWith('hazard:') && intent.hazards.length > 0) {
    const index = Number(chipId.slice('hazard:'.length));
    const hazards = intent.hazards.map((hazard, hazardIndex) => {
      if (hazardIndex !== index) return hazard;
      const sideIndex = SIDE_CYCLE.indexOf(hazard.side);
      const side = SIDE_CYCLE[(sideIndex + (direction === 1 ? 1 : SIDE_CYCLE.length - 1)) % SIDE_CYCLE.length] ?? hazard.side;
      return { ...hazard, side };
    });
    return { ...intent, hazards, command: null, question: intent.question ?? 'club' };
  }
  return intent;
}

function chipsFor(intent: AskIntent): AskChip[] {
  const chips: AskChip[] = [];
  if (intent.distanceYards != null) chips.push({ id: 'distance', label: String(intent.distanceYards) });
  if (intent.lie) chips.push({ id: 'lie', label: intent.lie });
  intent.hazards.forEach((hazard, index) => {
    const side = hazard.side === 'left' ? 'L' : hazard.side === 'right' ? 'R' : 'front';
    chips.push({ id: `hazard:${index}`, label: `${hazard.kind} ${side}` });
  });
  return chips;
}

function favor(hazards: readonly AskHazard[]): string | null {
  const lateral = hazards.find((hazard) => hazard.side === 'left' || hazard.side === 'right');
  if (!lateral) return null;
  const away = lateral.side === 'left' ? 'right' : 'left';
  return `Favor the ${away}, away from the ${lateral.kind}.`;
}

function lieSentence(lie: AskLie | null, takenOff: number | null): string | null {
  if (takenOff == null || takenOff <= 0) return null;
  const name = lie === 'rough' ? 'Rough' : lie === 'sand' ? 'Sand' : null;
  if (!name) return null;
  return `${name} takes ${takenOff} ${takenOff === 1 ? 'yard' : 'yards'}, an estimate.`;
}

function commandLine(command: AskCommand): string {
  if (command.kind === 'score') return `Score is ${command.strokes}.`;
  if (command.kind === 'putts') {
    if (command.putts === 0) return 'No putts. Not added to the score.';
    if (command.putts === 1) return 'One putt. Not added to the score.';
    return `${command.putts} putts. Not added to the score.`;
  }
  if (command.kind === 'next') return 'Next hole.';
  if (command.kind === 'miss') return command.side === 'fairway' ? 'Fairway.' : command.side === 'hazard' ? 'Hazard.' : `${command.side[0]?.toUpperCase()}${command.side.slice(1)}.`;
  return '';
}

function shortClub(label: string | null): string | null {
  if (!label) return null;
  const head = label.split('·')[0]?.trim();
  return head || null;
}

function knownNumber(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function counted(count: number, singular: string, plural: string): string {
  const shown = Math.round(count);
  return `${shown} ${Math.abs(shown) === 1 ? singular : plural}`;
}

/** Wind, elevation, temperature, and distance, spoken from the readings that exist. */
export function conditionAnswer(
  question: 'wind' | 'elevation' | 'temperature' | 'distance',
  input: {
    windMph?: number | null;
    headwindMph?: number | null;
    windYards?: number | null;
    elevationFeet?: number | null;
    temperatureF?: number | null;
    distanceYards?: number | null;
  },
): string {
  if (question === 'wind') {
    const speed = knownNumber(input.windMph);
    const head = knownNumber(input.headwindMph);
    if (speed == null && head == null) return 'No wind reading yet.';
    const parts: string[] = [];
    if (speed != null) parts.push(`Wind ${counted(speed, 'mile', 'miles')} per hour.`);
    if (head != null) {
      const way = head > 0.5 ? 'Into you' : head < -0.5 ? 'Helping' : 'Across';
      const yards = knownNumber(input.windYards);
      parts.push(yards == null ? `${way}.` : `${way} by ${counted(Math.abs(yards), 'yard', 'yards')}.`);
    }
    return parts.join(' ');
  }
  if (question === 'elevation') {
    const feet = knownNumber(input.elevationFeet);
    if (feet == null) return 'No elevation reading yet.';
    const rounded = Math.round(feet);
    const way = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'level';
    return way === 'level' ? 'Elevation is level.' : `Elevation is ${counted(Math.abs(rounded), 'foot', 'feet')} ${way}.`;
  }
  if (question === 'temperature') {
    const degrees = knownNumber(input.temperatureF);
    if (degrees == null) return 'No temperature reading yet.';
    return `${counted(degrees, 'degree', 'degrees')}.`;
  }
  const yards = knownNumber(input.distanceYards);
  if (yards == null || yards <= 0) return 'No distance yet.';
  return `${counted(yards, 'yard', 'yards')}.`;
}

export function answerAsk(input: {
  intent: AskIntent;
  gpsYards: number | null;
  windMph?: number | null;
  headwindMph?: number | null;
  windYards?: number | null;
  elevationFeet?: number | null;
  temperatureF?: number | null;
  profiles?: readonly DistanceProfile[];
  candidateClubIds?: readonly string[];
  wedges?: readonly ShortShotCell[];
  marks?: readonly MissMark[];
  carryToClearYards?: number | null;
  carry?: Pick<DistanceProfile, 'metric' | 'sampleSize' | 'p20' | 'p50' | 'p80'> & { dispersionKnown?: boolean } | null;
}): AskAnswer {
  const intent = input.intent;
  const spoken = intent.distanceYards;
  const gps = input.gpsYards != null && Number.isFinite(input.gpsYards) && input.gpsYards > 0 ? input.gpsYards : null;
  const distanceSource: AskAnswer['distanceSource'] = spoken != null ? 'spoken' : gps != null ? 'gps' : null;
  const raw = spoken ?? gps;
  const sky =
    raw == null
      ? null
      : playsLike({
          rawYards: raw,
          headwindMph: input.headwindMph ?? null,
          elevationFeet: input.elevationFeet ?? null,
          temperatureF: input.temperatureF ?? null,
        });
  const playsLikeYards = sky && !('error' in sky) ? sky.playsLikeYards : null;
  const playing = playsLikeYards ?? raw;
  const takenOff = lieEstimateYards(intent.lie, playing);
  const target = playing != null && takenOff != null ? playing + takenOff : playing;
  const chips = chipsFor(intent);
  const base = {
    clubLabel: null as string | null,
    distanceYards: raw,
    distanceSource,
    lie: intent.lie,
    lieEstimateYards: takenOff != null && takenOff > 0 ? takenOff : null,
    estimate: takenOff != null && takenOff > 0,
    playsLikeYards,
    chips,
  };

  if (intent.command) return { ...base, line: commandLine(intent.command) };

  if (intent.question === 'wind' || intent.question === 'elevation' || intent.question === 'temperature' || intent.question === 'distance') {
    const windFromSky = sky && !('error' in sky) ? sky.wind?.yards ?? null : null;
    return {
      ...base,
      line: conditionAnswer(intent.question, {
        windMph: input.windMph,
        headwindMph: input.headwindMph,
        windYards: input.windYards ?? windFromSky,
        elevationFeet: input.elevationFeet,
        temperatureF: input.temperatureF,
        distanceYards: raw,
      }),
    };
  }

  if (intent.question === 'plays_like') {
    if (raw == null) return { ...base, line: 'Plays-like needs a distance. Nothing was guessed.' };
    if (playsLikeYards == null) return { ...base, line: 'Plays-like stays blank until wind, elevation, and temperature are known.' };
    return { ...base, line: `Plays like ${Math.round(playsLikeYards)}. The shot is ${Math.round(raw)}.` };
  }

  if (intent.question === 'miss') {
    const note = missReport(input.marks ?? []).note;
    return { ...base, line: note };
  }

  if (intent.question === 'layup') {
    const decision = layupDecision({ carry: input.carry ?? null, carryToClearYards: input.carryToClearYards ?? null });
    return { ...base, line: decision.reason };
  }

  if (intent.lie === 'green') return { ...base, line: 'On the green. No full swing.' };
  if (target == null) return { ...base, line: 'No distance yet.' };

  const lieNote = lieSentence(intent.lie, takenOff);
  const aim = favor(intent.hazards);
  if (target <= SHORT_SHOT_YARDS) {
    const shot = shortShotCall(target, input.wedges ?? []);
    const club = shortClub(shot.clubLabel);
    if (!club) return { ...base, line: [shot.reason, lieNote].filter(Boolean).join(' ') };
    const length = shot.length ? shot.length.replace(/_/g, ' ') : null;
    const name = length ? `${length} ${club}` : club;
    return { ...base, clubLabel: name, line: [name.endsWith('.') ? name : `${name}.`, lieNote, aim].filter(Boolean).join(' ') };
  }

  const card = recommend({
    targetDistanceYards: target,
    targetMetric: 'total',
    hazards: intent.hazards.map((hazard) => ({
      side: hazard.side,
      kind: hazard.kind,
      carryToClearYards: hazard.side === 'front' ? input.carryToClearYards ?? null : null,
    })),
    intent: 'neutral',
    riskPreference: 'neutral',
    profiles: input.profiles ?? [],
    candidateClubIds: input.candidateClubIds,
    personality: 'direct_analytical',
  });
  const club = card.posture === 'decline' ? null : shortClub(card.clubLabel);
  if (!club) {
    const reason = card.lines.reason.replace(/^Declining\.\s*/, '');
    return { ...base, line: [reason, lieNote, aim].filter(Boolean).join(' ') };
  }
  return { ...base, clubLabel: club, line: [`${club}.`, lieNote, aim].filter(Boolean).join(' ') };
}
