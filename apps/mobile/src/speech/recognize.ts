/**
 * Apple's on-device recognizer in a dev or TestFlight build.
 * Expo Go has no native module, so this returns null and the typed Ask path stays.
 */
export interface HeardSpeech {
  stop: () => void;
}

export async function deviceSpeechAvailable(): Promise<boolean> {
  try {
    const mod = await import('expo-speech-recognition');
    return mod.ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function listenForSpeech(onText: (text: string, final: boolean) => void, hints: string[] = []): Promise<HeardSpeech | null> {
  try {
    const mod = await import('expo-speech-recognition');
    const speech = mod.ExpoSpeechRecognitionModule;
    if (!speech.isRecognitionAvailable()) return null;
    // Keep the audio on the phone. Without this flag iOS may send it to Apple's servers.
    // A missing on-device model falls back to the typed Ask.
    if (!speech.supportsOnDeviceRecognition()) return null;
    const permission = await speech.requestPermissionsAsync();
    if (!permission.granted) return null;
    const result = speech.addListener('result', (event) => {
      const text = event.results[0]?.transcript ?? '';
      if (text) onText(text, event.isFinal);
    });
    const end = speech.addListener('end', () => {
      onText('', true);
    });
    const failed = speech.addListener('error', () => {
      onText('', true);
    });
    speech.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: true,
      contextualStrings: hints,
    });
    return {
      stop: () => {
        result.remove();
        end.remove();
        failed.remove();
        try {
          speech.abort();
        } catch {
          /* Already stopped. */
        }
      },
    };
  } catch {
    return null;
  }
}
