import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { colors } from '@coopr/tokens';
import { formatDistance } from '@coopr/engine';
import { FOUNDER_DISTANCE_SOURCE } from '@coopr/seed';
import { useLocalStore } from '../src/local-store';
import { Button, Card, Muted, Screen, Title } from '../src/ui';

export default function BagScreen() {
  const { profiles, shots, clubs, bagNote, bagStatus, bagMessage, moveClub, founderTools, addClub, importCsv, unit, reportedAverages } = useLocalStore();
  const [csv, setCsv] = useState('Club,Carry,Total\n');
  const [importNote, setImportNote] = useState('Paste a TrackMan TPS CSV, or Club, Carry, Total. Blank cells stay unknown.');
  const [clubName, setClubName] = useState('');
  const inPlay = clubs.filter((club) => club.slot === 'in_play');
  const testing = clubs.filter((club) => club.slot === 'testing');

  const linesFor = (clubId: string) => profiles.filter((profile) => profile.clubId === clubId);

  return (
    <Screen>
      <Title>Bag</Title>
      <Muted>{`In play ${inPlay.length} of 14. Carry and total stay on their own lines.`}</Muted>
      {founderTools && bagNote ? (
        <Card>
          <Muted>{`In play is ${bagStatus ?? 'unspecified'}. ${bagNote}`}</Muted>
        </Card>
      ) : null}
      <Card>
        <Text style={styles.label}>Import a sim session</Text>
        <TextInput
          value={csv}
          onChangeText={setCsv}
          multiline
          placeholder="Club,Carry,Total"
          placeholderTextColor={colors.muted}
          style={styles.csv}
          accessibilityLabel="Simulator CSV"
        />
        <Button
          label="Import CSV"
          onPress={() => {
            const message = importCsv(csv);
            setImportNote(message);
          }}
        />
        <Muted>{importNote}</Muted>
      </Card>
      <Card>
        <Text style={styles.label}>Add a club</Text>
        <TextInput value={clubName} onChangeText={setClubName} placeholder="Club name" placeholderTextColor={colors.muted} style={styles.input} />
        <Button
          label="Add to the bag"
          tone="ghost"
          onPress={() => {
            addClub(clubName);
            setClubName('');
          }}
        />
      </Card>
      {inPlay.map((club) => (
        <Card key={club.id}>
          <Text style={styles.label}>{club.label}</Text>
          {linesFor(club.id).map((row) => (
            <Muted key={`${row.metric}-${row.environment}-${row.swingMode}-${row.blended}-${row.reported}`}>
              {row.reported
                ? `${row.metric} their reported number ${formatDistance(row.stockYards, unit)} ${unit} · ${row.environment} · n=${row.sampleSize}. ${row.sampleWarning ?? ''}`
                : row.blended
                  ? `${row.metric} blended ${formatDistance(row.stockYards, unit)} ${unit} · n=${row.sampleSize} · ${row.confidence}. ${row.sampleWarning ?? ''}`
                  : `${row.metric} ${formatDistance(row.stockYards, unit)} ${unit} · ${row.environment} · ${row.swingMode} · n=${row.sampleSize} · ${row.confidence} · ${founderTools && row.environment === 'simulator' && row.clubId !== club.label ? FOUNDER_DISTANCE_SOURCE : 'this device'}`}
            </Muted>
          ))}
          {linesFor(club.id).length === 0 ? <Muted>No measured sample. A club without shots gets no stock distance.</Muted> : null}
          <Text style={styles.move} onPress={() => moveClub(club.id, 'testing')}>
            Move to testing
          </Text>
        </Card>
      ))}
      {testing.length > 0 ? <Muted>Out of the 14</Muted> : null}
      {testing.map((club) => (
        <Card key={club.id}>
          <Text style={styles.label}>{club.label}</Text>
          {club.note ? <Muted>{club.note}</Muted> : null}
          {linesFor(club.id).map((row) => (
            <Muted key={`${row.metric}-${row.environment}-${row.swingMode}-${row.blended}-${row.reported}`}>
              {row.reported
                ? `${row.metric} their reported number ${formatDistance(row.stockYards, unit)} ${unit} · ${row.environment} · n=${row.sampleSize}. ${row.sampleWarning ?? ''}`
                : `${row.metric} ${formatDistance(row.stockYards, unit)} ${unit} · ${row.environment} · n=${row.sampleSize}`}
            </Muted>
          ))}
          <Text style={styles.move} onPress={() => moveClub(club.id, 'in_play')}>
            Move into the 14
          </Text>
        </Card>
      ))}
      {reportedAverages
        .filter((row) => row.sampleSize == null || row.environment == null)
        .map((row) => (
          <Card key={row.id}>
            <Text style={styles.label}>{`${row.clubLabel}, their reported number`}</Text>
            <Muted>{`${row.metric} ${formatDistance(row.yards, unit)} ${unit}. ${row.sourceApp ?? 'Source app unknown'}. Held out of the blend until a sample size and an environment are both set.`}</Muted>
          </Card>
        ))}
      {bagMessage ? <Muted>{bagMessage}</Muted> : null}
      <Muted>{shots.length === 0 ? 'No shots imported or saved on this device yet.' : `${shots.length} shot${shots.length === 1 ? '' : 's'} saved on this device.`}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  move: { color: colors.navy, fontSize: 18, fontWeight: '800', paddingVertical: 8 },
  input: {
    color: colors.navy,
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 2,
    borderRadius: 14,
    minHeight: 56,
    paddingHorizontal: 14,
    fontSize: 18,
  },
  csv: {
    color: colors.navy,
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 2,
    borderRadius: 14,
    minHeight: 140,
    padding: 14,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
