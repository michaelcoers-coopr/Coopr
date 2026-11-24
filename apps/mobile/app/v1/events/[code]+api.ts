import { serveLiveEvent } from '../../../src/events/live';

export function OPTIONS(request: Request) {
  return serveLiveEvent(request);
}

export function GET(request: Request) {
  return serveLiveEvent(request);
}

export function PATCH(request: Request) {
  return serveLiveEvent(request);
}
