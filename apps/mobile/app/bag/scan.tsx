import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ON_PHONE } from '../../src/bag-scan/copy';
import { Body, Panel, ScanButton, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { useBagScan } from '../../src/bag-scan/session';

export default function ScanStepScreen() {
  const { draft, read, clearPhoto } = useBagScan();
  const photo = draft.captureUri;
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
          {draft.step === 'face' ? <View pointerEvents="none" style={styles.crop} /> : null}
        </View>
        {draft.step === 'face' ? <Text style={styles.cropLine}>Cropping to the clubhead</Text> : <Body>Nothing was read from this photo.</Body>}
        <Body>{ON_PHONE}</Body>
        {read.lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </Panel>
      <ScanButton label="CONTINUE" onPress={() => router.push('/bag/confirm')} />
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
  crop: { position: 'absolute', width: '72%', height: '70%', borderWidth: 2, borderColor: scan.lime, borderRadius: 12 },
  cropLine: { color: scan.white, fontSize: 22, fontWeight: '800' },
  line: { color: scan.muted, fontSize: 15, lineHeight: 21 },
});
