import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors } from '@coopr/tokens';
import { readArchive } from '../src/analysis/archive';
import { formatToPar, homeRoundSummary, type HomeRoundRow } from '../src/analysis/home-rounds';
import type { StoredRound } from '../src/analysis/from-round';
import { subscribeDevice } from '../src/device-store';
import { Muted, Screen, Title } from '../src/ui';

function line(row: HomeRoundRow): string {
  const gross = row.gross == null ? 'Gross not finished' : `Gross ${row.gross}`;
  const versus = row.toPar == null ? '' : ` · ${formatToPar(row.toPar)}`;
  return `${row.playedOn} · ${row.courseName} · ${gross}${versus}`;
}

export default function RoundsScreen() {
  const [archive, setArchive] = useState<StoredRound[]>([]);
  useEffect(() => {
    const pull = () => setArchive(readArchive());
    pull();
    return subscribeDevice(pull);
  }, []);
  const summary = homeRoundSummary(archive);
  const rows = [...summary.rows].reverse();
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Rounds', headerShown: false }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Title>Rounds</Title>
      {rows.length === 0 ? <Muted>No rounds yet. Your first one lands here.</Muted> : null}
      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <Text style={styles.line}>{line(row)}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 17 },
  row: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  line: { color: colors.text, fontSize: 16, lineHeight: 22 },
});
