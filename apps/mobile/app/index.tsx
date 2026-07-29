import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { Button, Wordmark } from '../src/ui';

// Branded landing / hero. Placeholder rendition of the COOPR wordmark (the two linked
// "O" rings in the launch green) — swap for the final brand asset when approved. Colors
// come from tokens; the accent is swappable.
export default function Hero() {
  const t = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: t.spacing.xl, justifyContent: 'space-between', paddingVertical: t.spacing.xxl }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Wordmark size={56} />
          <Text
            style={{
              color: t.accent, fontSize: t.fontSize.sm, fontWeight: '800', letterSpacing: 3,
              marginTop: t.spacing.xl, textAlign: 'center',
            }}
          >
            KNOW YOUR GAME.{'\n'}PLAY YOUR GAME.
          </Text>
          <Text
            style={{
              color: t.textSecondary, fontSize: t.fontSize.md, textAlign: 'center', lineHeight: 24,
              marginTop: t.spacing.xl, maxWidth: 320,
            }}
          >
            The smartest shot, every time — built on your numbers, not generic averages.
          </Text>
        </View>

        <View>
          <Text style={{ color: t.textMuted, fontSize: t.fontSize.xs, textAlign: 'center', marginBottom: t.spacing.md }}>
            Your bag and history are loaded and ready.
          </Text>
          <Button title="ENTER COOPR" onPress={() => router.replace('/home')} />
        </View>
      </View>
    </SafeAreaView>
  );
}
