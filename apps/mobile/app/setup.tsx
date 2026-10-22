import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { colors } from '@coopr/tokens';
import { useLocalStore } from '../src/local-store';
import { Button, Card, Muted, Screen, Title } from '../src/ui';

export default function SetupScreen() {
  const { clubs, bagNote, bagStatus, bagMessage, moveClub, founderTools, addClub, importCsv } = useLocalStore();
  const [csv, setCsv] = useState('Club,Carry,Total\n');
  const [importNote, setImportNote] = useState('Paste a TrackMan TPS CSV, or Club, Carry, Total. Blank cells stay unknown.');
  const [clubName, setClubName] = useState('');
  const inPlay = clubs.filter((club) => club.slot === 'in_play');
  const testing = clubs.filter((club) => club.slot === 'testing');

  return (
    <Screen>
      <Title>Setup</Title>
      <Muted>Imports and the provisional bag stay here. The bag screen is the fourteen clubs.</Muted>
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
          onPress={() => setImportNote(importCsv(csv))}
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
          <Text style={styles.move} onPress={() => moveClub(club.id, 'testing')}>
            Move to testing
          </Text>
        </Card>
      ))}
      {testing.map((club) => (
        <Card key={club.id}>
          <Text style={styles.label}>{club.label}</Text>
          <Text style={styles.move} onPress={() => moveClub(club.id, 'in_play')}>
            Move into the 14
          </Text>
        </Card>
      ))}
      {bagMessage ? <Muted>{bagMessage}</Muted> : null}
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
  },
});
