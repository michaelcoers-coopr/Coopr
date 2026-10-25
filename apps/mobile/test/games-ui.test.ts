import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BANNED_WORD, DISCLOSURE } from '@coopr/games';
import {
  acceptRow,
  applyPhrase,
  blankPlayer,
  buildSave,
  emptyStake,
  logReady,
  playerHandicap,
  recapFor,
  setupBlock,
  tapGross,
  type SetupPlayer,
} from '../src/games/present';
import type { FoursomeSave } from '@coopr/games';

const here = dirname(fileURLToPath(import.meta.url));
const screen = readFileSync(join(here, '../app/games.tsx'), 'utf8');
const home = readFileSync(join(here, '../app/index.tsx'), 'utf8');
const ask = readFileSync(join(here, '../src/design/floating-ask.tsx'), 'utf8');
const speech = readFileSync(join(here, '../src/speech/recognize.ts'), 'utf8');

const CARD = Array.from({ length: 18 }, (_, index) => ({ par: index === 0 ? 5 : 4, strokeIndex: index + 1 }));

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
    const accepted = acceptRow(heard.rows, 'p_josh');
    const tapped = tapGross(accepted, 'p_mike', 5);
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
                { playerId: 'ada', gross: 4, pickup: false },
                { playerId: 'bea', gross: 5, pickup: false },
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
  });
});
