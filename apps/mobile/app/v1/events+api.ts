import { eventStore } from '../../src/events/file-store';
import { serveEvent } from '../../src/events/serve';

export function OPTIONS(request: Request) {
  return serveEvent(request, eventStore());
}

export function GET(request: Request) {
  return serveEvent(request, eventStore());
}

export function POST(request: Request) {
  return serveEvent(request, eventStore());
}
