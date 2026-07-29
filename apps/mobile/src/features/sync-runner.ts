import { registry } from '../providers/registry';
import { SyncEngine } from '../db/sync';

// Runs a sync pass if (and only if) a cloud SyncProvider is configured. Wrapped so a
// missing provider or an offline failure is a no-op — local SQLite stays authoritative
// and play is never gated (invariant 4).
let inFlight = false;

export async function runSyncSafely(): Promise<void> {
  if (!registry.sync || inFlight) return;
  inFlight = true;
  try {
    await new SyncEngine(registry.sync).sync();
  } catch {
    // Offline, or backend not yet provisioned. Local data remains the source of truth.
  } finally {
    inFlight = false;
  }
}
