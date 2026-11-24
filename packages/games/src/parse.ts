import { pyRound, sequenceRatio } from './ratio'

const NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}
const REL: Record<string, number> = {
  albatross: -3, eagle: -2, birdie: -1, birdied: -1, par: 0, parred: 0, bogey: 1, bogeyed: 1, double: 2, triple: 3, quad: 4, quadruple: 4,
}
const SPECIAL: Record<string, number> = { snowman: 8, ace: 1 }
const FILLER = new Set([
  'got', 'get', 'gets', 'a', 'an', 'had', 'made', 'make', 'shot', 'with', 'for', 'on', 'the', 'and', 'then', 'took',
  'scored', 'was', 'he', 'she', 'they', 'it', 'at', 'of', 'to', 'his', 'her', 'hole', 'that', 'what', 'uh', 'um', 'like', 'okay', 'ok', 'so', 'by',
])
const COINS: Record<string, string> = {
  greenie: 'greenie', greeny: 'greenie', sandie: 'sandie', sandy: 'sandie', arnie: 'arnie', arny: 'arnie', barkie: 'barkie', barky: 'barkie',
}

export interface ParsePlayer {
  id: string
  name: string
  aliases?: string[]
  isDeviceOwner?: boolean
}

export interface ParseContext {
  players: ParsePlayer[]
  par?: number | null
  strokes?: Record<string, number | null>
  hole?: number
  lastLogged?: number | null
  pending?: unknown
  wolfId?: string | null
}

type Result = ['pickup', null, string[]] | ['gross' | 'rel' | 'net', number, string[]]

interface PState {
  has?: boolean
  prev?: boolean
  flags: Set<string>
  conf: number
  evidence?: string
  kind?: Result[0]
  val?: number | null
  fuzzy?: boolean
  spoken?: string
}

export interface ParseResult {
  schemaVersion: 'coopr.parseResult/1'
  transcript: string
  intent: string
  scores: Array<Record<string, unknown>>
  events: Array<Record<string, unknown>>
  questions: string[]
  commands: Array<{ type: string }>
  needsConfirm?: string[]
  target?: string
}

export function norm(s: string): string[] {
  let t = s.toLowerCase().replace(/’/g, "'")
  t = t.replace(/[^a-z0-9' ]/g, ' ')
  t = t.replace(/\bhole in one\b/g, 'ace')
  t = t.replace(/\bdouble eagle\b/g, 'albatross')
  t = t.replace(/\bdouble bogey\b/g, 'double')
  t = t.replace(/\btriple bogey\b/g, 'triple')
  t = t.replace(/\bpicked up\b|\bpick up\b|\bpickup\b|\bpicks up\b/g, 'pickup')
  t = t.replace(/\beveryone else\b|\beverybody else\b|\bthe rest\b|\brest of us\b/g, 'group')
  t = t.replace(/\beveryone\b|\beverybody\b|\bothers\b|\ball\b/g, 'group')
  t = t.replace(/\blone wolf\b/g, 'lonewolf')
  t = t.replace(/\bblind wolf\b/g, 'blindwolf')
  t = t.replace(/\bno wait\b|\bwait no\b|\bscratch that\b|\bi mean\b|\bmake that\b|\bcorrection\b|\bno no\b/g, 'CORR')
  t = t.replace(/\bnext hole\b/g, 'skip')
  return t.split(/\s+/).filter((tok) => tok.length > 0)
}

export function resolveName(tok: string, players: ParsePlayer[]): [string | null, number, boolean] {
  if (tok === 'me' || tok === 'i' || tok === 'myself' || tok === "i've" || tok === "i'm") {
    for (const p of players) {
      if (p.isDeviceOwner) return [p.id, 1, false]
    }
  }
  let bestId: string | null = null
  let best = 0
  for (const p of players) {
    const names = [p.name.toLowerCase(), ...(p.aliases ?? []).map((a) => a.toLowerCase())]
    if (names.includes(tok)) return [p.id, 1, false]
    for (const n of names) {
      const r = sequenceRatio(tok, n) + (tok.slice(0, 1) === n.slice(0, 1) ? 0.2 : 0)
      if (r > best) {
        bestId = p.id
        best = r
      }
    }
  }
  if (best >= 0.85) return [bestId, 0.9, false]
  if (best >= 0.5 && tok.length >= 3) return [bestId, pyRound(best * 0.85, 2), true]
  return [null, 0, false]
}

function strokeOf(strokes: Record<string, number | null> | undefined, id: string): number | null {
  if (!strokes || !Object.prototype.hasOwnProperty.call(strokes, id)) return null
  const v = strokes[id]
  return v == null ? null : v
}

export function parsePhrase(transcript: string, ctx: ParseContext): ParseResult {
  const players = ctx.players
  const par = ctx.par ?? null
  const strokes = ctx.strokes ?? {}
  const toks = norm(transcript)
  const out: ParseResult = {
    schemaVersion: 'coopr.parseResult/1',
    transcript,
    intent: 'hole_entry',
    scores: [],
    events: [],
    questions: [],
    commands: [],
  }
  if (toks.includes('skip') && toks.length <= 4) {
    out.intent = 'command'
    out.commands = [{ type: 'skip_hole' }]
    return out
  }
  if (toks.includes('undo') && toks.length <= 4) {
    out.intent = 'command'
    out.commands = [{ type: 'undo' }]
    return out
  }
  let posthoc = toks.length > 0 && toks[0] === 'CORR'
  const raw = transcript.toLowerCase()
  if (/^\s*(actually|no wait|scratch that|make that|change|correction)/.test(raw)) posthoc = true

  const ev: Array<Record<string, unknown>> = []
  const state: Record<string, PState> = {}
  let cur: string | null = null
  let pending: Result | null = null
  let netflag = false
  let groupRes: Result | null = null
  const exceptIds = new Set<string>()
  let inExcept = false
  let sawCorr = false
  const namesSeen: string[] = []

  const setRes = (pid: string, res: Result, evText: string) => {
    const [kind, val, flags] = res
    const e = state[pid] ?? { flags: new Set<string>(), conf: 1 }
    const fl = new Set(flags)
    if ((state[pid]?.has) || state[pid]?.prev) fl.add('corrected')
    state[pid] = {
      has: true,
      flags: fl,
      conf: e.conf ?? 1,
      evidence: evText,
      kind,
      val,
      fuzzy: e.fuzzy ?? false,
      spoken: e.spoken,
    }
  }

  let i = 0
  while (i < toks.length) {
    const t = toks[i]!
    if (t === 'CORR') {
      sawCorr = true
      i += 1
      continue
    }
    if (t === 'except') {
      inExcept = true
      i += 1
      continue
    }
    if (Object.hasOwn(COINS, t)) {
      const nxt = i + 1 < toks.length ? toks[i + 1]! : null
      let pid: string | null = null
      let conf = 1
      if (nxt) {
        const resolved = resolveName(nxt, players)
        pid = resolved[0]
        conf = resolved[1]
      }
      if (pid == null && cur) pid = cur
      if (pid) ev.push({ type: 'coin', playerId: pid, coin: COINS[t], confidence: conf, evidence: t + (nxt ? ' ' + nxt : '') })
      const consumed = nxt != null && resolveName(nxt, players)[0] != null
      i += consumed ? 2 : 1
      continue
    }
    if (t === 'bingo' || t === 'bango' || t === 'bongo') {
      const nxt = i + 1 < toks.length ? toks[i + 1]! : null
      const [pid, conf] = nxt ? resolveName(nxt, players) : [null, 0, false]
      if (pid) {
        ev.push({ type: t, playerId: pid, confidence: conf, evidence: t + ' ' + nxt })
        i += 2
        continue
      }
    }
    if (t === 'lonewolf' || t === 'blindwolf') {
      ev.push({
        type: 'wolf_pick',
        playerId: ctx.wolfId ?? null,
        wolfMode: t === 'lonewolf' ? 'lone' : 'blind',
        partnerId: null,
        confidence: 1,
        evidence: t,
      })
      i += 1
      continue
    }
    if ((t === 'takes' || t === 'take') && cur) {
      const nxt = i + 1 < toks.length ? toks[i + 1]! : null
      const [pid, conf] = nxt ? resolveName(nxt, players) : [null, 0, false]
      if (pid) {
        const who = namesSeen.length ? namesSeen[namesSeen.length - 1] : ''
        ev.push({
          type: 'wolf_pick',
          playerId: cur,
          wolfMode: 'partner',
          partnerId: pid,
          confidence: conf,
          evidence: `${who} takes ${nxt}`,
        })
        i += 2
        cur = null
        continue
      }
    }
    if (t === 'press' || (t === 'it' && i > 0 && toks[i - 1] === 'press')) {
      if (t === 'press') ev.push({ type: 'press', playerId: null, confidence: 1, evidence: 'press' })
      i += 1
      continue
    }
    if (t === 'pickup') {
      if (cur != null && !state[cur]?.has) {
        setRes(cur, ['pickup', null, []], 'picked up')
        i += 1
        continue
      }
      pending = ['pickup', null, []]
      i += 1
      continue
    }
    if (t === 'net') {
      netflag = true
      i += 1
      continue
    }
    if (t === 'gross') {
      i += 1
      continue
    }
    let res: Result | null = null
    if (/^\d+$/.test(t)) {
      const n = Number(t)
      if (n >= 1 && n <= 15) res = ['gross', n, []]
    } else if (Object.hasOwn(NUM, t)) res = ['gross', NUM[t]!, []]
    else if (Object.hasOwn(SPECIAL, t)) res = ['gross', SPECIAL[t]!, ['from_relative_term']]
    else if (Object.hasOwn(REL, t)) res = ['rel', REL[t]!, ['from_relative_term']]
    else if (t === 'group') {
      let j = i + 1
      while (j < toks.length && FILLER.has(toks[j]!)) j += 1
      if (j < toks.length) {
        const u = toks[j]!
        if (Object.hasOwn(REL, u) || Object.hasOwn(NUM, u) || /^\d+$/.test(u)) {
          if (/^\d+$/.test(u)) groupRes = ['gross', Number(u), ['from_rest_group']]
          else if (Object.hasOwn(NUM, u)) groupRes = ['gross', NUM[u]!, ['from_rest_group']]
          else groupRes = ['rel', REL[u]!, ['from_relative_term', 'from_rest_group']]
          i = j + 1
          continue
        }
      }
      i += 1
      continue
    }
    if (res) {
      if (netflag) {
        res = ['net', res[1], [...res[2], 'from_net']]
        netflag = false
      }
      if (cur != null && !state[cur]?.has) setRes(cur, res, t)
      else pending = res
      i += 1
      continue
    }
    if (FILLER.has(t)) {
      i += 1
      continue
    }
    const [pid, conf, fuzzy] = resolveName(t, players)
    if (pid) {
      cur = pid
      namesSeen.push(t)
      const existing = state[pid]
      if (!(sawCorr && existing?.has)) {
        if (!state[pid]) state[pid] = { flags: new Set(), conf: 1 }
      }
      const row = state[pid]!
      row.conf = !row.has ? Math.min(conf, row.conf ?? 1) : (row.conf ?? 1)
      if (fuzzy) {
        row.fuzzy = true
        row.conf = conf
      }
      row.spoken = t
      if (sawCorr && row.has) {
        row.has = false
        row.prev = true
      }
      if (pending != null && !row.has) {
        setRes(pid, pending, t)
        pending = null
      }
      if (inExcept) exceptIds.add(pid)
    }
    i += 1
  }

  if (groupRes) {
    for (const p of players) {
      if (exceptIds.has(p.id)) continue
      if (!state[p.id]?.has) setRes(p.id, groupRes, 'group')
    }
  }

  for (const p of players) {
    const s = state[p.id]
    if (!s?.has) continue
    let flags = [...s.flags].sort()
    if (s.prev && !flags.includes('corrected')) flags.push('corrected')
    if (s.fuzzy) flags.push('name_fuzzy')
    flags = [...new Set(flags)].sort()
    const conf = s.conf ?? 1
    const rec: Record<string, unknown> = {
      playerId: p.id,
      confidence: conf,
      evidence: s.evidence,
      flags,
    }
    const k = s.kind
    const v = s.val
    const st = strokeOf(strokes, p.id)
    if (k === 'pickup') {
      rec.state = 'pickup'
      rec.gross = null
      rec.toPar = null
      rec.question = null
    } else if (k === 'gross') {
      rec.state = 'scored'
      rec.gross = v
      rec.toPar = par != null && typeof v === 'number' ? v - par : null
      rec.question = null
    } else if (k === 'rel') {
      if (par == null) {
        rec.state = 'unresolved'
        rec.gross = null
        rec.toPar = v
        rec.question = "What's par on this hole?"
      } else if (typeof v === 'number') {
        rec.state = 'scored'
        rec.gross = par + v
        rec.toPar = v
      }
    } else if (k === 'net') {
      if (st == null) {
        rec.state = 'unresolved'
        rec.gross = null
        rec.toPar = null
        rec.question = `Net ${v} for ${p.name}: how many strokes does ${p.name} get here?`
      } else if (typeof v === 'number') {
        rec.state = 'scored'
        rec.gross = v + st
        rec.toPar = par != null ? v + st - par : null
      }
    }
    if (rec.state === 'scored' && !(typeof rec.gross === 'number' && rec.gross >= 1 && rec.gross <= 15)) {
      rec.question = `${p.name}: ${String(rec.gross)}? Please say it again.`
      rec.state = 'unresolved'
      rec.gross = null
    }
    rec.strokesReceived = st
    rec.net = typeof rec.gross === 'number' && st != null ? rec.gross - st : null
    if (typeof rec.confidence === 'number' && rec.confidence < 0.8 && flags.includes('name_fuzzy')) {
      rec.question = `Heard “${s.spoken ?? ''}”. ${p.name}?`
    }
    out.scores.push(rec)
  }
  out.events = ev
  out.needsConfirm = out.scores
    .filter((r) => (r.confidence as number) < 0.8 || r.state === 'unresolved')
    .map((r) => r.playerId as string)
  if (posthoc) {
    out.intent = 'correction'
    out.target = ctx.pending ? 'pending_entry' : 'last_logged_hole'
  }
  if (out.scores.length === 0 && ev.length === 0) {
    out.intent = 'unknown'
    out.questions = ['Sorry, I didn\'t catch scores. Try “Mike 5, Dave birdie…”']
  }
  return out
}
