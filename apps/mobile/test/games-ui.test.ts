import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BANNED_WORD, DISCLOSURE, headToHead, seasonTable, type GameKind } from '@coopr/games';
import {
  BLIND_HOLD,
  DOWN_TEXT,
  MISSED,
  acceptRow,
  activeKinds,
  afterCorrection,
  applyPhrase,
  assignSide,
  blindRefusalLines,
  blankPlayer,
  buildSave,
  commitHole,
  correctLastHole,
  defaultSides,
  droppedGamesNote,
  emptyMarks,
  emptyStake,
  finishPrompt,
  firstStakeError,
  gameLine,
  handicapError,
  holesPlayed,
  dayAmount,
  liveScore,
  liveStripHeight,
  LOG_SCORES,
  LOG_WOLF,
  logHoleReason,
  logReady,
  oweCombinations,
  partialLabel,
  phoneRounds,
  playerHandicap,
  potHero,
  recapFor,
  resumeHole,
  rivalryHero,
  rivalryPick,
  stablefordLine,
  wolfPointsTable,
  rosterLine,
  setupBlock,
  skinsLine,
  stablePlayerId,
  stakeError,
  tapGross,
  undoLastHole,
  visiblePhraseLines,
  refusedBlindReadback,
  visibleSetupLines,
  winnerText,
  wolfHero,
  zeroSumLine,
  type EntryRow,
  type HoleMarks,
  type SetupPlayer,
} from '../src/games/present';
import { recapCardLines } from '../src/games/recap-bitmap';
import type { FoursomeSave } from '@coopr/games';

const here = dirname(fileURLToPath(import.meta.url));
const screen = readFileSync(join(here, '../app/games.tsx'), 'utf8');
const home = readFileSync(join(here, '../app/index.tsx'), 'utf8');
const ask = readFileSync(join(here, '../src/design/floating-ask.tsx'), 'utf8');
const speech = readFileSync(join(here, '../src/speech/recognize.ts'), 'utf8');

const CARD = Array.from({ length: 18 }, (_, index) => ({ par: index === 0 ? 5 : 4, strokeIndex: index + 1 }));

/** True when the crest PNG has a clear corner and an opaque mark, so it does not paint a white square. */
function pngCornerClear(bytes: Buffer): boolean {
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return false;
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9] ?? 0;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (colorType !== 6 || width < 8 || height < 8) return false;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(height * stride);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src] ?? 0;
    src += 1;
    const row = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? out[row + x - 4]! : 0;
      const up = y > 0 ? out[row - stride + x]! : 0;
      const ul = y > 0 && x >= 4 ? out[row - stride + x - 4]! : 0;
      const value = raw[src] ?? 0;
      src += 1;
      let next = value;
      if (filter === 1) next = (value + left) & 255;
      else if (filter === 2) next = (value + up) & 255;
      else if (filter === 3) next = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const pa = Math.abs(left + up - ul - left);
        const pb = Math.abs(left + up - ul - up);
        const pc = Math.abs(left + up - ul - ul);
        const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
        next = (value + pred) & 255;
      }
      out[row + x] = next;
    }
  }
  const alpha = (x: number, y: number) => out[y * stride + x * 4 + 3] ?? 255;
  if (alpha(0, 0) !== 0 || alpha(width - 1, 0) !== 0) return false;
  let opaque = false;
  for (let i = 3; i < out.length; i += 4) {
    if ((out[i] ?? 0) > 200) {
      opaque = true;
      break;
    }
  }
  return opaque;
}

function twoPlayers(): SetupPlayer[] {
  return [
    { ...blankPlayer('ada'), name: 'Ada', scratch: true },
    { ...blankPlayer('bea'), name: 'Bea', handicapText: '8' },
  ];
}

describe('foursome screens', () => {
  it('sets up only after names, handicaps, and a game', () => {
    const empty = [blankPlayer('a'), blankPlayer('b')];
    expect(setupBlock(empty, ['stableford'], true, false)).toBe('Add at least two players.');
    const named = twoPlayers().map((player, index) => (index === 1 ? { ...player, handicapText: '', scratch: false } : player));
    expect(setupBlock(named, ['stableford'], true, false)).toContain('course handicap');
    expect(playerHandicap(named[1]!)).toBeNull();
    expect(setupBlock(twoPlayers(), [], true, false)).toBe('Pick a game.');
    expect(setupBlock(twoPlayers(), ['skins'], false, false)).toContain('stroke index');
    const save = buildSave({
      id: 'round-1',
      players: twoPlayers(),
      ownerId: 'ada',
      kinds: ['skins'],
      stakes: { skins: { ...emptyStake(), amount: '1' } },
      grossOnly: false,
      siOk: true,
      card: CARD,
    });
    expect(save?.players[0]?.courseHandicap).toBe(0);
    expect(save?.players[1]?.courseHandicap).toBe(8);
    expect(save?.games[0]?.stake).toBe(100);
    expect(save?.players.map((player) => player.name)).toEqual(['Ada', 'Bea']);
  });

  it('keeps a low-confidence phrase off the card until it is confirmed', () => {
    const save = buildSave({
      id: 'round-2',
      players: [
        { ...blankPlayer('p_mike'), name: 'Mike', scratch: true },
        { ...blankPlayer('p_josh'), name: 'Josh', handicapText: '1' },
      ],
      ownerId: 'p_mike',
      kinds: ['stableford'],
      stakes: { stableford: emptyStake() },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    save.players[0]!.isDeviceOwner = true;
    const heard = applyPhrase(
      save.players.map((player) => ({ playerId: player.id, name: player.name, gross: null, pickup: false, confirmed: false, amber: false, question: null })),
      'Joe double, Mike 5',
      save,
      { par: 5, strokeIndex: 7 },
    );
    const josh = heard.rows.find((row) => row.name === 'Josh');
    expect(josh?.amber).toBe(true);
    expect(josh?.gross).toBe(7);
    expect(logReady(heard.rows)).toBe(false);
    const accepted = acceptRow(heard.rows, save.players.find((player) => player.name === 'Josh')!.id);
    const tapped = tapGross(accepted, save.players.find((player) => player.name === 'Mike')!.id, 5);
    expect(logReady(tapped)).toBe(true);
    expect(heard.rows.every((row) => row.confirmed || row.amber)).toBe(true);
  });

  it('settles a logged hole and the recap uses only those figures', () => {
    const players = twoPlayers();
    const save = buildSave({
      id: 'round-3',
      players,
      ownerId: 'ada',
      kinds: ['skins'],
      stakes: { skins: { ...emptyStake(), amount: '1' } },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const logged: FoursomeSave = {
      ...save,
      holes: save.holes.map((hole) =>
        hole.number === 1
          ? {
              ...hole,
              scores: [
                { playerId: save.players[0]!.id, gross: 4, pickup: false },
                { playerId: save.players[1]!.id, gross: 5, pickup: false },
              ],
            }
          : hole,
      ),
    };
    const text = recapFor(logged);
    expect(text).toContain('Bea owes Ada 1 BB');
    expect(text).toContain(DISCLOSURE);
    expect(text).not.toContain('High Cedars');
    expect(text).not.toContain('8');
    expect(BANNED_WORD.test(text)).toBe(false);
  });

  it('shows setup, confirm, settle-up, and recap, with no dead crew controls', () => {
    expect(screen).toContain('START ROUND');
    expect(screen).toContain('LOG HOLE');
    expect(screen).toContain('Confirm');
    expect(screen).toContain('SHARE RECAP');
    expect(screen).toContain('DISCLOSURE');
    expect(screen).toContain('Share.share');
    expect(screen).not.toMatch(/\b(invite|crew|wallet|leaderboard)\b/i);
    const visible = (source: string) => source.replace(/\$\{[^}]*\}/g, '');
    expect(BANNED_WORD.test(visible(screen))).toBe(false);
    expect(BANNED_WORD.test(visible(home))).toBe(false);
    expect(ask).toContain("root === 'games'");
    expect(speech).toContain('contextualStrings: hints');
    expect(speech).toContain('requiresOnDeviceRecognition: true');
    expect(speech).toMatch(/deviceSpeechAvailable[\s\S]*supportsOnDeviceRecognition\(\)/);
  });
});

function contrast(front: string, back: string): number {
  const lum = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const channel = (value: number) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const r = channel((n >> 16) & 255);
    const g = channel((n >> 8) & 255);
    const b = channel(n & 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const lighter = Math.max(lum(front), lum(back));
  const darker = Math.min(lum(front), lum(back));
  return (lighter + 0.05) / (darker + 0.05);
}

function fourPlayers(): SetupPlayer[] {
  return [
    { ...blankPlayer('mike'), name: 'Mike', scratch: true },
    { ...blankPlayer('dave'), name: 'Dave', handicapText: '9' },
    { ...blankPlayer('tony'), name: 'Tony', handicapText: '18' },
    { ...blankPlayer('josh'), name: 'Josh', handicapText: '12' },
  ];
}

function scored(save: { players: { id: string; name: string }[] }, grosses: number[]): EntryRow[] {
  return save.players.map((player, index) => ({
    playerId: player.id,
    name: player.name,
    gross: grosses[index] ?? 4,
    pickup: false,
    confirmed: true,
    amber: false,
    question: null,
  }));
}

describe('foursome QA', () => {
  it('D1 turns bingo, a greenie, a wolf take, and lone wolf into a read-back, and misses out loud', () => {
    const save = buildSave({
      id: 'd1',
      players: fourPlayers(),
      ownerId: 'mike',
      kinds: ['bbb', 'coins', 'wolf'],
      stakes: {},
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const rows = scored(save, [4, 4, 4, 4]).map((row) => ({ ...row, gross: null, confirmed: false }));
    const hole = { par: 4, strokeIndex: 1 };
    const josh = save.players.find((player) => player.name === 'Josh')!;
    const bingo = applyPhrase(rows, 'bingo Dave, bango Tony, bongo Dave', save, hole);
    expect(bingo.caught).toBe(true);
    expect(bingo.readback).toContain('Bingo Dave');
    expect(bingo.readback).toContain('This hole.');
    expect(bingo.marks.bbb).toEqual({ bingo: stablePlayerId('Dave'), bango: stablePlayerId('Tony'), bongo: stablePlayerId('Dave') });
    expect(bingo.note).not.toBe(MISSED);
    const green = applyPhrase(rows, 'greenie Tony', save, hole);
    expect(green.caught).toBe(true);
    expect(green.marks.coins).toContainEqual({ playerId: stablePlayerId('Tony'), coin: 'greenie' });
    expect(green.readback).toContain('Greenie Tony');
    const take = applyPhrase(rows, 'Josh takes Mike', save, hole, { wolfId: josh.id });
    expect(take.marks.wolf).toEqual({ mode: 'partner', wolfId: josh.id, partnerId: stablePlayerId('Mike') });
    expect(take.readback).toContain('Josh takes Mike');
    const lone = applyPhrase(rows, 'lone wolf', save, hole, { wolfId: josh.id });
    expect(lone.marks.wolf).toMatchObject({ mode: 'lone', wolfId: josh.id });
    expect(lone.readback).toContain('Lone wolf');
    const missed = applyPhrase(rows, 'asdf qwerty', save, hole);
    expect(missed.caught).toBe(false);
    expect(missed.note).toBe(MISSED);
    expect(missed.rows).toEqual(rows);
    expect(missed.readback).toBeNull();
  });

  it('D2 scores a tapped bingo and a coin, and a zero card has no winner', () => {
    const save = buildSave({
      id: 'd2',
      players: fourPlayers(),
      ownerId: 'mike',
      kinds: ['bbb', 'coins'],
      stakes: { bbb: { ...emptyStake(), amount: '1' }, coins: { ...emptyStake(), amount: '1' } },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const marks = {
      ...emptyMarks(),
      bbb: { bingo: stablePlayerId('Dave'), bango: stablePlayerId('Tony'), bongo: stablePlayerId('Dave') },
      coins: [{ playerId: stablePlayerId('Tony'), coin: 'greenie' as const }],
    };
    const logged = commitHole(save, 1, scored(save, [4, 5, 5, 5]), marks);
    const score = liveScore(logged);
    const bbb = score.games.find((game) => game.kind === 'bbb')!;
    const coins = score.games.find((game) => game.kind === 'coins')!;
    expect(bbb.points).toEqual([0, 2, 1, 0]);
    expect(coins.points?.[2]).toBe(1);
    expect(winnerText(bbb)).toBe('Dave');
    expect(winnerText({ points: [0, 0, 0, 0], winners: ['Mike', 'Dave', 'Tony', 'Josh'] })).toBe('No winner');
    expect(screen).toContain("['bingo', 'bango', 'bongo']");
    expect(screen).toContain("'greenie'");
  });

  it('D3 will not log a wolf hole until there is a call, a skip, and Clear puts it back', () => {
    const save = buildSave({
      id: 'd3',
      players: fourPlayers(),
      ownerId: 'mike',
      kinds: ['wolf'],
      stakes: {},
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const rows = scored(save, [4, 5, 5, 5]);
    expect(logReady(rows, emptyMarks(), true)).toBe(false);
    const called = { ...emptyMarks(), wolf: { mode: 'lone' as const, wolfId: stablePlayerId('Mike'), partnerId: null } };
    expect(logReady(rows, called, true)).toBe(true);
    expect(logReady(rows, { ...emptyMarks(), wolfSkipped: true }, true)).toBe(true);
    expect(logReady(rows, { ...called, wolf: null, wolfSkipped: false }, true)).toBe(false);
    expect(screen).toContain('Clear wolf call');
    expect(screen).toContain('No wolf');
  });

  it('D4 writes a correction onto the last logged hole and undo walks back through entries', () => {
    let save = buildSave({
      id: 'd4',
      players: fourPlayers(),
      ownerId: 'mike',
      kinds: ['skins'],
      stakes: { skins: { ...emptyStake(), amount: '1' } },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    save = commitHole(save, 1, scored(save, [4, 5, 6, 5]), emptyMarks());
    const fixed = correctLastHole(save, 'actually Tony had a 7');
    expect(fixed.caught).toBe(true);
    expect(fixed.hole).toBe(1);
    expect(fixed.save.holes.find((hole) => hole.number === 1)?.scores.find((row) => row.playerId === stablePlayerId('Tony'))?.gross).toBe(7);
    expect(fixed.save.holes.find((hole) => hole.number === 2)?.scores).toEqual([]);
    expect(fixed.readback).toBe('Hole 1: Tony 7');
    expect(fixed.readback).not.toContain('This hole.');
    const both = commitHole(fixed.save, 2, scored(fixed.save, [4, 4, 4, 4]), emptyMarks());
    const once = undoLastHole(both);
    const twice = once ? undoLastHole(once.save) : null;
    expect(once?.hole).toBe(2);
    expect(twice?.hole).toBe(1);
    expect(twice ? holesPlayed(twice.save) : 1).toBe(0);
    expect(twice ? undoLastHole(twice.save) : null).toBeNull();
    expect(screen).toContain('correctLastHole');
    expect(screen).toContain('undoLastHole');
  });

  it('D5 shows an error for a stake that is not a plain number', () => {
    for (const bad of ['$5', '5 BB', '1,5', '5.555', '-2', 'abc']) {
      expect(stakeError(bad)).toBe('Enter the stake as a number, like 1 or 2.50.');
      const blocked = setupBlock(twoPlayers(), ['skins'], true, false, { skins: { ...emptyStake(), amount: bad } });
      expect(blocked).toBe(stakeError(bad));
      expect(buildSave({
        id: 'bad-stake',
        players: twoPlayers(),
        ownerId: 'ada',
        kinds: ['skins'],
        stakes: { skins: { ...emptyStake(), amount: bad } },
        grossOnly: true,
        siOk: true,
        card: CARD,
      })).toBeNull();
    }
    expect(stakeError('')).toBeNull();
    expect(stakeError('2.50')).toBeNull();
  });

  it('D6 adds the same names from separate rounds into one row', () => {
    const make = (id: string) => {
      const players = [
        { ...blankPlayer(`${id}-m`), name: 'Mike', scratch: true },
        { ...blankPlayer(`${id}-d`), name: 'Dave', handicapText: '8' },
      ];
      let round = buildSave({
        id,
        players,
        ownerId: players[0]!.id,
        kinds: ['skins'],
        stakes: { skins: { ...emptyStake(), amount: '1' } },
        grossOnly: true,
        siOk: true,
        card: CARD,
      })!;
      round = { ...round, players: round.players.map((player) => ({ ...player, id: `${id}-${player.name}` })) };
      return commitHole(round, 1, scored(round, [4, 5]), emptyMarks());
    };
    const rounds = phoneRounds([make('a'), make('b')]);
    const table = seasonTable(rounds);
    expect(table.filter((row) => row.name === 'Mike')).toHaveLength(1);
    expect(table.find((row) => row.name === 'Mike')?.net).toBe(200);
    const rivalry = headToHead(rounds, stablePlayerId('Mike'), stablePlayerId('Dave'));
    expect(rivalry.winsA).toBe(2);
    expect(rivalry.winsB).toBe(0);
  });

  it('D7 shows sides and keeps a change on the saved game', () => {
    const players = fourPlayers();
    const sides = defaultSides(players.map((player) => ({ id: player.id, courseHandicap: playerHandicap(player) })));
    expect(sides.teamA).toHaveLength(2);
    expect(sides.teamB).toHaveLength(2);
    const moved = assignSide(sides, sides.teamA[0]!, 'B');
    expect(setupBlock(players, ['vegas'], true, true, { vegas: emptyStake() }, moved)).toBe('Each side needs two players.');
    const save = buildSave({
      id: 'd7',
      players,
      ownerId: 'mike',
      kinds: ['nassau', 'vegas'],
      stakes: { nassau: { ...emptyStake(), front: '1', back: '1', total: '1' } },
      grossOnly: true,
      siOk: true,
      card: CARD,
      sides,
    })!;
    const nassau = save.games.find((game) => game.kind === 'nassau')!;
    expect(rosterLine(save, nassau)).toContain(' vs ');
    expect(nassau.teamA).toEqual(sides.teamA.map((id) => stablePlayerId(players.find((player) => player.id === id)!.name)));
    expect(screen).toContain('Side A');
    expect(screen).toContain('on side B');
  });

  it('D8 asks before finishing, labels a partial round, and refuses zero holes', () => {
    expect(finishPrompt(0)).toBeNull();
    expect(finishPrompt(3)).toBe('Finish this partial round (3 holes)?');
    expect(finishPrompt(18)).toBe('Finish this round?');
    expect(partialLabel(3)).toBe('Partial round (3 holes)');
    expect(screen).toContain('Confirm finish');
    expect(screen).toContain('Log a hole before finishing.');
    expect(screen).not.toContain('toISOString');
    expect(screen).toContain('partialLabel');
  });

  it('D9 uses a lighter red on navy and 44 point targets', () => {
    expect(contrast(DOWN_TEXT, '#0B1F3A')).toBeGreaterThanOrEqual(4.5);
    expect(screen).toContain('DOWN_TEXT');
    expect(screen).not.toContain('colors.red');
    expect(screen).toMatch(/holeChip: \{[^}]*width: 44, height: 44/);
    expect(screen).toMatch(/chip: \{[^}]*minWidth: 44, minHeight: 44/);
    expect(screen).not.toMatch(/width: 36/);
    expect(screen).not.toMatch(/height: 32/);
  });

  it('D10 shows the confirm card, the zero-sum line, and a recap card', () => {
    expect(screen).toContain('accessibilityLabel="Live strip"');
    expect(screen).toContain('accessibilityLabel="Games"');
    expect(screen).toContain('accessibilityLabel="Confirm card"');
    expect(screen).toContain('accessibilityLabel="Recap card"');
    expect(screen).toContain('Zero-sum check');
    expect(zeroSumLine({ nets: [100, -100], zeroSumOk: true, note: null })).toBe('Zero-sum check: 0 BB across the group.');
    expect(screen).toContain('This hole.');
  });

  it('D11 does not keep a finished skins line in the future tense or crown a zero', () => {
    const finished = skinsLine(['Mike', 'Dave', 'Tony', 'Josh'], [0, 0, 0, 0], [0, 0, 0, 0], 1, true);
    expect(finished).toBe('No skins won. 1 left unplayed');
    expect(finished).not.toContain('if it ends now');
    expect(finished).not.toContain('Mike 0');
    const live = gameLine(
      { kind: 'skins', label: 'Skins', points: [0, 0], nets: [0, 0], winners: ['Mike', 'Dave'], line: 'Mike 0 0 BB. 1 on the line, 15 BB if it ends now' },
      { names: ['Mike', 'Dave'], pending: 1, finished: true, roster: null },
    );
    expect(live).not.toContain('if it ends now');
    expect(screen).toContain('gameLine');
  });

  it('D12 keeps stake labels, drops games the group can no longer play, and resumes on the next hole', () => {
    expect(screen).toContain("'Front'");
    expect(screen).toContain("'Press stake'");
    expect(activeKinds(['wolf', 'vegas', 'skins'] satisfies GameKind[], 3)).toEqual(['skins']);
    const high = { ...blankPlayer('x'), handicapText: '999' };
    expect(playerHandicap(high)).toBeNull();
    expect(handicapError(high)).toContain('-10');
    expect(handicapError({ ...blankPlayer('y'), handicapText: '54' })).toBeNull();
    expect(playerHandicap({ ...blankPlayer('z'), handicapText: '-10' })).toBe(-10);
    expect(screen).toContain('confirmChip');
    let save = buildSave({
      id: 'd12',
      players: twoPlayers(),
      ownerId: 'ada',
      kinds: ['skins'],
      stakes: {},
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    save = commitHole(save, 1, scored(save, [4, 5]), emptyMarks());
    expect(resumeHole(save)).toBe(2);
    expect(screen).toContain('resumeHole');
  });

  it('D13 keeps the lawyer questions and the deferred list out of the app source', () => {
    const copy = readFileSync(join(here, '../../../packages/games/src/copy.ts'), 'utf8');
    const present = readFileSync(join(here, '../src/games/present.ts'), 'utf8');
    const notes = readFileSync(join(here, '../../../docs/GAMES_DEFERRED.md'), 'utf8');
    expect(copy.includes('LAWYER_OPEN')).toBe(false);
    expect(copy.includes('DEFERRED_ONLINE')).toBe(false);
    expect(copy.includes('money-transmission')).toBe(false);
    expect(present.includes('leaderboard-sync')).toBe(false);
    expect(screen.includes('leaderboard-sync')).toBe(false);
    expect(screen.includes('sudden')).toBe(false);
    expect(notes.includes('money-transmission')).toBe(true);
    expect(notes.includes('leaderboard-sync')).toBe(true);
    expect(screen).toContain('Press this hole');
    expect(screen).toContain('Auto-press stays at 2.');
  });

  it('records a manual press on the hole the button toggles', () => {
    const players = twoPlayers();
    const base = buildSave({
      id: 'press',
      players,
      ownerId: 'ada',
      kinds: ['nassau'],
      stakes: { nassau: { ...emptyStake(), front: '1', press: '1' } },
      grossOnly: true,
      siOk: true,
      card: CARD,
      sides: { teamA: ['ada'], teamB: ['bea'] },
    })!;
    const pressed = commitHole(commitHole(base, 1, scored(base, [4, 5]), { ...emptyMarks(), press: true }), 2, scored(base, [4, 5]), emptyMarks());
    const plain = commitHole(commitHole(base, 1, scored(base, [4, 5]), emptyMarks()), 2, scored(base, [4, 5]), emptyMarks());
    const withPress = liveScore(pressed).games.find((game) => game.kind === 'nassau')!.nets;
    const without = liveScore(plain).games.find((game) => game.kind === 'nassau')!.nets;
    expect(withPress).not.toEqual(without);
    expect(withPress!.reduce((sum, net) => sum + net, 0)).toBe(0);
  });

  it('N1 saves the hole wolf when the phrase names a different picker', () => {
    const save = buildSave({
      id: 'n1',
      players: fourPlayers(),
      ownerId: 'mike',
      kinds: ['wolf'],
      stakes: {},
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const dave = save.players.find((player) => player.name === 'Dave')!;
    const rows = scored(save, [4, 4, 4, 4]).map((row) => ({ ...row, gross: null, confirmed: false }));
    const take = applyPhrase(rows, 'Josh takes Mike', save, { par: 4, strokeIndex: 1 }, { wolfId: dave.id });
    expect(take.marks.wolf).toEqual({ mode: 'partner', wolfId: dave.id, partnerId: stablePlayerId('Mike') });
    expect(take.readback).toContain('Dave takes Mike');
    expect(take.question).toBe('Dave is the wolf, did you mean Dave takes Mike?');
    const logged = commitHole(save, 1, scored(save, [4, 3, 5, 5]), take.marks);
    expect(logged.holes[0]?.wolf?.wolfId).toBe(dave.id);
    expect(logged.holes[0]?.wolf?.wolfId).not.toBe(stablePlayerId('Josh'));
  });

  it('N2 keeps the open hole draft when a correction patches an earlier hole', () => {
    const draft: EntryRow[] = [
      { playerId: 'mike', name: 'Mike', gross: 5, pickup: false, confirmed: true, amber: false, question: null },
      { playerId: 'tony', name: 'Tony', gross: null, pickup: false, confirmed: false, amber: false, question: null },
    ];
    const marks: HoleMarks = emptyMarks();
    const kept = afterCorrection({
      openHole: 4,
      draftRows: draft,
      draftMarks: marks,
      correctedHole: 3,
      correctedRows: [],
      correctedMarks: emptyMarks(),
    });
    expect(kept.hole).toBe(4);
    expect(kept.rows).toBe(draft);
    expect(kept.rows[0]?.gross).toBe(5);
    expect(kept.rows[1]?.gross).toBeNull();
    const sameHole = afterCorrection({
      openHole: 3,
      draftRows: draft,
      draftMarks: marks,
      correctedHole: 3,
      correctedRows: [{ ...draft[0]!, gross: 7 }],
      correctedMarks: marks,
    });
    expect(sameHole.hole).toBe(3);
    expect(sameHole.rows[0]?.gross).toBe(7);
    expect(screen).toContain('afterCorrection');
  });

  it('N3 says one hole, all square, and skins points without a bare zero', () => {
    expect(partialLabel(1)).toBe('Partial round (1 hole)');
    expect(finishPrompt(1)).toBe('Finish this partial round (1 hole)?');
    expect(partialLabel(3)).toBe('Partial round (3 holes)');
    const skins = skinsLine(['Mike', 'Dave'], [9, 9], [0, 0], 0, true);
    expect(skins).toBe('Mike 9 skins, Dave 9 skins. Played out');
    expect(skins).not.toContain('0 BB');
    const paid = skinsLine(['Mike'], [2], [9000], 0, true);
    expect(paid).toContain('2 skins');
    expect(paid).not.toContain('skins-points');
    expect(paid).toContain('BB');
    expect(winnerText({ points: null, winners: [], line: 'All square' })).toBe('All square');
  });

  it('N5 shows one stake error and names the games a shorter group drops', () => {
    const bad = { ...emptyStake(), front: '$5', back: 'abc', total: '-2', press: '1,5' };
    const error = firstStakeError(['nassau'], { nassau: bad });
    expect(error).toBe('Enter the stake as a number, like 1 or 2.50.');
    expect(visibleSetupLines(error, error, null)).toEqual([error]);
    expect(droppedGamesNote(['wolf', 'vegas', 'match'], 3)).toBe('Wolf, Vegas and Match are off this round.');
    expect(droppedGamesNote(['skins'], 3)).toBeNull();
    expect(screen).toContain('visibleSetupLines');
    expect(screen).toContain('droppedGamesNote');
    expect(screen).not.toContain('stakeError(');
  });

  it('D10 shows the day hero, a recap bitmap, the confirm read-back, and a games sheet', () => {
    expect(screen).toContain('accessibilityLabel="Takes the day"');
    expect(screen).toContain('accessibilityLabel="Head to head"');
    expect(screen).toContain('accessibilityLabel="Zero-sum check"');
    expect(screen).toContain('accessibilityLabel="Save image"');
    expect(screen).toContain('accessibilityLabel="Show BB nets"');
    expect(screen).toContain('accessibilityLabel="Show handicaps"');
    expect(screen).toContain('accessibilityLabel="Read-back"');
    expect(screen).toContain('listening && mic');
    expect(screen).toContain('accessibilityLabel="Transcript"');
    expect(screen).toContain('accessibilityLabel="Pot on the line"');
    expect(screen).toContain('accessibilityLabel="Games sheet"');
    expect(screen).toContain("position: 'absolute'");
    expect(potHero(3, 500, 4, true)).toBe('3 skins on the line, 45 BB. Carry-over is on.');
    expect(potHero(3, 500, 4, true)).not.toMatch(/[()]/);
    expect(wolfHero('Dave')).toBe('Dave is the wolf');
    expect(rivalryHero('Mike', 'Dave', 2, 0)).toBe('Mike 2\u20130 Dave');
    const save = buildSave({
      id: 'd10',
      players: twoPlayers(),
      ownerId: 'ada',
      kinds: ['skins'],
      stakes: { skins: { ...emptyStake(), amount: '1' } },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const logged = commitHole(save, 1, scored(save, [3, 5]), emptyMarks());
    const score = liveScore(logged);
    const nets = recapCardLines(logged, score, { nets: true, handicaps: false });
    const handicaps = recapCardLines(logged, score, { nets: false, handicaps: true });
    expect(nets.some((line) => line.includes('BB'))).toBe(true);
    expect(nets.some((line) => line.includes('handicap'))).toBe(false);
    expect(nets[nets.length - 1]).toBe(DISCLOSURE);
    expect(handicaps.some((line) => line.includes('handicap'))).toBe(true);
    expect(nets).not.toEqual(handicaps);
    expect(nets.join('\n')).not.toContain('on the line');
    expect(screen.split('{DISCLOSURE}').length - 1).toBeGreaterThanOrEqual(5);
    expect(nets.some((line) => /takes the day|share the day|All square/.test(line))).toBe(true);
    expect(nets.join('\n')).not.toMatch(/[$€£¥]|\b(money|cash|dollars)\b/i);
    expect(screen).toContain('accessibilityLabel="Day amount"');
    expect(screen).toContain('accessibilityLabel="Stableford"');
    expect(screen).toContain('accessibilityLabel="Wolf points"');
    expect(screen).toContain('accessibilityLabel="Who owes who"');
    expect(screen).toContain('accessibilityLabel={`${game.kind} state`}');
  });

  it('rejects a wolf who takes themself', () => {
    const save = buildSave({
      id: 'self-wolf',
      players: fourPlayers(),
      ownerId: 'mike',
      kinds: ['wolf'],
      stakes: {},
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const josh = save.players.find((player) => player.name === 'Josh')!;
    const rows = scored(save, [4, 4, 4, 4]).map((row) => ({ ...row, gross: null, confirmed: false }));
    const take = applyPhrase(rows, 'Josh takes Josh', save, { par: 4, strokeIndex: 1 }, { wolfId: josh.id });
    expect(take.caught).toBe(true);
    expect(take.marks.wolf).toBeNull();
    expect(take.question).toBe("Josh can't take Josh. Pick someone else.");
    expect(take.readback).toBe("Josh can't take Josh. Pick someone else.");
    expect(screen).toContain('player.id !== wolfPlayer.id');
  });

  it('keeps the live strip short enough to enter a hole', () => {
    expect(liveStripHeight(false)).toBeLessThanOrEqual(Math.round(640 * 0.2));
    expect(liveStripHeight(false) / 844).toBeLessThan(0.15);
    expect(liveStripHeight(true)).toBeLessThan(243);
    expect(liveStripHeight(true) / 640).toBeLessThan(0.3);
    expect(screen).toContain('Show live detail');
    expect(screen).toContain('useState(false)');
    expect(screen).toContain('paddingVertical: 6');
    expect(screen).toContain('stripNet: { fontSize: 16, lineHeight: 20');
    expect(screen).toContain('stripDisclosure: { color: colors.white, fontFamily: font.family, fontSize: 11, lineHeight: 14 }');
    expect(screen).toContain('horizontal');
    expect(screen).toContain('numberOfLines={1}');
    expect(screen).not.toMatch(/stripLine: \{[^}]*fontSize: 40/);
    expect(screen).toContain('stripToggle: { minHeight: 44');
    expect(screen).toContain("'▾'");
    expect(screen).toContain("'▴'");
  });

  it('keeps the Birdie Bucks line visible while the live strip is collapsed', () => {
    const live = screen.slice(screen.indexOf('accessibilityLabel="Live strip"'), screen.indexOf("step === 'setup'"));
    const disclosure = live.indexOf('accessibilityLabel="Birdie Bucks"');
    const gate = live.indexOf('{stripOpen ? (');
    expect(disclosure).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(disclosure);
    expect(live.slice(disclosure, gate)).toContain('{DISCLOSURE}');
  });

  it('names the corrected hole instead of this hole', () => {
    let save = buildSave({
      id: 'hole-name',
      players: fourPlayers(),
      ownerId: 'mike',
      kinds: ['skins'],
      stakes: { skins: { ...emptyStake(), amount: '1' } },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    save = commitHole(save, 1, scored(save, [4, 5, 6, 5]), emptyMarks());
    save = commitHole(save, 2, scored(save, [4, 5, 6, 5]), emptyMarks());
    const fixed = correctLastHole(save, 'actually Tony had a 7');
    expect(fixed.hole).toBe(2);
    expect(fixed.readback).toBe('Hole 2: Tony 7');
  });

  it('picks the owner biggest swing for the head-to-head hero', () => {
    const people = [
      { id: stablePlayerId('Mike'), name: 'Mike' },
      { id: stablePlayerId('Dave'), name: 'Dave' },
      { id: stablePlayerId('Tony'), name: 'Tony' },
      { id: stablePlayerId('Josh'), name: 'Josh' },
    ];
    const rounds = [
      { id: 'a', players: people, nets: [100, -100, 0, 0] },
      { id: 'b', players: people, nets: [10, -10, 300, -300] },
    ];
    const owner = rivalryPick(
      [
        { name: 'Mike', isDeviceOwner: true },
        { name: 'Dave' },
        { name: 'Tony' },
        { name: 'Josh' },
      ],
      rounds,
    );
    expect(owner).toEqual({ a: 'Mike', b: 'Josh', winsA: 2, winsB: 0 });
    const open = rivalryPick(
      [{ name: 'Mike' }, { name: 'Dave' }, { name: 'Tony' }, { name: 'Josh' }],
      rounds,
    );
    expect(open?.a).toBe('Tony');
    expect(open?.b).toBe('Josh');
    expect(screen).toContain('rivalryPick');
    expect(screen).not.toContain('const [a, b] = current.players');
  });

  it('shows the pot, the skins count, wolf points, and who owes who', () => {
    expect(potHero(1, 100, 4, false)).toBe('1 skin on the line, 3 BB. No carry-over.');
    expect(potHero(1, null, 4, true)).toBe('1 skin on the line. Carry-over is on.');
    expect(skinsLine(['Mike'], [4], [-1000], 2, false)).toBe('Mike 4 skins, \u221210 BB. 2 on the line');
    expect(wolfPointsTable(['Mike', 'Dave'], [3, 1])).toEqual(['Mike 3', 'Dave 1']);
    expect(stablefordLine(['Mike', 'Dave'], [36, 32])).toBe('Stableford Mike 36');
    expect(oweCombinations(['Mike', 'Dave'], [500, -500])).toEqual(['Dave owes Mike 5 BB']);
    expect(dayAmount([500, -500])).toBe('+5 BB');
    expect(dayAmount([0, 0])).toBeNull();
  });

  it('gives the live-detail toggle a 44px row and a chevron', () => {
    expect(screen).toContain('stripToggle: { minHeight: 44, minWidth: 44, alignItems: \'center\', justifyContent: \'center\' }');
    expect(screen).toContain("{stripOpen ? '▴' : '▾'}");
    expect(liveStripHeight(false)).toBeGreaterThanOrEqual(44);
  });

  it('captures a branded recap card instead of a pixel dump', () => {
    const card = readFileSync(join(here, '../src/games/recap-card.tsx'), 'utf8');
    const shot = readFileSync(join(here, '../src/games/recap-shot.ts'), 'utf8');
    const bitmap = readFileSync(join(here, '../src/games/recap-bitmap.ts'), 'utf8');
    expect(bitmap).not.toContain('function recapPng');
    expect(bitmap).not.toContain('01110');
    expect(card).toContain('coopr-crest.png');
    expect(card).not.toContain('coopr-crest-navy-fill.jpg');
    expect(card).toContain('accessibilityLabel="Crest"');
    expect(pngCornerClear(readFileSync(join(here, '../assets/coopr-crest.png')))).toBe(true);
    expect(card).toContain("backgroundColor: '#0B1F3A'");
    expect(card).toContain("backgroundColor: '#8AC926'");
    expect(card).toContain('fontFamily: display');
    expect(card).toContain('accessibilityLabel="Round winner"');
    expect(card).toContain('{DISCLOSURE}');
    expect(card).not.toContain('potHero');
    expect(card.replace(/\$\{[^}]*\}/g, '')).not.toMatch(/[$€£¥]/);
    expect(shot).toContain("await import('react-native-view-shot')");
    expect(shot).toContain("await import('html-to-image')");
    expect(shot).not.toContain('founder');
    expect(screen).toContain('captureRecap(recapRef)');
    expect(screen).not.toContain('recapPng');
    expect(card).toContain('collapsable={false}');
  });

  it('shows a rejected take and a did-you-mean prompt once', () => {
    const prompt = "Josh can't take Josh. Pick someone else.";
    expect(visiblePhraseLines({ note: prompt, readback: prompt, question: prompt })).toEqual([prompt]);
    const hint = 'Dave is the wolf, did you mean Dave takes Mike?';
    const readback = 'Dave takes Mike. This hole.';
    expect(visiblePhraseLines({ note: hint, readback, question: hint })).toEqual([readback, hint]);
    expect(screen).toContain('visiblePhraseLines');
    expect(screen).toContain('noteLine');
    expect(screen).not.toContain('{heard.question ?');
    const confirm = screen.slice(screen.indexOf('accessibilityLabel="Confirm card"'), screen.indexOf('accessibilityLabel="Check phrase"'));
    expect(confirm.split('cardLines.map').length - 1).toBe(1);
  });

  it('hides the skins pot line once the round is finished', () => {
    const results = screen.slice(screen.indexOf("step === 'results'"), screen.indexOf('function RivalryHero'));
    expect(results).not.toContain('potHero');
    expect(results).not.toContain('Skins breakdown');
    expect(results).not.toContain('Carry-over is on');
    expect(screen).toContain('accessibilityLabel="Pot on the line"');
    const save = buildSave({
      id: 'finished-pot',
      players: twoPlayers(),
      ownerId: 'ada',
      kinds: ['skins'],
      stakes: { skins: { ...emptyStake(), amount: '5' } },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const logged = commitHole(save, 1, scored(save, [3, 5]), emptyMarks());
    const lines = recapCardLines(logged, liveScore(logged), { nets: true, handicaps: false });
    expect(lines.join('\n')).not.toContain('on the line');
    expect(lines.join('\n')).not.toContain('Carry-over');
  });

  it('explains a disabled Blind wolf button when scores are entered', () => {
    expect(BLIND_HOLD).toBe('Blind wolf has to come before the scores');
    expect(screen).toContain('accessibilityLabel="Blind wolf hold"');
    expect(screen).toContain('accessibilityHint={blindHeld ? BLIND_HOLD : undefined}');
    expect(screen).toContain('blindHeld && styles.chipOff');
    expect(screen).toContain('blindRefusalLines');
    expect(screen).not.toContain('setNote(blindAfterScores ? BLIND_HOLD : applied.note)');
    expect(screen).not.toContain('opacity: 0.4');
    expect(screen).not.toContain('opacity: 0.45');
  });

  it('toggles skins carry-over in setup and saves it on the game', () => {
    const on = buildSave({
      id: 'carry-on',
      players: twoPlayers(),
      ownerId: 'ada',
      kinds: ['skins'],
      stakes: { skins: { ...emptyStake(), amount: '1', carry: true } },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const off = buildSave({
      id: 'carry-off',
      players: twoPlayers(),
      ownerId: 'ada',
      kinds: ['skins'],
      stakes: { skins: { ...emptyStake(), amount: '1', carry: false } },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    expect(on.games.find((game) => game.kind === 'skins')?.carry).toBe(true);
    expect(off.games.find((game) => game.kind === 'skins')?.carry).toBe(false);
    const tiedOn = commitHole(on, 1, scored(on, [4, 4]), emptyMarks());
    const tiedOff = commitHole(off, 1, scored(off, [4, 4]), emptyMarks());
    expect(liveScore(tiedOn).skinsPending).toBe(2);
    expect(liveScore(tiedOff).skinsPending).toBe(1);
    expect(screen).toContain('accessibilityLabel="Carry-over"');
    expect(screen).toContain("kind === 'skins'");
    expect(screen).toContain("draft.carry ? 'Carry-over on' : 'Carry-over off'");
  });

  it('shows a refused blind wolf once and does not read the call back', () => {
    const save = buildSave({
      id: 'blind-phrase',
      players: fourPlayers(),
      ownerId: 'mike',
      kinds: ['wolf'],
      stakes: {},
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    const mike = save.players.find((player) => player.name === 'Mike')!;
    const rows = scored(save, [4, 5, 5, 5]);
    const applied = applyPhrase(rows, 'blind wolf', save, { par: 4, strokeIndex: 1 }, { wolfId: mike.id, marks: emptyMarks() });
    expect(applied.readback).toBe('Blind wolf. This hole.');
    const shown = blindRefusalLines({
      readback: applied.readback,
      question: applied.question,
      note: applied.note,
      holdVisible: true,
    });
    expect(shown.readback).toBeNull();
    expect(shown.question).toBeNull();
    expect(shown.note).toBeNull();
    expect(visiblePhraseLines(shown)).toEqual([]);
    const alone = blindRefusalLines({ ...shown, readback: applied.readback, question: applied.question, note: applied.note, holdVisible: false });
    expect(alone.note).toBe(BLIND_HOLD);
    expect(visiblePhraseLines({ note: null, readback: alone.readback, question: alone.question })).toEqual([]);
    expect(refusedBlindReadback('Mike 5. Blind wolf. This hole.')).toBe('Mike 5. This hole.');
    expect(screen).toContain('else setHeard(null)');
    expect(screen).toContain('holdVisible: Boolean(wolfPlayer)');
  });

  it('drops left unplayed on a finished skins round when carry is off', () => {
    let save = buildSave({
      id: 'carry-off-18',
      players: twoPlayers(),
      ownerId: 'ada',
      kinds: ['skins'],
      stakes: { skins: { ...emptyStake(), amount: '1', carry: false } },
      grossOnly: true,
      siOk: true,
      card: CARD,
    })!;
    for (let hole = 1; hole <= 18; hole += 1) save = commitHole(save, hole, scored(save, [4, 4]), emptyMarks());
    const score = liveScore(save);
    expect(score.skinsPending).toBe(1);
    const skins = score.games.find((game) => game.kind === 'skins')!;
    const line = gameLine(skins, { names: ['Ada', 'Bea'], pending: score.skinsPending, finished: true, roster: null, carry: false });
    expect(line).toBe('No skins won');
    expect(line).not.toContain('left unplayed');
    expect(skinsLine(['Ada', 'Bea'], [0, 0], [0, 0], 1, true, true)).toBe('No skins won. 1 left unplayed');
    const results = screen.slice(screen.indexOf("step === 'results'"), screen.indexOf('function RivalryHero'));
    expect(results).toContain('carry: roster?.carry !== false');
  });

  it('gives LOG HOLE its own reason and keeps Finish on the finish control', () => {
    const rows = scored({ players: [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bea' }] }, [4, 5]).map((row) => ({ ...row, gross: null }));
    expect(logHoleReason(rows, emptyMarks(), false)).toBe(LOG_SCORES);
    const ready = scored({ players: [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bea' }, { id: 'c', name: 'Cy' }, { id: 'd', name: 'Di' }] }, [4, 4, 4, 4]);
    expect(logHoleReason(ready, emptyMarks(), true)).toBe(LOG_WOLF);
    expect(logHoleReason(ready, { ...emptyMarks(), wolfSkipped: true }, true)).toBeNull();
    const log = screen.slice(screen.indexOf('accessibilityLabel="Log hole"'), screen.indexOf('accessibilityLabel="Finish round"'));
    expect(log).toContain('accessibilityLabel="Log hole reason"');
    expect(log).toContain('holeReason');
    expect(log).not.toContain('Log a hole before finishing.');
    const finish = screen.slice(screen.indexOf('accessibilityLabel="Finish round"'), screen.indexOf("step === 'results'"));
    expect(finish).toContain('Log a hole before finishing.');
    expect(finish).toContain('accessibilityLabel="Finish hold"');
  });
});
