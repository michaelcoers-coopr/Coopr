import { parseAsk } from '@coopr/engine';

const payload = JSON.parse(process.env.COOPR_VOICE_JSON ?? '') as { transcript?: unknown; mode?: unknown; error?: unknown };
if (!payload || typeof payload.transcript !== 'string') {
  const message = typeof payload?.error === 'string' ? payload.error : 'The voice route did not return a transcript.';
  console.error(message);
  process.exit(1);
}
const intent = await parseAsk(payload.transcript);
console.log(JSON.stringify({ transcript: payload.transcript, mode: payload.mode ?? null, intent }, null, 2));
