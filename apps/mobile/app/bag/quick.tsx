import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CATALOG_NOTE, GOLF_BRANDS, modelsFor, optionalModelHints } from '../../src/clubs/catalog';
import { ironSet, lastIdentity, quickClub, QUICK_TYPES, TYPICAL_NOTE } from '../../src/clubs/quick';
import { returnToBag } from '../../src/bag-scan/bag-nav';
import { Body, ScanButton, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { useBagScan } from '../../src/bag-scan/session';

export default function QuickAddScreen() {
  const bag = useBagScan();
  const remembered = lastIdentity(bag.clubs);
  const [brand, setBrand] = useState(remembered?.brand ?? '');
  const [model, setModel] = useState('');
  const [query, setQuery] = useState('');
  const [typeId, setTypeId] = useState('7 iron');
  const [typical, setTypical] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const [hintNote, setHintNote] = useState<string | null>(null);
  const models = [...new Set([...modelsFor(brand, query), ...hints])];

  const addOne = () => {
    const club = quickClub({ brand, model, typeId, useTypical: typical, driverSpeed: bag.fit.driverSpeedMph, now: `${Date.now()}` });
    if (!club) return;
    bag.addClubs([club]);
    returnToBag(router);
  };

  const addSet = () => {
    const clubs = ironSet({ brand, model, useTypical: typical, driverSpeed: bag.fit.driverSpeedMph, now: `${Date.now()}` });
    if (clubs.length === 0) return;
    bag.addClubs(clubs);
    returnToBag(router);
  };

  return (
    <ScanScreen title="Add a club">
      <Text style={styles.kicker}>ADD A CLUB</Text>
      <Body>Pick a brand, a model, and a club. Unknown loft and flex stay blank.</Body>
      <Body>{CATALOG_NOTE}</Body>
      <View style={styles.row}>
        {GOLF_BRANDS.map((name) => (
          <Pressable key={name} accessibilityRole="button" accessibilityLabel={name} onPress={() => { setBrand(name); setHints([]); }} style={[styles.chip, brand === name && styles.chipOn]}>
            <Text style={[styles.chipText, brand === name && styles.chipTextOn]}>{name}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Model"
        placeholderTextColor="rgba(255,255,255,0.45)"
        accessibilityLabel="Model"
        style={styles.input}
      />
      <View style={styles.row}>
        {models.slice(0, 8).map((name) => (
          <Pressable key={name} accessibilityRole="button" accessibilityLabel={`Model ${name}`} onPress={() => setModel(name)} style={[styles.chip, model === name && styles.chipOn]}>
            <Text style={[styles.chipText, model === name && styles.chipTextOn]}>{name}</Text>
          </Pressable>
        ))}
      </View>
      {model ? <Body>{`Model ${model}`}</Body> : null}
      <ScanButton
        label="Suggest models"
        tone="ghost"
        onPress={() => {
          void optionalModelHints(brand).then((next) => {
            setHints(next);
            setHintNote(next.length ? 'Suggestions added. The offline list is still here.' : 'No extra suggestions. The offline list stands.');
          });
        }}
      />
      {hintNote ? <Body>{hintNote}</Body> : null}
      <ScanButton label="Add club" onPress={addOne} />
      <ScanButton label="Add 4 through PW" tone="ghost" onPress={addSet} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy last brand and model"
        disabled={!remembered}
        onPress={() => {
          if (!remembered) return;
          setBrand(remembered.brand);
          setModel(remembered.model);
        }}
        style={[styles.chip, styles.copy]}
      >
        <Text style={styles.chipText}>{remembered ? `Copy last brand and model · ${remembered.brand} ${remembered.model}` : 'Copy last brand and model'}</Text>
      </Pressable>
      <View style={styles.row}>
        {QUICK_TYPES.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.id} onPress={() => setTypeId(item.id)} style={[styles.chip, typeId === item.id && styles.chipOn]}>
            <Text style={[styles.chipText, typeId === item.id && styles.chipTextOn]}>{item.id}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Use typical loft and flex" onPress={() => setTypical((value) => !value)} style={[styles.chip, typical && styles.chipOn]}>
        <Text style={[styles.chipText, typical && styles.chipTextOn]}>{typical ? 'Typical loft and flex on' : 'Use typical loft and flex'}</Text>
      </Pressable>
      <Body>{TYPICAL_NOTE}</Body>
      <ScanButton label="Use a starter bag" tone="ghost" onPress={() => { bag.useStarterBag(); returnToBag(router); }} />
    </ScanScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: scan.lime, fontWeight: '800', letterSpacing: 1.2, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  chipOn: { backgroundColor: scan.lime },
  chipText: { color: scan.white, fontWeight: '700', fontSize: 14 },
  chipTextOn: { color: scan.navy },
  input: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, color: scan.white, backgroundColor: 'rgba(255,255,255,0.08)', fontSize: 16 },
  copy: { minHeight: 44, justifyContent: 'center' },
});
