import { createServer } from 'node:http';
import { handleExtractBuffer, type ExtractEnv } from '@coopr/engine';

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
  if (req.method !== 'POST' || req.url?.split('?')[0] !== '/v1/extract') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found.', imageRetained: false }));
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += piece.length;
    if (size > MAX_BYTES) {
      res.writeHead(413, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'The photo is larger than 8 MB. It was not kept.', imageRetained: false }));
      req.destroy();
      return;
    }
    chunks.push(piece);
  }
  const body = Buffer.concat(chunks);
  const env: ExtractEnv = {
    EXTRACT_MODE: process.env.EXTRACT_MODE,
    EXTRACT_TOKEN: process.env.EXTRACT_TOKEN,
    COOPR_VISION_API_KEY: process.env.COOPR_VISION_API_KEY,
    COOPR_VISION_BASE_URL: process.env.COOPR_VISION_BASE_URL,
    COOPR_VISION_MODEL: process.env.COOPR_VISION_MODEL,
  };
  const result = await handleExtractBuffer(body, typeof req.headers.authorization === 'string' ? req.headers.authorization : null, env);
  res.writeHead(result.status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result.body));
});

server.listen(port, () => {
  const live = process.env.EXTRACT_MODE === 'live' && Boolean(process.env.COOPR_VISION_API_KEY);
  console.log(`COOPR extract listening on ${port}. Mode ${live ? 'live' : 'stub'}. Images are not written to disk.`);
});
