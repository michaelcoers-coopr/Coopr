import { dayLine, DISCLOSURE, fmt, type FoursomeSave, type RoundScore } from '@coopr/games';
import { dayAmount, potHero, stablefordLine, wolfPointsTable } from './present';

export interface RecapCardOptions {
  nets: boolean
  handicaps: boolean
}

/** The lines drawn on the recap bitmap. Toggles add facts. They do not invent any. */
export function recapCardLines(save: FoursomeSave, score: RoundScore, options: RecapCardOptions): string[] {
  const names = save.players.map((player) => player.name)
  const lines = ['COOPR', dayLine(names, score.nets)]
  const amount = dayAmount(score.nets)
  if (amount) lines.push(amount)
  const stable = score.games.find((game) => game.kind === 'stableford' || game.kind === 'modified')
  const stableLine = stablefordLine(names, stable?.points ?? null)
  if (stableLine) lines.push(stableLine)
  const wolf = score.games.find((game) => game.kind === 'wolf')
  if (wolf?.points) {
    for (const row of wolfPointsTable(names, wolf.points)) lines.push(`Wolf ${row}`)
  }
  const skins = score.games.find((game) => game.kind === 'skins')
  const skinsGame = save.games.find((game) => game.kind === 'skins')
  if (skins) lines.push(potHero(score.skinsPending, skinsGame?.stake ?? null, save.players.length, skinsGame?.carry !== false))
  if (options.nets) {
    save.players.forEach((player, index) => {
      lines.push(`${player.name} ${fmt(score.nets[index] ?? 0, undefined, true)}`)
    })
  }
  if (options.handicaps) {
    for (const player of save.players) {
      if (player.courseHandicap == null) continue
      lines.push(`${player.name} handicap ${player.courseHandicap}`)
    }
  }
  for (const row of score.settle) lines.push(row.line)
  lines.push(DISCLOSURE)
  return lines
}

const GLYPH: Record<string, string> = {
  ' ': '00000000000000000000000000000000000',
  '0': '01110100011001110101110011000101110',
  '1': '00100011000010000100001000010001110',
  '2': '01110100010000100010001000100011111',
  '3': '11110000010000101110000010000111110',
  '4': '10001100011000111111000010000100001',
  '5': '11111100001000011110000010000111110',
  '6': '01110100001000011110100011000101110',
  '7': '11111000010001000100010000100001000',
  '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010000101110',
  A: '01110100011000111111100011000110001',
  B: '11110100011000111110100011000111110',
  C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111',
  F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111',
  H: '10001100011111110001100011000110001',
  I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100',
  K: '10001100101010011000101001001010001',
  L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001',
  N: '10001110011010110011100011000110001',
  O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101',
  R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110',
  T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110',
  V: '10001100011000110001010100010000100',
  W: '10001100011000110101101011010101010',
  X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100',
  Z: '11111000010001000100010001000011111',
  '+': '00100001001111100100001000000000000',
  '-': '00000000001111100000000000000000000',
  '.': '00000000000000000000000000110001100',
  ',': '00000000000000000000001000010001000',
  "'": '00100001000000000000000000000000000',
}

function glyphFor(char: string): string {
  if (char === '\u2212' || char === '\u2013') return GLYPH['-']!
  const upper = char.toUpperCase()
  return GLYPH[upper] ?? GLYPH[char] ?? GLYPH[' ']!
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (~crc) >>> 0
}

function adler32(data: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of data) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out[4] = type.charCodeAt(0)
  out[5] = type.charCodeAt(1)
  out[6] = type.charCodeAt(2)
  out[7] = type.charCodeAt(3)
  out.set(data, 8)
  const crc = crc32(out.subarray(4, 8 + data.length))
  view.setUint32(8 + data.length, crc)
  return out
}

function storedZlib(raw: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = []
  const max = 65535
  for (let offset = 0; offset < raw.length || blocks.length === 0; offset += max) {
    const slice = raw.subarray(offset, Math.min(raw.length, offset + max))
    const last = offset + max >= raw.length
    const block = new Uint8Array(5 + slice.length)
    block[0] = last ? 1 : 0
    block[1] = slice.length & 255
    block[2] = (slice.length >> 8) & 255
    const nlen = (~slice.length) & 0xffff
    block[3] = nlen & 255
    block[4] = (nlen >> 8) & 255
    block.set(slice, 5)
    blocks.push(block)
    if (raw.length === 0) break
  }
  const adler = adler32(raw)
  const body = concat(blocks)
  const out = new Uint8Array(2 + body.length + 4)
  out[0] = 0x78
  out[1] = 0x01
  out.set(body, 2)
  const view = new DataView(out.buffer)
  view.setUint32(2 + body.length, adler)
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function wrap(line: string, width: number): string[] {
  if (line.length <= width) return [line]
  const words = line.split(' ')
  const rows: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > width && current) {
      rows.push(current)
      current = word
    } else current = next
  }
  if (current) rows.push(current)
  return rows.length ? rows : ['']
}

const NAVY = [0x0b, 0x1f, 0x3a] as const
const LIME = [0x8a, 0xc9, 0x26] as const
const CREST = ['01110', '10001', '10000', '10000', '10001', '01110']

function paint(pixels: Uint8Array, width: number, height: number, x: number, y: number, rgb: readonly [number, number, number]): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const at = (y * width + x) * 4
  pixels[at] = rgb[0]
  pixels[at + 1] = rgb[1]
  pixels[at + 2] = rgb[2]
  pixels[at + 3] = 255
}

/** A real PNG of the recap lines. Navy ground, lime crest and numerals, white type. */
export function recapPng(lines: string[]): Uint8Array {
  const scale = 3
  const rows = lines.flatMap((line) => wrap(line, 42))
  const longest = rows.reduce((max, line) => Math.max(max, line.length), 1)
  const width = 24 + longest * (5 * scale + scale)
  const crestBand = 28
  const height = crestBand + 16 + rows.length * (7 * scale + scale * 2)
  const pixels = new Uint8Array(width * height * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = NAVY[0]
    pixels[i + 1] = NAVY[1]
    pixels[i + 2] = NAVY[2]
    pixels[i + 3] = 255
  }
  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < width; x += 1) paint(pixels, width, height, x, y, LIME)
  }
  CREST.forEach((row, gy) => {
    for (let gx = 0; gx < row.length; gx += 1) {
      if (row[gx] !== '1') continue
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sx = 0; sx < 2; sx += 1) paint(pixels, width, height, 12 + gx * 2 + sx, 10 + gy * 2 + sy, LIME)
      }
    }
  })
  const hero = rows.findIndex((line) => /takes the day|share the day|all square/i.test(line))
  rows.forEach((line, row) => {
    const y = crestBand + row * (7 * scale + scale * 2)
    const heroLine = row === hero
    for (let column = 0; column < line.length; column += 1) {
      const char = line[column]!
      const bits = glyphFor(char)
      const numeral = char >= '0' && char <= '9'
      const rgb = heroLine || numeral ? LIME : ([255, 255, 255] as const)
      const x0 = 12 + column * (5 * scale + scale)
      for (let gy = 0; gy < 7; gy += 1) {
        for (let gx = 0; gx < 5; gx += 1) {
          if (bits[gy * 5 + gx] !== '1') continue
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              paint(pixels, width, height, x0 + gx * scale + sx, y + gy * scale + sy, rgb)
            }
          }
        }
      }
    }
  })
  const raw = new Uint8Array(height * (1 + width * 4))
  for (let y = 0; y < height; y += 1) {
    const start = y * (1 + width * 4)
    raw[start] = 0
    raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), start + 1)
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
  return concat([signature, chunk('IHDR', ihdr), chunk('IDAT', storedZlib(raw)), chunk('IEND', new Uint8Array())])
}

export function downloadPng(bytes: Uint8Array, filename: string): boolean {
  const doc = globalThis.document
  if (!doc) return false
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  const blob = new Blob([copy], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  const link = doc.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return true
}
