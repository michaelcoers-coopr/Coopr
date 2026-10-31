import { useEffect, useState } from 'react';
import { readDevice, writePlayerSettings } from './device-store';
import { setSpeechMuted } from './speech/tts';

export interface TalkPrefs {
  handsFree: boolean;
  callouts: boolean;
  muted: boolean;
}

export function readTalkPrefs(): TalkPrefs {
  const settings = readDevice().settings;
  return { handsFree: settings.handsFree, callouts: settings.callouts, muted: settings.muted };
}

export function writeTalkPref(key: 'handsFree' | 'callouts' | 'muted', on: boolean): void {
  writePlayerSettings({ [key]: on });
}

export function useTalkPrefs(): TalkPrefs & { setHandsFree: (on: boolean) => void; setCallouts: (on: boolean) => void; setMuted: (on: boolean) => void } {
  const [prefs, setPrefs] = useState<TalkPrefs>({ handsFree: false, callouts: false, muted: false });
  useEffect(() => {
    setPrefs(readTalkPrefs());
  }, []);
  useEffect(() => {
    setSpeechMuted(prefs.muted);
  }, [prefs.muted]);
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
    setMuted: (on) => {
      writeTalkPref('muted', on);
      setPrefs((current) => ({ ...current, muted: on }));
    },
  };
}
