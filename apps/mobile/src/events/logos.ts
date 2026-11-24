import { LOGO_MAX_BYTES } from './types';

export type LogoCheck = { ok: true; bytes: number } | { ok: false; error: string };

function bytesOfBase64(payload: string): Uint8Array | null {
  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * PNG, JPEG, or SVG. SVG must not carry a script, an event handler, or a javascript: URL.
 * The file is stored as the data URL the organizer uploaded. The screen fits it with contain.
 */
export function inspectLogo(dataUrl: string): LogoCheck {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return { ok: false, error: 'Use a PNG, JPG, or SVG file.' };
  }
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return { ok: false, error: 'Use a PNG, JPG, or SVG file.' };
  const meta = dataUrl.slice(5, comma).toLowerCase();
  const payload = dataUrl.slice(comma + 1);
  const mime = meta.split(';')[0] ?? '';
  const allowed = mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/svg+xml';
  if (!allowed) return { ok: false, error: 'Use a PNG, JPG, or SVG file.' };
  const base64 = meta.includes(';base64');
  let bytes: Uint8Array;
  let text = '';
  if (base64) {
    const cleaned = payload.replace(/\s/g, '');
    if (cleaned.length > Math.ceil(LOGO_MAX_BYTES * 4 / 3) + 8) {
      return { ok: false, error: 'Logo must be 512 KB or smaller.' };
    }
    const decoded = bytesOfBase64(cleaned);
    if (!decoded) return { ok: false, error: 'That file could not be read.' };
    bytes = decoded;
  } else {
    try {
      text = decodeURIComponent(payload);
    } catch {
      text = payload;
    }
    bytes = new TextEncoder().encode(text);
  }
  if (bytes.length > LOGO_MAX_BYTES) return { ok: false, error: 'Logo must be 512 KB or smaller.' };
  if (mime === 'image/svg+xml') {
    const source = text || new TextDecoder().decode(bytes);
    if (!/<svg[\s>]/i.test(source)) return { ok: false, error: 'That SVG could not be read.' };
    if (/<script/i.test(source) || /javascript:/i.test(source) || /\son[a-z]+\s*=/i.test(source)) {
      return { ok: false, error: 'That SVG is not allowed.' };
    }
    return { ok: true, bytes: bytes.length };
  }
  if (mime === 'image/png') {
    const png = [137, 80, 78, 71];
    if (!png.every((byte, index) => bytes[index] === byte)) return { ok: false, error: 'That PNG could not be read.' };
    return { ok: true, bytes: bytes.length };
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return { ok: false, error: 'That JPG could not be read.' };
  }
  return { ok: true, bytes: bytes.length };
}
