import { readFileSync } from 'node:fs';

const text = readFileSync(0, 'utf8');
const start = text.indexOf('{');
const end = text.lastIndexOf('}');
if (start < 0 || end < start) {
  console.error('eas deploy did not return JSON.');
  process.exit(1);
}
let parsed;
try {
  parsed = JSON.parse(text.slice(start, end + 1));
} catch {
  console.error('eas deploy did not return JSON.');
  process.exit(1);
}
const raw = parsed?.production?.url || parsed?.url;
if (typeof raw !== 'string' || !raw.startsWith('https://')) {
  console.error('eas deploy JSON had no https url.');
  process.exit(1);
}
process.stdout.write(new URL(raw).origin);
