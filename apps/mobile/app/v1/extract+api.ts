import { serveExtract } from '../../src/extract-host';

export function OPTIONS(request: Request) {
  return serveExtract(request);
}

export function POST(request: Request) {
  return serveExtract(request);
}
