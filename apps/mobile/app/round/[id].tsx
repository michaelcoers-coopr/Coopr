import { Pressable, StyleSheet, Text } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { readArchive } from '../../src/analysis/archive';
import { RecapBody, type RecapHole } from '../../src/design/recap-view';
import { Muted, Screen, Title } from '../../src/ui';

export default function RoundDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const round = readArchive().find((item) => item.id === id) ?? null;
  const holes: RecapHole[] = (round?.holes ?? []).map((hole) => ({
    par: hole.par,
    strokes: hole.strokes,
    putts: hole.putts,
    fairway: hole.fairway ?? null,
    gir: hole.gir ?? null,
  }));
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false, title: 'Round' }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Title>Round recap</Title>
      {round ? <Text style={styles.meta}>{`${round.playedOn} · ${round.courseName}`}</Text> : <Muted>That round is not on this phone.</Muted>}
      {round ? <RecapBody holes={holes} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minWidth: 44, minHeight: 44, justifyContent: 'center', paddingRight: 12 },
  backText: { color: '#0B1F3A', fontSize: 17, fontWeight: '700' },
  meta: { color: '#0B1F3A', fontSize: 16, fontWeight: '700' },
});
