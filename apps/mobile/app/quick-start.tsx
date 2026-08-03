import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HANDICAP_BANDS } from '@coopr/core';
import { useTheme } from '../src/theme';
import { H1, Body, Label } from '../src/ui';
import { enterQuickStart } from '../src/features/session-mode';

export default function QuickStart() {
  const t = useTheme();
  const router = useRouter();

  const pick = (band: string) => {
    enterQuickStart(band);
    router.replace('/home');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <Label>Quick start</Label>
        <H1>What's your handicap?</H1>
        <Body muted>
          Pick a range and we'll set you up with average distances for that skill — enough to get real advice right now.
          Log your own shots any time and it all becomes truly yours.
        </Body>

        <View style={{ height: t.spacing.lg }} />
        {HANDICAP_BANDS.map((b) => (
          <Pressable
            key={b.key}
            onPress={() => pick(b.key)}
            style={{
              backgroundColor: t.surfaceRaised, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth,
              borderRadius: t.radius.md, padding: t.spacing.lg, marginVertical: t.spacing.xs,
            }}
          >
            <Body style={{ fontWeight: '700', fontSize: t.fontSize.lg }}>{b.label}</Body>
            <Body muted style={{ marginTop: 2 }}>{b.hint}</Body>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
