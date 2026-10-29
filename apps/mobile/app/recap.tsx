import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useLocalStore } from '../src/local-store';
import { Screen, Title } from '../src/ui';

export default function RecapScreen() {
  const { holes, score, startNewRound } = useLocalStore();
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false, title: 'Recap' }} />
      <Title>Round recap</Title>
      <Text style={styles.gross}>{score.gross == null ? 'No score saved' : `Gross ${score.gross}`}</Text>
      <View style={styles.grid}>
        {holes.map((strokes, index) => (
          <Text key={index} style={styles.hole}>{`${index + 1} ${strokes == null ? '—' : strokes}`}</Text>
        ))}
      </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hole: { minWidth: 64, color: '#0B1F3A', fontSize: 16, fontWeight: '700' },
  done: { minHeight: 48, borderRadius: 14, backgroundColor: '#8AC926', alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#0B1F3A', fontSize: 18, fontWeight: '800' },
});
