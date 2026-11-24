/**
 * Create the charity table and seed SAMPLE.
 * Mike runs this from the repo root: npm run event-store:migrate
 * DATABASE_URL is a Neon connection string. This script does not deploy.
 */
import { seedSampleEvent } from '../src/events/adapter';
import { databaseUrl } from '../src/events/live';
import { createPostgresEventAdapter } from '../src/events/postgres';

const url = databaseUrl();
if (!url) {
  console.error('DATABASE_URL is missing. Export the Neon connection string and run this again.');
  process.exit(1);
}

const adapter = createPostgresEventAdapter(url);
await seedSampleEvent(adapter);
const sample = await adapter.read('SAMPLE');
if (!sample) {
  console.error('SAMPLE did not seed.');
  process.exit(1);
}
console.log(`coopr_charity_events is ready. SAMPLE is at revision ${sample.revision}.`);
