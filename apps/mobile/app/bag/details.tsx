import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ClubFields } from '../../src/bag-scan/fields';
import { canConfirmDraft, loftProblem } from '../../src/bag-scan/logic';
import { Body, ScanButton, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { useBagScan } from '../../src/bag-scan/session';

export default function DetailsScreen() {
  const { draft, patch, focus, saveDraft } = useBagScan();
  const [error, setError] = useState<string | null>(null);
  const ready = canConfirmDraft(draft);
  return (
    <ScanScreen title="Add details">
      <Text style={styles.kicker}>ADD DETAILS</Text>
      <Body>Unknown stays blank. Nothing here is filled in for you.</Body>
      {focus.kind === 'sample' ? <Body>This is Sample. Editing it does not copy it into your bag.</Body> : null}
      <ClubFields draft={draft} patch={patch} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScanButton
        label="SAVE · YOU ENTERED THIS"
        disabled={focus.kind === 'sample' || !ready}
        onPress={() => {
          const problem = loftProblem(draft.loftText, draft.type);
          if (problem) {
            setError(problem);
            return;
          }
          const saved = saveDraft(null);
          if (!saved) return;
          setError(null);
          router.replace('/bag/card');
        }}
      />
    </ScanScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: scan.lime, fontWeight: '800', letterSpacing: 1.2, fontSize: 13 },
  error: { color: scan.warn, fontWeight: '700', fontSize: 16 },
});
