import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { parsePhrase, type ParseContext, type ParsePlayer } from '../src/index'

const dir = dirname(fileURLToPath(import.meta.url))
const expected = JSON.parse(readFileSync(join(dir, '../fixtures/expected_full.json'), 'utf8')) as Array<{ id: string; say: string; parse: unknown }>
const utterances = JSON.parse(readFileSync(join(dir, '../fixtures/utterances.json'), 'utf8')) as {
  core: Array<{ id: string; ctx: string }>
  events: Array<{ id: string; ctx: string }>
}
const context = JSON.parse(readFileSync(join(dir, '../fixtures/context.json'), 'utf8')) as {
  roster: ParsePlayer[]
  hole1: { par: number; strokes: Record<string, number> }
}

function ctxFor(k: string): ParseContext {
  const hole = context.hole1
  const base: ParseContext = { players: context.roster, par: hole.par, strokes: hole.strokes, hole: 1 }
  if (k === 'hole1_logged') base.lastLogged = 1
  if (k === 'hole_par_unknown') {
    base.par = null
    base.strokes = {}
  }
  if (k === 'hole1_wolf_josh') base.wolfId = 'p_josh'
  return base
}

function same(a: unknown, b: unknown, path: string): void {
  if (typeof a === 'number' && typeof b === 'number') {
    assert.equal(a, b, path)
    return
  }
  if (a === b) return
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
    assert.deepEqual(a, b, path)
    return
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    assert.ok(Array.isArray(a) && Array.isArray(b), path)
    assert.equal(a.length, (b as unknown[]).length, path + ' length')
    a.forEach((item, i) => same(item, (b as unknown[])[i], `${path}[${i}]`))
    return
  }
  const ak = Object.keys(a).sort()
  const bk = Object.keys(b as object).sort()
  assert.deepEqual(ak, bk, path + ' keys')
  for (const key of ak) same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`)
}

const ctxById = new Map<string, string>()
for (const row of [...utterances.core, ...utterances.events]) ctxById.set(row.id, row.ctx)

describe('phrase parser', () => {
  test('every fixture parse matches expected_full.json', () => {
    assert.equal(expected.length, 16)
    for (const row of expected) {
      const got = parsePhrase(row.say, ctxFor(ctxById.get(row.id) ?? 'hole1'))
      same(got, row.parse, row.id)
    }
  })

  test('an unrecognized phrase asks instead of inventing a score', () => {
    const got = parsePhrase('nice weather', ctxFor('hole1'))
    assert.equal(got.intent, 'unknown')
    assert.deepEqual(got.questions, ['Sorry, I didn\'t catch scores. Try “Mike 5, Dave birdie…”'])
    assert.equal(got.scores.length, 0)
  })
})
