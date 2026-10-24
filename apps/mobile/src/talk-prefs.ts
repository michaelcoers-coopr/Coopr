import { useEffect, useState } from 'react';

const HANDS_KEY = 'coopr.talk.handsFree';
const CALLOUT_KEY = 'coopr.talk.callouts';

export interface TalkPrefs {
  handsFree: boolean;
  callouts: boolean;
}

function readFlag(key: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function readTalkPrefs(): TalkPrefs {
  return { handsFree: readFlag(HANDS_KEY), callouts: readFlag(CALLOUT_KEY) };
}

export function writeTalkPref(key: 'handsFree' | 'callouts', on: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key === 'handsFree' ? HANDS_KEY : CALLOUT_KEY, on ? '1' : '0');
  } catch {
    /* Private mode keeps the toggle for this visit only. */
  }
}

export function useTalkPrefs(): TalkPrefs & { setHandsFree: (on: boolean) => void; setCallouts: (on: boolean) => void } {
  const [prefs, setPrefs] = useState<TalkPrefs>({ handsFree: false, callouts: false });
  useEffect(() => {
    setPrefs(readTalkPrefs());
  }, []);
  return {
    ...prefs,
    setHandsFree: (on) => {
      writeTalkPref('handsFree', on);
      setPrefs((current) => ({ ...current, handsFree: on }));
    },
    setCallouts: (on) => {
      writeTalkPref('callouts', on);
      setPrefs((current) => ({ ...current, callouts: on }));
    },
  };
}
