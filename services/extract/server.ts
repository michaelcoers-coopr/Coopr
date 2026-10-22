import { createServer } from 'node:http';
import { handleExtractBuffer, handleVoiceBuffer, type ExtractEnv, type VoiceEnv } from '@coopr/engine';

const port = Number(process.env.PORT || 8787);
const MAX_BYTES = 8 * 1024 * 1024;

const server = createServer(async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('access-control-allow-origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
    res.writeHead(204);
    res.end();
    return;
  }
  const path = req.url?.split('?')[0];
  if (req.method !== 'POST' || (path !== '/v1/extract' && path !== '/v1/voice')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found.', imageRetained: false, audioRetained: false }));
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += piece.length;
    if (size > MAX_BYTES) {
      res.writeHead(413, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'The upload is larger than 8 MB. It was not kept.', imageRetained: false, audioRetained: false }));
      req.destroy();
      return;
    }
    chunks.push(piece);
  }
  const body = Buffer.concat(chunks);
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : null;
  if (path === '/v1/voice') {
    const env: VoiceEnv = {
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      ELEVENLABS_STT_MODEL: process.env.ELEVENLABS_STT_MODEL,
      ELEVENLABS_STT_URL: process.env.ELEVENLABS_STT_URL,
      EXTRACT_TOKEN: process.env.EXTRACT_TOKEN,
      VOICE_MODE: process.env.VOICE_MODE,
    };
    const result = await handleVoiceBuffer(body, authorization, env);
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.body));
    return;
  }
  const env: ExtractEnv = {
    EXTRACT_MODE: process.env.EXTRACT_MODE,
    EXTRACT_TOKEN: process.env.EXTRACT_TOKEN,
    COOPR_VISION_API_KEY: process.env.COOPR_VISION_API_KEY,
    COOPR_VISION_BASE_URL: process.env.COOPR_VISION_BASE_URL,
    COOPR_VISION_MODEL: process.env.COOPR_VISION_MODEL,
  };
  const result = await handleExtractBuffer(body, authorization, env);
  res.writeHead(result.status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result.body));
});

server.listen(port, () => {
  const live = process.env.EXTRACT_MODE === 'live' && Boolean(process.env.COOPR_VISION_API_KEY);
  const voice = Boolean(process.env.ELEVENLABS_API_KEY) && process.env.VOICE_MODE !== 'sample';
  console.log(`COOPR extract listening on ${port}. Photos ${live ? 'live' : 'stub'}. Voice ${voice ? 'scribe' : 'sample'}. Audio and images are not written to disk.`);
});
