import { Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { forwardBag } from '../../src/bag-scan/bag-nav';
import { CAMERA_WEB, ON_PHONE, PHOTOS_STAY } from '../../src/bag-scan/copy';
import { Body, Panel, ScanButton, ScanChoice, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { useBagScan } from '../../src/bag-scan/session';
import type { CaptureStep } from '../../src/bag-scan/types';

const STEPS: { id: CaptureStep; label: string; hint: string }[] = [
  { id: 'face', label: 'FACE', hint: 'Square to the clubface. Toe to the left. This becomes the club picture.' },
  { id: 'sole', label: 'SOLE', hint: 'The number stamp goes here, if the club has one.' },
  { id: 'shaft', label: 'SHAFT', hint: 'The label band near the grip. Flex is typed if it is not clear.' },
  { id: 'bag', label: 'WHOLE BAG', hint: 'Whole bag is later. Photograph one clubface, or type it.' },
];

export default function AddClubScreen() {
  const bag = useBagScan();
  const { draft, setStep, attachPhoto, cameraNote, setCameraNote } = bag;
  const step = STEPS.find((item) => item.id === draft.step) ?? STEPS[0]!;

  const pick = async (kind: 'camera' | 'library') => {
    setCameraNote(null);
    if (kind === 'camera' && Platform.OS === 'web') {
      setCameraNote(CAMERA_WEB);
      return;
    }
    try {
      const permission =
        kind === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setCameraNote('Photo access was declined. Nothing was uploaded.');
        return;
      }
      const result =
        kind === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled || !result.assets[0]?.uri) return;
      attachPhoto(result.assets[0].uri, draft.step);
      forwardBag(router, '/bag/scan');
    } catch {
      setCameraNote(kind === 'camera' ? CAMERA_WEB : 'The photo could not be opened. Type the club instead.');
    }
  };

  return (
    <ScanScreen title="Add to bag">
      <Text style={styles.kicker}>ADD TO BAG</Text>
      <Body>Face shot first. Nothing is saved until you add the club.</Body>
      <View style={styles.row}>
        {STEPS.map((item) => (
          <ScanChoice key={item.id} label={item.label} selected={draft.step === item.id} onPress={() => setStep(item.id)} />
        ))}
      </View>
      <Panel>
        <View style={styles.finder}>
          <Text style={styles.finderText}>{step.hint}</Text>
        </View>
        <Body>{PHOTOS_STAY}</Body>
        <Body>{ON_PHONE}</Body>
      </Panel>
      {cameraNote ? <Body>{cameraNote}</Body> : null}
      <ScanButton label="TAKE PHOTO" onPress={() => void pick('camera')} />
      <ScanButton label="LIBRARY" tone="ghost" onPress={() => void pick('library')} />
      <ScanButton
        label="TYPE IT"
        tone="ghost"
        onPress={() => forwardBag(router, '/bag/details')}
      />
      <ScanButton label="DISCARD" tone="ghost" onPress={() => bag.discardDraft()} />
    </ScanScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: scan.lime, fontWeight: '800', letterSpacing: 1.2, fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  finder: {
    minHeight: 220,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: scan.lime,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  finderText: { color: scan.white, fontSize: 18, fontWeight: '700', textAlign: 'center', lineHeight: 26 },
});
