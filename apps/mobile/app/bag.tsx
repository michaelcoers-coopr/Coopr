import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { colors } from '@coopr/tokens';
import { formatDistance } from '@coopr/engine';
import { useLocalStore } from '../src/local-store';
import { Button, Card, Muted, Screen, Title } from '../src/ui';
import type { DistanceProfile } from '@coopr/engine';

function stock(profiles: readonly DistanceProfile[], clubId: string, metric: 'carry' | 'total'): DistanceProfile | null {
  const rows = profiles.filter((profile) => profile.clubId === clubId && profile.metric === metric);
  return rows.find((profile) => profile.blended) ?? rows[0] ?? null;
}

export default function BagScreen() {
  const { profiles, clubs, unit } = useLocalStore();
  const inPlay = clubs.filter((club) => club.slot === 'in_play');

  return (
    <Screen>
      <Title>Bag</Title>
      <Muted>{`${inPlay.length} of 14. Carry and total stay apart.`}</Muted>
      {inPlay.length === 0 ? <Muted>No clubs in the bag yet. Add one in Setup. Nothing was filled in for you.</Muted> : null}
      {inPlay.map((club) => {
        const carry = stock(profiles, club.id, 'carry');
        const total = stock(profiles, club.id, 'total');
        return (
          <Card key={club.id}>
            <Text style={styles.label}>{club.label.split('·')[0]?.trim() || club.label}</Text>
            <Text style={styles.number}>{`Carry ${carry ? formatDistance(carry.stockYards, unit) : '—'}`}</Text>
            <Text style={styles.number}>{`Total ${total ? formatDistance(total.stockYards, unit) : '—'}`}</Text>
          </Card>
        );
      })}
      <Button label="Setup" tone="ghost" onPress={() => router.push('/setup')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.navy, fontSize: 28, fontWeight: '800' },
  number: { color: colors.navy, fontSize: 22, fontWeight: '800' },
});
