import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@coopr/tokens';
import { wedgeCarry, WEDGE_LENGTHS, type WedgeLength } from '@coopr/engine';
import { useLocalStore } from '../src/local-store';
import { Card, Muted, Screen, Title } from '../src/ui';

const LABELS: Record<WedgeLength, string> = {
  full: 'Full',
  three_quarter: 'Three-quarter',
  half: 'Half',
};

function looksLikeWedge(label: string): boolean {
  return /\b(pw|aw|sw|lw|wedge|gap)\b|\b(4[6-9]|5\d|60)\b/i.test(label);
}

export default function WedgeScreen() {
  const { clubs, wedges, setWedgeCarry, profiles } = useLocalStore();
  const [cellNote, setCellNote] = useState<Record<string, string>>({});
  const wedgeClubs = clubs.filter((club) => looksLikeWedge(club.label));

  const commit = (clubId: string, length: WedgeLength, text: string) => {
    const key = `${clubId}:${length}`;
    if (text.trim() === '') {
      setWedgeCarry(clubId, length, null);
      setCellNote((current) => ({ ...current, [key]: '' }));
      return;
    }
    const parsed = wedgeCarry(Number(text));
    if (typeof parsed === 'number') {
      setWedgeCarry(clubId, length, parsed);
      setCellNote((current) => ({ ...current, [key]: '' }));
      return;
    }
    if (parsed == null) return;
    setCellNote((current) => ({ ...current, [key]: parsed.error }));
  };

  return (
    <Screen>
      <Title>Wedge matrix</Title>
      <Muted>Enter carries before the round. Inside 40 yards, a pitch uses these and nothing else. A blank stays blank. A total is not copied in as a carry.</Muted>
      {wedgeClubs.length === 0 ? <Muted>No wedge is in the bag yet.</Muted> : null}
      {wedgeClubs.map((club) => (
        <Card key={club.id}>
          <Text style={styles.label}>{club.label}</Text>
          {WEDGE_LENGTHS.map((length) => {
            const sample = profiles.find(
              (profile) => profile.clubId === club.id && profile.metric === 'carry' && profile.swingMode === length && profile.dispersionKnown,
            );
            const note = cellNote[`${club.id}:${length}`];
            return (
              <View key={length} style={styles.cell}>
                <View style={styles.row}>
                  <Text style={styles.length}>{LABELS[length]}</Text>
                  <TextInput
                    defaultValue={wedges[club.id]?.[length] == null ? '' : String(wedges[club.id]?.[length])}
                    onChangeText={(text) => commit(club.id, length, text)}
                    onEndEditing={(event) => commit(club.id, length, event.nativeEvent.text)}
                    placeholder={sample ? `Sample carry ${Math.round(sample.stockYards)}` : 'Carry yards'}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    accessibilityLabel={`${club.label} ${LABELS[length]} carry`}
                  />
                </View>
                {note ? <Text style={styles.error}>{note}</Text> : null}
              </View>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  cell: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: { color: colors.red, fontSize: 16, fontWeight: '800' },
  length: { color: colors.navy, fontSize: 16, fontWeight: '800', width: 120 },
  input: {
    flex: 1,
    color: colors.navy,
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 2,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 12,
    fontSize: 18,
  },
});
