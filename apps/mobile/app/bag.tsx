import { Text, StyleSheet } from 'react-native';
import { colors } from '@coopr/tokens';
import { useLocalStore } from '../src/local-store';
import { Card, Muted, Screen, Title } from '../src/ui';

export default function BagScreen() {
  const { profiles, shots } = useLocalStore();
  const clubs = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const list = clubs.get(profile.clubLabel) ?? [];
    list.push(profile);
    clubs.set(profile.clubLabel, list);
  }

  return (
    <Screen>
      <Title>Bag</Title>
      <Muted>Clubs appear after you record a shot. Confidence is a band, not a percentage. Source is this device.</Muted>
      {clubs.size === 0 ? (
        <Card>
          <Muted>No measured clubs yet.</Muted>
        </Card>
      ) : (
        [...clubs.entries()].map(([label, rows]) => (
          <Card key={label}>
            <Text style={styles.label}>{label}</Text>
            {rows.map((row) => (
              <Muted key={`${row.metric}-${row.environment}-${row.swingMode}`}>
                {`${row.metric} median ${row.stockYards.toFixed(1)} yd · ${row.environment} · ${row.swingMode} · n=${row.sampleSize} · ${row.confidence} · source: manual entry on this device`}
              </Muted>
            ))}
          </Card>
        ))
      )}
      <Muted>{shots.length === 0 ? 'Nothing recorded.' : `${shots.length} manual shot${shots.length === 1 ? '' : 's'} on this device.`}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
