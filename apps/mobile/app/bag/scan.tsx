import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CROP_BOX } from '../../src/bag-scan/crop';
import { forwardBag } from '../../src/bag-scan/bag-nav';
import { ON_PHONE } from '../../src/bag-scan/copy';
import { Body, Panel, ScanButton, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { useBagScan } from '../../src/bag-scan/session';

export default function ScanStepScreen() {
  const { draft, read, clearPhoto, keepFacePhoto, cameraNote } = useBagScan();
  const photo = draft.captureUri;
  const face = draft.step === 'face';
  return (
    <ScanScreen title="Scanning">
      <Text style={styles.kicker}>SCANNING</Text>
      <Panel>
        <View style={styles.frame}>
          {photo ? (
            <Image accessibilityLabel="Club photo on this phone" source={{ uri: photo }} style={styles.photo} />
          ) : (
            <Body>No photo on this pass.</Body>
          )}
          {face && !draft.faceCropped ? <View pointerEvents="none" style={styles.crop} /> : null}
        </View>
        {face && draft.faceCropped ? <Text style={styles.cropLine}>Cropped to the clubhead.</Text> : null}
        {face && !draft.faceCropped && !cameraNote ? <Text style={styles.cropLine}>Cropping to the clubhead</Text> : null}
        {cameraNote ? <Body>{cameraNote}</Body> : null}
        {face ? null : <Body>Nothing was read from this photo.</Body>}
        <Body>{ON_PHONE}</Body>
        {read.lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </Panel>
      <ScanButton
        label="CONTINUE"
        onPress={() => {
          if (face && photo && !draft.faceCropped) {
            void keepFacePhoto(photo).then(() => forwardBag(router, '/bag/confirm'));
            return;
          }
          forwardBag(router, '/bag/confirm');
        }}
      />
      <ScanButton
        label="CANCEL"
        tone="ghost"
        onPress={() => {
          clearPhoto();
          router.replace('/bag/add');
        }}
      />
    </ScanScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: scan.lime, fontWeight: '800', letterSpacing: 1.2, fontSize: 13 },
  frame: { minHeight: 240, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1F3A' },
  photo: { width: '100%', height: 240 },
  crop: { position: 'absolute', width: `${CROP_BOX.width * 100}%`, height: `${CROP_BOX.height * 100}%`, borderWidth: 2, borderColor: scan.lime, borderRadius: 12 },
  cropLine: { color: scan.white, fontSize: 22, fontWeight: '800' },
  line: { color: scan.muted, fontSize: 15, lineHeight: 21 },
});
