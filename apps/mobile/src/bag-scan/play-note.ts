import type { ScanDraft } from './types';

export const SHOTS_FIRST_NOTE = 'This club stays in Add club. It is not in the bag until you keep it. Log shots on the hole first.';

let held: ScanDraft | null = null;
let note: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function leaveDraftForShots(draft: ScanDraft): void {
  held = { ...draft };
  note = SHOTS_FIRST_NOTE;
  emit();
}

export function readHeldDraft(): ScanDraft | null {
  return held ? { ...held } : null;
}

export function readPlayNote(): string | null {
  return note;
}

export function dismissPlayNote(): void {
  note = null;
  emit();
}

export function clearHeldDraft(): void {
  held = null;
  note = null;
  emit();
}

export function subscribePlayNote(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
