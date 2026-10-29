import * as Speech from 'expo-speech';

export type SpeechPhase = 'speaking' | 'silent';

let speechMuted = false;
let phase: SpeechPhase = 'silent';
const listeners = new Set<(next: SpeechPhase) => void>();
const active = new Set<() => void>();

function setPhase(next: SpeechPhase): void {
  phase = next;
  for (const listener of listeners) listener(next);
}

export function isSpeechMuted(): boolean {
  return speechMuted;
}

/** Mute stops the sentence that is playing, not only the next one. */
export function setSpeechMuted(next: boolean): void {
  speechMuted = next;
  if (!next) return;
  try {
    Speech.stop();
  } catch {
    /* Web can lack a voice. */
  }
  for (const finish of [...active]) finish();
  active.clear();
  setPhase('silent');
}

export function subscribeSpeech(listener: (next: SpeechPhase) => void): () => void {
  listeners.add(listener);
  listener(phase);
  return () => {
    listeners.delete(listener);
  };
}

function holdSpeech(): boolean {
  const flag = globalThis as { __cooprHoldSpeech?: boolean };
  return flag.__cooprHoldSpeech === true;
}

/** Device speech now. ElevenLabs is a later voice behind the same calls. */
export interface CaddieSpeaker {
  readonly kind: 'device' | 'elevenlabs';
  speak(sentence: string): Promise<void>;
  stop(): void;
}

export function deviceSpeaker(): CaddieSpeaker {
  return {
    kind: 'device',
    speak(sentence) {
      return new Promise((resolve) => {
        if (speechMuted) {
          setPhase('silent');
          resolve();
          return;
        }
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          active.delete(finish);
          if (!speechMuted) setPhase('silent');
          resolve();
        };
        active.add(finish);
        setPhase('speaking');
        const timer = setTimeout(finish, holdSpeech() ? 30_000 : 1400);
        try {
          Speech.stop();
          Speech.speak(sentence, {
            language: 'en-US',
            rate: 1.02,
            onDone: () => {
              if (holdSpeech()) return;
              clearTimeout(timer);
              finish();
            },
            onStopped: () => {
              clearTimeout(timer);
              finish();
            },
            onError: () => {
              clearTimeout(timer);
              finish();
            },
          });
        } catch {
          clearTimeout(timer);
          finish();
        }
      });
    },
    stop() {
      try {
        Speech.stop();
      } catch {
        /* Web can lack a voice. The words stay on screen. */
      }
    },
  };
}

/** Slot for a later ElevenLabs voice. It does not speak and does not pretend to. */
export function elevenLabsSpeaker(): CaddieSpeaker {
  return {
    kind: 'elevenlabs',
    speak() {
      return Promise.reject(new Error('ElevenLabs voice is not connected.'));
    },
    stop() {},
  };
}

export function caddieSpeaker(kind: 'device' | 'elevenlabs' = 'device'): CaddieSpeaker {
  return kind === 'elevenlabs' ? elevenLabsSpeaker() : deviceSpeaker();
}

/** Speak each sentence, and stop at the first barge-in. */
export async function speakSentences(speaker: CaddieSpeaker, sentences: readonly string[], gate: { stopped: boolean }): Promise<void> {
  for (const sentence of sentences) {
    if (gate.stopped || speechMuted) {
      speaker.stop();
      setPhase('silent');
      return;
    }
    try {
      await speaker.speak(sentence);
    } catch {
      speaker.stop();
      return;
    }
    if (gate.stopped) {
      speaker.stop();
      return;
    }
  }
}
