import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { loadHighCedarsPilot } from '@coopr/course';
import { useLocalStore } from '../src/local-store';
import { Screen, Title } from '../src/ui';

const pilot = loadHighCedarsPilot();

function versus(diff: number): string {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : String(diff);
}

export default function RecapScreen() {
  const { holes, putts, fairways, girs, startNewRound } = useLocalStore();
  const card = pilot.record.scorecard;
  let gross = 0;
  let parSum = 0;
  let scored = 0;
  let puttSum = 0;
  let fairwayHits = 0;
  let fairwayHoles = 0;
  let girHits = 0;
  let girHoles = 0;
  const front = { strokes: 0, par: 0 };
  const back = { strokes: 0, par: 0 };
  holes.forEach((strokes, index) => {
    const par = card.find((hole) => hole.holeNumber === index + 1)?.par ?? null;
    if (strokes == null || par == null) return;
    scored += 1;
    gross += strokes;
    parSum += par;
    const side = index < 9 ? front : back;
    side.strokes += strokes;
    side.par += par;
    const putt = putts[index];
    if (putt != null) puttSum += putt;
    if (par >= 4) {
      fairwayHoles += 1;
      if (fairways[index] === 'hit') fairwayHits += 1;
    }
    girHoles += 1;
    if (girs[index] === true) girHits += 1;
  });
  const toPar = scored === 0 ? 'No score saved' : `Gross ${gross} · ${versus(gross - parSum)}`;
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false, title: 'Recap' }} />
      <Title>Round recap</Title>
      <Text style={styles.gross}>{toPar}</Text>
      <Text style={styles.line}>{`Front ${front.strokes || '—'} (${versus(front.strokes - front.par)}) · Back ${back.strokes || '—'} (${versus(back.strokes - back.par)})`}</Text>
      <Text style={styles.line}>{`Putts ${puttSum}`}</Text>
      <Text style={styles.line}>{`Fairways ${fairwayHits} of ${fairwayHoles}`}</Text>
      <Text style={styles.line}>{`Greens ${girHits} of ${girHoles}`}</Text>
      <View style={styles.grid}>
        {holes.map((strokes, index) => {
          const par = card.find((hole) => hole.holeNumber === index + 1)?.par ?? null;
          const mark = strokes == null || par == null ? '—' : versus(strokes - par);
          return <Text key={index} style={styles.hole}>{`${index + 1} ${strokes ?? '—'} ${mark}`}</Text>;
        })}
      </View>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  gross: { color: '#0B1F3A', fontSize: 28, fontWeight: '800' },
  line: { color: '#0B1F3A', fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hole: { minWidth: 72, color: '#0B1F3A', fontSize: 16, fontWeight: '700' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: '#0B1F3A', fontSize: 16, fontWeight: '800', textDecorationLine: 'underline' },
  done: { minHeight: 48, borderRadius: 14, backgroundColor: '#8AC926', alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#0B1F3A', fontSize: 18, fontWeight: '800' },
});
