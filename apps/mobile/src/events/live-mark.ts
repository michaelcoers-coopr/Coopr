import { useEffect, useState } from 'react';
import { rememberEventCard } from './card';
import { flushEventOutbox, loadPublicEvent, loadSession, outboxNote, saveSession, POLL_MS } from './client';
import type { PublicEvent } from './types';

export interface LiveMulligan {
  used: number;
  cap: number;
  price: string;
  sponsor: string | null;
}

export interface LiveMark {
  line: string;
  logoUrl: string | null;
  mulligan: LiveMulligan | null;
  startingHole: number | null;
  scorerName: string;
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
      if (event && event.pars.length === 18) {
        rememberEventCard({ code: session.code, courseName: event.courseName, pars: event.pars });
        saveSession({ ...session, pars: [...event.pars], courseName: event.courseName });
      }
      const sponsor = event?.logos.find((logo) => logo.slot === 'hole' && logo.hole === hole) ?? null;
      const photo = event?.logos.find((logo) => logo.slot === 'kid-photo' && logo.hole === hole) ?? null;
      const mulliganLogo = event?.logos.find((logo) => logo.slot === 'mulligan') ?? null;
      const row = event?.rows.find((item) => item.groupId === session.groupId) ?? null;
      const sync = outboxNote();
      const watching = session.role === 'viewer' ? 'Watching' : null;
      const names = [sponsor?.name, photo?.name].filter(Boolean);
      const line = [names.length > 0 ? names.join(' · ') : session.eventName, watching, sync].filter(Boolean).join(' · ');
      const group = event?.groups.find((item) => item.id === session.groupId) ?? null;
      const mulligan = event && event.mulliganMax > 0 && row && row.mulliganCap > 0
        ? { used: row.mulligansUsed, cap: row.mulliganCap, price: event.mulliganPriceLabel, sponsor: mulliganLogo?.name ?? null }
        : null;
      setMark({
        line,
        logoUrl: sponsor?.dataUrl ?? photo?.dataUrl ?? null,
        mulligan,
        startingHole: group?.startingHole ?? null,
        scorerName: group?.players.find((player) => player.role === 'scorer')?.name ?? session.scorerName ?? 'the scorer',
      });
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
