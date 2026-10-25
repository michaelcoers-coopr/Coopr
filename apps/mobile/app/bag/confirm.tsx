import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ClubFields } from '../../src/bag-scan/fields';
import { canConfirmDraft } from '../../src/bag-scan/logic';
import { ClubPicture } from '../../src/bag-scan/picture';
import { Body, ScanButton, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { useBagScan } from '../../src/bag-scan/session';

export default function ConfirmScreen() {
  const { draft, patch, read, clearPhoto, cameraNote } = useBagScan();
  const ready = canConfirmDraft(draft);
  return (
    <ScanScreen title="Confirm">
      <Text style={styles.kicker}>CONFIRM</Text>
      <ClubPicture photoUri={draft.facePhotoUri} type={draft.type} size={120} />
      <Body>No guess. The photo was not read on this build, so there is no confidence chip.</Body>
      {cameraNote ? <Body>{cameraNote}</Body> : null}
      {draft.faceCropped ? <Body>Cropped to the clubhead.</Body> : null}
      {read.lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
      <ClubFields draft={draft} patch={patch} />
      <Body>{ready ? 'Type and a loft or club number are set. Brand, model, and flex can stay blank.' : 'Pick a type, and a loft or a club number, before this can continue.'}</Body>
      <ScanButton label="YES, ADD IT" disabled={!ready} onPress={() => router.push('/bag/card')} />
      <ScanButton
        label="NOT THIS ONE"
        tone="ghost"
        onPress={() => {
          clearPhoto();
          router.replace('/bag/add');
        }}
      />
      <ScanButton label="FIX DETAILS" tone="ghost" onPress={() => router.push('/bag/details')} />
    </ScanScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: scan.lime, fontWeight: '800', letterSpacing: 1.2, fontSize: 13 },
  line: { color: scan.muted, fontSize: 15, lineHeight: 21 },
});
