import { v7 as uuidv7 } from 'uuid';

// Client-generated, time-ordered ids so rows created offline never collide on sync.
export function newId(): string {
  return uuidv7();
}
