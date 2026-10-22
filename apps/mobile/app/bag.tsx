import { Text, StyleSheet } from 'react-native';
import { colors } from '@coopr/tokens';
import { FOUNDER_DISTANCE_SOURCE } from '@coopr/seed';
import { useLocalStore } from '../src/local-store';
import { Card, Muted, Screen, Title } from '../src/ui';

export default function BagScreen() {
  const { profiles, shots, clubs, bagNote, bagStatus, bagMessage, moveClub, founderTools } = useLocalStore();
  const inPlay = clubs.filter((club) => club.slot === 'in_play');
  const testing = clubs.filter((club) => club.slot === 'testing');
  const playingIds = new Set(clubs.map((club) => club.id));
  const localProfiles = profiles.filter((profile) => !playingIds.has(profile.clubId));

  const linesFor = (clubId: string) =>
    profiles.filter((profile) => profile.clubId === clubId);

  return (
    <Screen>
      <Title>Bag</Title>
      {founderTools && bagNote ? (
        <Card>
          <Muted>{`In play is ${bagStatus ?? 'unspecified'}. ${bagNote}`}</Muted>
        </Card>
      ) : (
        <Muted>Clubs appear after you record a shot. Confidence is a band, not a percentage. Source is this device.</Muted>
      )}
      {inPlay.length > 0 ? <Muted>{`In play ${inPlay.length} of 14`}</Muted> : null}
      {inPlay.map((club) => (
        <Card key={club.id}>
          <Text style={styles.label}>{club.label}</Text>
          {linesFor(club.id).map((row) => (
            <Muted key={`${row.metric}-${row.environment}-${row.swingMode}`}>
              {`${row.metric} median ${row.stockYards.toFixed(1)} yd · ${row.environment} · ${row.swingMode} · n=${row.sampleSize} · ${row.confidence} · source: ${FOUNDER_DISTANCE_SOURCE}`}
            </Muted>
          ))}
          {linesFor(club.id).length === 0 ? <Muted>No shot sample.</Muted> : null}
          <Text style={styles.move} onPress={() => moveClub(club.id, 'testing')}>
            Move to testing
          </Text>
        </Card>
      ))}
      {testing.length > 0 ? <Muted>Out of play, owned and testing</Muted> : null}
      {testing.map((club) => (
        <Card key={club.id}>
          <Text style={styles.label}>{club.label}</Text>
          {club.note ? <Muted>{club.note}</Muted> : null}
          <Text style={styles.move} onPress={() => moveClub(club.id, 'in_play')}>
            Move into the 14
          </Text>
        </Card>
      ))}
      {bagMessage ? <Muted>{bagMessage}</Muted> : null}
      {localProfiles.length > 0 ? <Muted>Recorded on this device</Muted> : null}
      {localProfiles.map((row) => (
        <Card key={`${row.clubId}-${row.metric}-${row.environment}-${row.swingMode}`}>
          <Text style={styles.label}>{row.clubLabel}</Text>
          <Muted>
            {`${row.metric} median ${row.stockYards.toFixed(1)} yd · ${row.environment} · ${row.swingMode} · n=${row.sampleSize} · ${row.confidence} · source: manual entry on this device`}
          </Muted>
        </Card>
      ))}
      {!founderTools && clubs.length === 0 && localProfiles.length === 0 ? (
        <Card>
          <Muted>No measured clubs yet.</Muted>
        </Card>
      ) : null}
      <Muted>{shots.length === 0 ? 'Nothing recorded on this device.' : `${shots.length} manual shot${shots.length === 1 ? '' : 's'} on this device.`}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 18, fontWeight: '700' },
  move: { color: colors.accent, fontSize: 15, fontWeight: '700', paddingVertical: 4 },
});
