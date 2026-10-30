import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors } from '@coopr/tokens';
import { HANDICAP_MAX, HANDICAP_MIN, rangedNumber, SPEED_MAX, SPEED_MIN } from '../src/bag-scan/logic';
import { useBagScan } from '../src/bag-scan/session';
import { useLocalStore } from '../src/local-store';
import { Button, Card, Muted, Screen, Title } from '../src/ui';

const FLEXES = [
  { label: 'Ladies', mph: '70' },
  { label: 'Senior', mph: '80' },
  { label: 'Regular', mph: '90' },
  { label: 'Stiff', mph: '100' },
  { label: 'Extra stiff', mph: '110' },
] as const;

const QUICK_CLUBS = ['Driver', '7 iron', 'Pitching wedge', 'Putter'] as const;

/** Profile, flex, and the bag. Name was asked once, on the first launch. */
export default function SetupScreen() {
  const { clubs, bagNote, bagStatus, bagMessage, moveClub, founderTools, addClub, importCsv, displayName, finishOnboarding } = useLocalStore();
  const bag = useBagScan();
  const [name, setName] = useState(displayName);
  const [handicap, setHandicap] = useState(bag.fit.handicapIndex == null ? '' : String(bag.fit.handicapIndex));
  const [speed, setSpeed] = useState(bag.fit.driverSpeedMph == null ? '' : String(bag.fit.driverSpeedMph));
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState('Club,Carry,Total\n');
  const [importNote, setImportNote] = useState('Paste a TrackMan TPS CSV, or Club, Carry, Total. Blank cells stay unknown.');
  const [clubName, setClubName] = useState('');
  const inPlay = clubs.filter((club) => club.slot === 'in_play');
  const testing = clubs.filter((club) => club.slot === 'testing');
  const starter = bag.clubs.some((club) => club.source === 'starter');

  const save = () => {
    const handicapValue = rangedNumber(handicap, HANDICAP_MIN, HANDICAP_MAX);
    const speedValue = rangedNumber(speed, SPEED_MIN, SPEED_MAX);
    if (handicapValue.problem || speedValue.problem) {
      setError(handicapValue.problem ? `Handicap has to be from ${HANDICAP_MIN} to ${HANDICAP_MAX}.` : `Driver speed has to be from ${SPEED_MIN} to ${SPEED_MAX} mph.`);
      return;
    }
    setError(null);
    finishOnboarding({ name, handicap: handicapValue.value, driverSpeed: speedValue.value });
    if (starter) bag.useStarterBag({ handicap: handicapValue.value, driverSpeed: speedValue.value });
  };

  return (
    <Screen
      footer={<Button label="Save setup" onPress={save} />}
    >
      <Stack.Screen options={{ headerShown: false, title: 'Setup' }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Title>Setup</Title>
      <Muted>Your name is already saved. Handicap, driver speed, and flex live here, once.</Muted>
      {starter ? <Muted>Starter bag is on. Those carries are estimated.</Muted> : null}
      {inPlay.length === 0 ? <Muted>No clubs yet. Add a name below, or import a CSV. This build does not include a sample bag.</Muted> : null}
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput value={name} onChangeText={setName} accessibilityLabel="Name, your entry" style={styles.input} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Handicap</Text>
        <Muted>Your entry. COOPR does not compute a handicap index.</Muted>
        <TextInput
          value={handicap}
          onChangeText={setHandicap}
          accessibilityLabel="Handicap, your entry"
          keyboardType="decimal-pad"
          placeholder="Optional"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Driver speed</Text>
        <Muted>Your entry. Not a measured swing speed.</Muted>
        <TextInput
          value={speed}
          onChangeText={setSpeed}
          accessibilityLabel="Driver speed, your entry"
          keyboardType="decimal-pad"
          placeholder="Miles per hour, optional"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      <Text style={styles.label}>Flex</Text>
      <Muted>Picking a flex fills driver speed when you have not typed one. The carries stay estimated.</Muted>
      <View style={styles.flexRow}>
        {FLEXES.map((flex) => (
          <Pressable
            key={flex.label}
            accessibilityRole="button"
            accessibilityLabel={`${flex.label} flex`}
            onPress={() => setSpeed(flex.mph)}
            style={[styles.flexChip, speed === flex.mph && styles.flexOn]}
          >
            <Text style={styles.flexText}>{flex.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>Add a club</Text>
      <View style={styles.flexRow}>
        {QUICK_CLUBS.map((club) => (
          <Pressable key={club} accessibilityRole="button" accessibilityLabel={`Add ${club}`} onPress={() => addClub(club)} style={styles.flexChip}>
            <Text style={styles.flexText}>{club}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={clubName} onChangeText={setClubName} placeholder="Club name" placeholderTextColor={colors.muted} accessibilityLabel="Club name" style={styles.input} />
      <Button
        label="Add to the bag"
        tone="ghost"
        onPress={() => {
          addClub(clubName);
          setClubName('');
        }}
      />
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
        <Button label="Import CSV" tone="ghost" onPress={() => setImportNote(importCsv(csv))} />
        <Muted>{importNote}</Muted>
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
  back: { alignSelf: 'flex-start', minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  field: { gap: 6 },
  label: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  move: { color: colors.navy, fontSize: 18, fontWeight: '800', paddingVertical: 8 },
  error: { color: colors.red, fontWeight: '700' },
  flexRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flexChip: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  flexOn: { backgroundColor: '#8AC926' },
  flexText: { color: colors.navy, fontSize: 15, fontWeight: '800' },
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
