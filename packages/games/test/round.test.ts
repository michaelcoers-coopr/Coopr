import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  BANNED_WORD,
  DISCLOSURE,
  dayLine,
  fmt,
  headToHead,
  ownerRound,
  playedOnDate,
  recapText,
  savedWolfCall,
  scoreFoursome,
  scoreSkins,
  scoreWolf,
  seasonTable,
  stablefordPoints,
  userFacingCopy,
  type FoursomeSave,
  type GrossCell,
} from '../src/index'

const PAR = [5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4]
const SI = [7, 11, 17, 1, 13, 3, 15, 5, 9, 8, 4, 18, 2, 12, 16, 6, 10, 14]
const GROSS = [
  [5, 4, 6, 7], [3, 4, 6, 5], [3, 4, 5, 3], [5, 3, 6, 5], [5, 4, 3, 4], [6, 5, 8, 7],
  [5, 3, 3, 4], [4, 6, 6, 5], [5, 4, 4, 5], [5, 3, 6, 3], [7, 7, 7, 6], [3, 4, 5, 4],
  [4, 5, 3, 4], [3, 4, 3, 3], [4, 2, 4, 5], [5, 6, 5, 7], [4, 4, 4, 3], [5, 5, 4, 4],
]

function partner(wolf: number, mate: number) {
  return { mode: 'partner' as const, wolf, partner: mate }
}
const WOLF = [
  partner(0, 1), partner(1, 0), partner(2, 0), partner(3, 1), partner(0, 2), partner(1, 0), partner(2, 1), partner(3, 0),
  { mode: 'lone' as const, wolf: 0 },
  partner(1, 3), partner(2, 3), partner(3, 0), partner(0, 2),
  { mode: 'blind' as const, wolf: 1 },
  partner(2, 1), partner(3, 2), partner(2, 3), partner(0, 2),
]

function sampleSave(): FoursomeSave {
  const players = [
    { id: 'p_mike', name: 'Mike', courseHandicap: 14, isDeviceOwner: true },
    { id: 'p_dave', name: 'Dave', courseHandicap: 9, isDeviceOwner: false },
    { id: 'p_tony', name: 'Tony', courseHandicap: 18, isDeviceOwner: false },
    { id: 'p_josh', name: 'Josh', courseHandicap: 22, isDeviceOwner: false },
  ]
  return {
    id: 'sample',
    courseName: 'Sample card',
    players,
    grossOnly: false,
    wholeUnits: false,
    finishedOn: null,
    games: [
      { kind: 'skins', stake: 500, carry: true },
      { kind: 'nassau', stake: null, front: 2000, back: 2000, total: 2000, press: null, teamA: ['p_mike', 'p_josh'], teamB: ['p_dave', 'p_tony'] },
      { kind: 'wolf', stake: 100 },
      { kind: 'stableford', stake: 1000, pot: true },
    ],
    holes: PAR.map((par, i) => ({
      number: i + 1,
      par,
      strokeIndex: SI[i]!,
      scores: GROSS[i]!.map((gross, p) => ({ playerId: players[p]!.id, gross, pickup: false })),
      wolf: WOLF[i]!.mode === 'partner'
        ? { mode: 'partner' as const, wolfId: players[WOLF[i]!.wolf]!.id, partnerId: players[WOLF[i]!.partner]!.id }
        : { mode: WOLF[i]!.mode, wolfId: players[WOLF[i]!.wolf]!.id, partnerId: null },
    })),
  }
}

describe('round, recap, and local season', () => {
  test('a saved round reproduces the sample settle-up', () => {
    const save = sampleSave()
    const score = scoreFoursome(save)
    assert.deepEqual(score.exactNets, [4000, -3600, -5600, 5200])
    assert.deepEqual(score.settle.map((row) => row.line).sort(), [
      'Dave owes Mike 36 BB',
      'Tony owes Josh 52 BB',
      'Tony owes Mike 4 BB',
    ])
    const text = recapText(save, score)
    assert.match(text, /Tony owes Josh 52 BB/)
    assert.match(text, /Dave owes Mike 36 BB/)
    assert.ok(text.includes(DISCLOSURE))
    assert.equal(text.includes(save.courseName), false)
    assert.equal(text.includes('14'), false)
    assert.equal(BANNED_WORD.test(text), false)
  })

  test('user-facing copy keeps the banned words out', () => {
    for (const line of userFacingCopy()) assert.equal(BANNED_WORD.test(line), false, line)
    const copy = readFileSync(new URL('../src/copy.ts', import.meta.url), 'utf8')
    assert.equal(copy.includes('LAWYER_OPEN'), false)
    assert.equal(copy.includes('DEFERRED_ONLINE'), false)
    const notes = readFileSync(new URL('../../../docs/GAMES_DEFERRED.md', import.meta.url), 'utf8')
    assert.equal(notes.includes('money-transmission'), true)
    assert.equal(notes.includes('leaderboard-sync'), true)
  })

  test('an evening round keeps the local date and drops unplayed holes', () => {
    assert.equal(playedOnDate('2026-10-25T04:41:00.000Z', 'America/Los_Angeles'), '2026-10-24')
    assert.equal(playedOnDate('2026-10-24'), '2026-10-24')
    const save = sampleSave()
    save.holes = save.holes.map((hole) => (hole.number === 1 ? hole : { ...hole, scores: [] }))
    save.finishedOn = '2026-10-25T04:41:00.000Z'
    const owner = ownerRound(save, { timeZone: 'America/Los_Angeles' })
    assert.equal(owner?.playedOn, '2026-10-24')
    assert.equal(owner?.holes.length, 1)
    assert.equal(owner?.holes.every((hole) => hole.strokes != null), true)
    save.holes = save.holes.map((hole) => ({ ...hole, scores: [] }))
    assert.equal(ownerRound(save), null)
  })

  test('a saved wolf call uses the hole wolf when the phrase names someone else', () => {
    const names = { mike: 'Mike', dave: 'Dave', tony: 'Tony', josh: 'Josh' }
    const call = savedWolfCall({
      mode: 'partner',
      namedWolfId: 'josh',
      partnerId: 'mike',
      holeWolfId: 'dave',
      names,
    })
    assert.equal(call?.wolfId, 'dave')
    assert.equal(call?.partnerId, 'mike')
    assert.equal(call?.question, 'Dave is the wolf, did you mean Dave takes Mike?')
    const players = [
      { id: 'mike', name: 'Mike', courseHandicap: 0, isDeviceOwner: true },
      { id: 'dave', name: 'Dave', courseHandicap: 0, isDeviceOwner: false },
      { id: 'tony', name: 'Tony', courseHandicap: 0, isDeviceOwner: false },
      { id: 'josh', name: 'Josh', courseHandicap: 0, isDeviceOwner: false },
    ]
    const hole = (wolfId: string, partnerId: string) => ({
      number: 1,
      par: 4,
      strokeIndex: 1,
      scores: [
        { playerId: 'mike', gross: 4, pickup: false },
        { playerId: 'dave', gross: 3, pickup: false },
        { playerId: 'tony', gross: 5, pickup: false },
        { playerId: 'josh', gross: 5, pickup: false },
      ],
      wolf: { mode: 'partner' as const, wolfId, partnerId },
    })
    const round = (wolfId: string, partnerId: string): FoursomeSave => ({
      id: 'wolf-call',
      courseName: 'Card',
      players,
      grossOnly: true,
      wholeUnits: false,
      finishedOn: null,
      games: [{ kind: 'wolf', stake: 100 }],
      holes: [hole(wolfId, partnerId)],
    })
    const saved = round(call!.wolfId, call!.partnerId)
    assert.equal(saved.holes[0]?.wolf?.wolfId, 'dave')
    const scored = scoreFoursome(saved).games.find((game) => game.kind === 'wolf')?.points
    const dave = scoreWolf([[4, 3, 5, 5]], [{ mode: 'partner', wolf: 1, partner: 0 }], [0, 0, 0, 0], [1])
    const josh = scoreWolf([[4, 3, 5, 5]], [{ mode: 'partner', wolf: 3, partner: 0 }], [0, 0, 0, 0], [1])
    assert.deepEqual(scored, dave)
    assert.notDeepEqual(dave, josh)
    assert.notDeepEqual(scored, scoreFoursome(round('josh', 'mike')).games.find((game) => game.kind === 'wolf')?.points)
  })

  test('an all-square Nassau names nobody, and the share line is not repeated', () => {
    const players = [
      { id: 'mike', name: 'Mike', courseHandicap: 0, isDeviceOwner: true },
      { id: 'dave', name: 'Dave', courseHandicap: 0, isDeviceOwner: false },
      { id: 'tony', name: 'Tony', courseHandicap: 0, isDeviceOwner: false },
      { id: 'josh', name: 'Josh', courseHandicap: 0, isDeviceOwner: false },
    ]
    const tied: FoursomeSave = {
      id: 'tied',
      courseName: 'Card',
      players,
      grossOnly: true,
      wholeUnits: false,
      finishedOn: null,
      games: [{ kind: 'nassau', stake: null, front: 100, back: null, total: null, press: null, teamA: ['mike', 'dave'], teamB: ['tony', 'josh'] }],
      holes: [{
        number: 1,
        par: 4,
        strokeIndex: 1,
        scores: players.map((player) => ({ playerId: player.id, gross: 4, pickup: false })),
      }],
    }
    const nassau = scoreFoursome(tied).games.find((game) => game.kind === 'nassau')
    assert.deepEqual(nassau?.winners, [])
    assert.equal(nassau?.line, 'All square')
    assert.equal(dayLine(players.map((player) => player.name), [0, 0, 0, 0]), 'All square')
    const skins: FoursomeSave = {
      id: 'skins',
      courseName: 'Card',
      players: players.slice(0, 2),
      grossOnly: true,
      wholeUnits: false,
      finishedOn: null,
      games: [{ kind: 'skins', stake: 100 }],
      holes: [{
        number: 1,
        par: 4,
        strokeIndex: 1,
        scores: [
          { playerId: 'mike', gross: 3, pickup: false },
          { playerId: 'dave', gross: 5, pickup: false },
        ],
      }],
    }
    const score = scoreFoursome(skins)
    const text = recapText(skins, score)
    const leader = `Mike ${fmt(score.nets[0] ?? 0, undefined, true)}`
    assert.match(text, /Mike takes the day/)
    assert.equal(text.split(leader).length - 1, 1)
    assert.equal(text.split('\n').filter((line) => line === leader).length, 0)
  })

  test('a pickup cannot win a skin and scores 0 in Stableford', () => {
    const row: GrossCell[][] = [['pickup', 4, 5, 6]]
    const skins = scoreSkins(row, [0, 0, 0, 0], SI)
    assert.equal(skins.won[0], 0)
    assert.equal(skins.won[1], 1)
    assert.equal(stablefordPoints('pickup', 4, 0, false), 0)
    assert.equal(stablefordPoints('pickup', 4, 0, true), -3)
  })

  test('local season nets stay zero-sum and head-to-head is antisymmetric', () => {
    const rounds = [
      { id: 'a', players: [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bea' }], nets: [300, -300] },
      { id: 'b', players: [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bea' }], nets: [-100, 100] },
    ]
    const table = seasonTable(rounds)
    assert.equal(table.reduce((s, row) => s + row.net, 0), 0)
    const ab = headToHead(rounds, 'a', 'b')
    const ba = headToHead(rounds, 'b', 'a')
    assert.equal(ab.gap, -ba.gap)
    assert.equal(ab.winsA, ba.winsB)
    assert.equal(ab.winsB, ba.winsA)
    assert.equal(ab.ties, ba.ties)
  })
})
