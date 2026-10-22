const HEX = '0123456789abcdef';

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => HEX[b >> 4]! + HEX[b & 0x0f]!).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * UUIDv7 (RFC 9562): 48-bit unix time in milliseconds, version nibble 7,
 * variant bits 10. Entropy is caller-supplied so imports and tests stay deterministic.
 */
export function uuidv7(unixMs: number, entropy: Uint8Array): string {
  if (!Number.isFinite(unixMs) || unixMs < 0 || unixMs > 2 ** 48 - 1) {
    throw new Error('uuidv7 time must be a non-negative 48-bit millisecond value');
  }
  if (entropy.length < 10) throw new Error('uuidv7 needs 10 entropy bytes');
  const bytes = new Uint8Array(16);
  const time = BigInt(Math.floor(unixMs));
  bytes[0] = Number((time >> 40n) & 255n);
  bytes[1] = Number((time >> 32n) & 255n);
  bytes[2] = Number((time >> 24n) & 255n);
  bytes[3] = Number((time >> 16n) & 255n);
  bytes[4] = Number((time >> 8n) & 255n);
  bytes[5] = Number(time & 255n);
  bytes[6] = 0x70 | (entropy[0]! & 0x0f);
  bytes[7] = entropy[1]!;
  bytes[8] = 0x80 | (entropy[2]! & 0x3f);
  for (let i = 0; i < 7; i++) bytes[9 + i] = entropy[3 + i]!;
  return formatUuid(bytes);
}

/** Stable entropy for a sequence index. Not a secret and not for security tokens. */
export function deterministicEntropy(sequence: number): Uint8Array {
  const out = new Uint8Array(10);
  let x = Math.imul(sequence + 1, 0x9e3779b1) >>> 0;
  for (let i = 0; i < 10; i++) {
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
    out[i] = x & 0xff;
  }
  return out;
}

export function createIdFactory(unixMs: number): () => string {
  let n = 0;
  return () => uuidv7(unixMs, deterministicEntropy(n++));
}
