/**
 * Web preview has no wa-sqlite worker in this export. The same migration text is
 * applied and tested with Node's SQLite. iOS and Android use boot-db.ts.
 */
export async function bootDatabase(): Promise<string> {
  return 'Web preview keeps play in memory. SQLite schema v1 is applied on iOS and Android.';
}
