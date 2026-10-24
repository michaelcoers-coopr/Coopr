import { serveCaddie } from '../../src/caddie-host';

export function OPTIONS(request: Request) {
  return serveCaddie(request);
}

export function POST(request: Request) {
  return serveCaddie(request);
}
