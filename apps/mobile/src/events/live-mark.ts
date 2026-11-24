import { useEffect, useState } from 'react';
import { flushEventOutbox, loadPublicEvent, loadSession, outboxNote, POLL_MS } from './client';
import type { PublicEvent } from './types';

export interface LiveMark {
  line: string;
  logoUrl: string | null;
}

/** Quiet hole mark. Nothing renders when this phone is not in an event. */
export function useLiveEventMark(hole: number): LiveMark | null {
  const [mark, setMark] = useState<LiveMark | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const session = loadSession();
      if (!session) {
        if (!stop) setMark(null);
        return;
      }
      await flushEventOutbox();
      let event: PublicEvent | null = null;
      try {
        event = await loadPublicEvent(session.code);
      } catch {
        event = null;
      }
      if (stop) return;
      const sponsor = event?.logos.find((logo) => logo.slot === 'hole' && logo.hole === hole) ?? null;
      const sync = outboxNote();
      const watching = session.role === 'viewer' ? 'Watching' : null;
      const line = [sponsor?.name ?? session.eventName, watching, sync].filter(Boolean).join(' · ');
      setMark({ line, logoUrl: sponsor?.dataUrl ?? null });
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [hole]);
  return mark;
}
