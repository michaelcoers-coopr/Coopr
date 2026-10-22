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
  const wedgeClubs = clubs.filter((club) => looksLikeWedge(club.label));

  const commit = (clubId: string, length: WedgeLength, text: string) => {
    if (text.trim() === '') {
      setWedgeCarry(clubId, length, null);
      return;
    }
    const parsed = wedgeCarry(Number(text));
    if (parsed == null || typeof parsed === 'number') setWedgeCarry(clubId, length, parsed);
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
            return (
              <View key={length} style={styles.row}>
                <Text style={styles.length}>{LABELS[length]}</Text>
                <TextInput
                  defaultValue={wedges[club.id]?.[length] == null ? '' : String(wedges[club.id]?.[length])}
                  onEndEditing={(event) => commit(club.id, length, event.nativeEvent.text)}
                  placeholder={sample ? `Sample carry ${Math.round(sample.stockYards)}` : 'Carry yards'}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  accessibilityLabel={`${club.label} ${LABELS[length]} carry`}
                />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
