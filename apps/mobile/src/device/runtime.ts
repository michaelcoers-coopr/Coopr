import { emptySnapshot, parseSnapshot, serializeSnapshot, type DeviceSnapshot } from './snapshot';

interface Backend {
  read(): string | null;
  write(json: string): void;
}

let snapshot: DeviceSnapshot = emptySnapshot();
let backend: Backend | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function installBackend(next: Backend): void {
  backend = next;
}

export function load(): void {
  if (!backend) return;
  try {
    snapshot = parseSnapshot(backend.read());
  } catch {
    snapshot = emptySnapshot();
  }
  notify();
}

export function readSnapshot(): DeviceSnapshot {
  return snapshot;
}

export function updateSnapshot(change: (current: DeviceSnapshot) => DeviceSnapshot): void {
  snapshot = change(snapshot);
  try {
    backend?.write(serializeSnapshot(snapshot));
  } catch {
    // This visit keeps the copy. The next successful write stores it.
  }
  notify();
}

export function subscribeSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetRuntime(): void {
  snapshot = emptySnapshot();
  backend = null;
  listeners.clear();
}
