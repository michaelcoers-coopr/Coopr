import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { VERDICT_LABEL } from '../../src/bag-scan/copy';
import { canConfirmDraft } from '../../src/bag-scan/logic';
import { ClubPicture } from '../../src/bag-scan/picture';
import { shownForFocus } from '../../src/bag-scan/resolve';
import { Body, Numeral, Panel, SampleChip, ScanButton, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { useBagScan } from '../../src/bag-scan/session';

export default function ClubCardScreen() {
  const scanState = useBagScan();
  const shown = shownForFocus(scanState);
  if (!shown) {
    return (
      <ScanScreen title="Club card">
        <Body>That club is not on this phone.</Body>
        <ScanButton label="BACK TO BAG" tone="ghost" onPress={() => router.replace('/bag')} />
      </ScanScreen>
    );
  }
  const { club, verdict } = shown;
  const label = VERDICT_LABEL[verdict.verdict];
  const verdictColor = verdict.verdict === 'PROBABLY_NOT' ? scan.red : verdict.verdict === 'CANT_TELL' ? scan.muted : verdict.verdict === 'OKAY' ? scan.white : scan.lime;
  const ready = scanState.focus.kind === 'draft' && canConfirmDraft(scanState.draft);
  const name = [club.brand, club.model].filter(Boolean).join(' ');
  return (
    <ScanScreen title="Club card">
      <View style={styles.top}>
        <ClubPicture
          photoUri={club.photoUri}
          type={club.type}
          size={112}
          onPhoto={
            club.sample
              ? undefined
              : () => {
                  if (scanState.focus.kind === 'saved') {
                    const saved = scanState.clubs.find((item) => item.id === club.id);
                    if (saved) scanState.editClub(saved);
                  }
                  scanState.setStep('face');
                  router.push('/bag/add');
                }
          }
        />
        <View style={styles.identity}>
          {club.sample ? <SampleChip /> : null}
          <Numeral size={48}>{club.slot}</Numeral>
          <Text style={styles.name}>{name || 'Name not set'}</Text>
        </View>
      </View>
      <Panel>
        <Fact label="Type" value={club.type} extra={club.type ? 'you picked it' : null} />
        <Fact label="Iron type" value={club.ironBuild} extra={club.ironBuild ? 'you picked it' : null} />
        <Fact label="Loft" value={club.loft == null ? null : `${club.loft}°`} />
        <Fact label="Flex" value={club.flex} />
        <Fact label="Number" value={club.clubNumber} />
      </Panel>
      <Panel>
        <Text style={[styles.verdict, { color: verdictColor }]}>{label}</Text>
        {verdict.checks.map((check) => (
          <Text key={check.label} style={styles.check}>{`${check.label}: ${check.status}. ${check.why}`}</Text>
        ))}
        {verdict.needs.length ? <Body>{`Still need ${verdict.needs.join('; ')}.`}</Body> : null}
        <Body>A starting point, not a fitting. Handicap is never the whole story.</Body>
        {club.fitAck === 'kept_anyway' ? <Body>You kept this club. The verdict stays on the card.</Body> : null}
      </Panel>
      <ScanButton label="REVIEW SIGNALS" tone="ghost" onPress={() => router.push('/bag/signals')} />
      {club.sample ? <Body>Sample. This club is not saved on your phone.</Body> : null}
      {ready ? (
        <ScanButton
          label={scanState.draft.existingId ? 'SAVE CLUB' : 'ADD TO MY BAG'}
          onPress={() => {
            if (verdict.verdict === 'PROBABLY_NOT' && club.fitAck !== 'kept_anyway') {
              router.push('/bag/hold');
              return;
            }
            scanState.saveDraft(club.fitAck);
            scanState.setNotice(null);
            router.replace('/bag');
          }}
        />
      ) : null}
      {!club.sample && scanState.focus.kind === 'saved' && verdict.verdict === 'PROBABLY_NOT' && club.fitAck !== 'kept_anyway' ? (
        <ScanButton label="HOLD UP A SEC" tone="ghost" onPress={() => router.push('/bag/hold')} />
      ) : null}
      {!club.sample ? <ScanButton label="FIX DETAILS" tone="ghost" onPress={() => router.push('/bag/details')} /> : null}
    </ScanScreen>
  );
}

function Fact({ label, value, extra }: { label: string; value: string | null; extra?: string | null }) {
  if (!value) return null;
  return (
    <Text style={styles.fact}>
      {`${label}: ${value}`}
      {extra ? ` · ${extra}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  identity: { flex: 1, gap: 4 },
  name: { color: scan.white, fontSize: 18, fontWeight: '700' },
  verdict: { color: scan.lime, fontSize: 28, fontWeight: '800' },
  check: { color: scan.white, fontSize: 15, lineHeight: 21 },
  fact: { color: scan.white, fontSize: 16 },
});
