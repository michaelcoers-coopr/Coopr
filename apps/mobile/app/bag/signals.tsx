import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { CUSTOM_ONLY, SIGNALS_HELP } from '../../src/bag-scan/copy';
import { shownForFocus } from '../../src/bag-scan/resolve';
import { Body, Panel, ScanButton, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { useBagScan } from '../../src/bag-scan/session';

export default function SignalsScreen() {
  const state = useBagScan();
  const shown = shownForFocus(state);
  const unnamed = !shown?.club.brand && !shown?.club.model;
  return (
    <ScanScreen title="Review signals">
      <Text style={styles.kicker}>REVIEW SIGNALS</Text>
      <Panel>
        <Text style={styles.empty}>NO SIGNALS YET. 0 independent sources for this club. We show nothing before we show a guess.</Text>
        {unnamed ? <Body>{CUSTOM_ONLY}</Body> : null}
        <Body>Official specs are not loaded on this phone. Your type pick and your own numbers are the only facts we keep.</Body>
        <Body>{SIGNALS_HELP}</Body>
      </Panel>
      <ScanButton label="BACK" tone="ghost" onPress={() => router.back()} />
    </ScanScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: scan.lime, fontWeight: '800', letterSpacing: 1.2, fontSize: 13 },
  empty: { color: scan.white, fontSize: 22, fontWeight: '800', lineHeight: 28 },
});
