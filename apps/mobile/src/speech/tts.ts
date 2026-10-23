import * as Speech from 'expo-speech';

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
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const timer = setTimeout(finish, 1400);
        try {
          Speech.stop();
          Speech.speak(sentence, {
            language: 'en-US',
            rate: 1.02,
            onDone: () => {
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
    if (gate.stopped) {
      speaker.stop();
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
