import { Pressable, StyleSheet, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { loadHighCedarsPilot } from '@coopr/course';
import { RecapBody, type RecapHole } from '../src/design/recap-view';
import { useLocalStore } from '../src/local-store';
import { Screen, Title } from '../src/ui';

const pilot = loadHighCedarsPilot();

export default function RecapScreen() {
  const { holes, putts, fairways, girs, startNewRound } = useLocalStore();
  const card = pilot.record.scorecard;
  const rows: RecapHole[] = holes.map((strokes, index) => ({
    strokes,
    par: card.find((hole) => hole.holeNumber === index + 1)?.par ?? null,
    putts: putts[index] ?? null,
    fairway: fairways[index] ?? null,
    gir: girs[index] ?? null,
  }));
  return (
    <Screen
      footer={
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Past rounds" onPress={() => router.push('/rounds')} style={styles.link}>
            <Text style={styles.linkText}>Past rounds</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            testID="recap-done"
            onPress={() => {
              startNewRound();
              router.replace('/');
            }}
            style={styles.done}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </>
      }
    >
      <Stack.Screen options={{ headerShown: false, title: 'Recap' }} />
      <Title>Round recap</Title>
      <RecapBody holes={rows} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  linkText: { color: '#0B1F3A', fontSize: 16, fontWeight: '800', textDecorationLine: 'underline' },
  done: { minHeight: 48, borderRadius: 14, backgroundColor: '#8AC926', alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#0B1F3A', fontSize: 18, fontWeight: '800' },
});
