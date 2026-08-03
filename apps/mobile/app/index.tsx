import { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { Button, Wordmark, Body } from '../src/ui';
import { getMode, resetExperience } from '../src/db/settings';
import { enterSample, enterOwnSetup } from '../src/features/session-mode';

// Branded landing / hero. On first run it forks into "explore the sample" vs "quick
// start" vs "set up my own". Placeholder wordmark until the final brand asset.
export default function Hero() {
  const t = useTheme();
  const router = useRouter();
  const [mode, setModeState] = useState(getMode());

  const sample = () => {
    enterSample();
    router.replace('/home');
  };
  const ownSetup = () => {
    enterOwnSetup();
    router.replace('/onboarding');
  };
  const startOver = () => {
    resetExperience();
    setModeState(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: t.spacing.xl, justifyContent: 'space-between', paddingVertical: t.spacing.xxl }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Wordmark size={56} />
          <Text style={{ color: t.accent, fontSize: t.fontSize.sm, fontWeight: '800', letterSpacing: 3, marginTop: t.spacing.xl, textAlign: 'center' }}>
            KNOW YOUR GAME.{'\n'}PLAY YOUR GAME.
          </Text>
          <Text style={{ color: t.textSecondary, fontSize: t.fontSize.md, textAlign: 'center', lineHeight: 24, marginTop: t.spacing.xl, maxWidth: 320 }}>
            The smartest shot, every time — built on your numbers, not generic averages.
          </Text>
        </View>

        <View>
          {mode ? (
            <>
              <Button title="ENTER COOPR" onPress={() => router.replace('/home')} />
              <Button title="Hand it to someone new" kind="ghost" onPress={startOver} />
            </>
          ) : (
            <>
              <Body muted style={{ textAlign: 'center', marginBottom: t.spacing.sm, fontSize: t.fontSize.xs }}>
                Try it in ten seconds.
              </Body>
              <Button title="EXPLORE THE SAMPLE GOLFER" onPress={sample} />
              <Button title="QUICK START — PICK YOUR HANDICAP" kind="ghost" onPress={() => router.push('/quick-start')} />
              <Body onPress={ownSetup} muted style={{ textAlign: 'center', marginTop: t.spacing.md }}>
                Enter my own shots ›
              </Body>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
