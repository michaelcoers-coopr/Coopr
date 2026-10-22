import { serveVoice } from '../../src/voice-host';

export function OPTIONS(request: Request) {
  return serveVoice(request);
}

export function POST(request: Request) {
  return serveVoice(request);
}
