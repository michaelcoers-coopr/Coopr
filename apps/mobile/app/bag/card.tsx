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
      <ScanScreen title="Club card" backTo="/bag">
        <Body>That club is not on this phone.</Body>
        <ScanButton label="BACK TO BAG" tone="ghost" onPress={() => router.replace('/bag')} />
      </ScanScreen>
    );
  }
  const { club, verdict } = shown;
  const label = VERDICT_LABEL[verdict.verdict];
  const verdictColor = verdict.verdict === 'PROBABLY_NOT' ? scan.warn : verdict.verdict === 'CANT_TELL' ? scan.muted : verdict.verdict === 'OKAY' ? scan.white : scan.lime;
  const needs = verdict.needs.filter((need, index) => !verdict.needs.some((other, otherIndex) => otherIndex !== index && other.toLowerCase().includes(need.toLowerCase()) && other.length > need.length));
  const ready = scanState.focus.kind === 'draft' && canConfirmDraft(scanState.draft);
  const name = [club.brand, club.model].filter(Boolean).join(' ');
  return (
    <ScanScreen title="Club card" backTo="/bag">
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
      <View style={styles.pills}>
        {(Object.keys(VERDICT_LABEL) as (keyof typeof VERDICT_LABEL)[]).map((id) => (
          <View key={id} style={[styles.pill, verdict.verdict === id && styles.pillOn]}>
            <Text style={[styles.pillText, verdict.verdict === id && { color: id === 'PROBABLY_NOT' ? scan.warn : scan.white }]}>{VERDICT_LABEL[id]}</Text>
          </View>
        ))}
      </View>
      <View style={styles.tiles}>
        <Tile label="Type" value={club.type} extra={club.type ? 'you picked it' : null} />
        <Tile label="Iron type" value={club.ironBuild} extra={club.ironBuild ? 'you picked it' : null} />
        <Tile label="Loft" value={club.loft == null ? null : `${club.loft}°`} />
        <Tile label="Flex" value={club.flex} />
        <Tile label="Number" value={club.clubNumber} />
      </View>
      <Panel>
        <Text style={[styles.verdict, { color: verdictColor }]}>{label}</Text>
        {verdict.checks.map((check) => (
          <Text key={check.label} style={styles.check}>{`${check.label}: ${check.status}. ${check.why}`}</Text>
        ))}
        {needs.length ? <Body>{`Still need ${needs.join('; ')}.`}</Body> : null}
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
      {verdict.verdict === 'PROBABLY_NOT' && club.fitAck !== 'kept_anyway' ? (
        <ScanButton label="HOLD UP A SEC" tone="ghost" onPress={() => router.push('/bag/hold')} />
      ) : null}
      {!club.sample && scanState.focus.kind === 'saved' ? (
        <ScanButton
          label={club.inPlay ? 'OUT OF PLAY' : 'IN PLAY'}
          tone="ghost"
          onPress={() => scanState.setInPlay(club.id, !club.inPlay)}
        />
      ) : null}
      {!club.sample ? (
        <ScanButton
          label="FIX DETAILS"
          tone="ghost"
          onPress={() => {
            const match = scanState.clubs.find((item) => item.id === club.id);
            if (match) scanState.editClub(match);
            router.push('/bag/details');
          }}
        />
      ) : null}
      {!club.sample && scanState.focus.kind === 'saved' ? (
        <ScanButton
          label="DELETE CLUB"
          tone="ghost"
          onPress={() => {
            scanState.removeClub(club.id);
            router.replace('/bag');
          }}
        />
      ) : null}
    </ScanScreen>
  );
}

function Tile({ label, value, extra }: { label: string; value: string | null; extra?: string | null }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value ?? '—'}</Text>
      {extra ? <Text style={styles.tileExtra}>{extra}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  identity: { flex: 1, gap: 4 },
  name: { color: scan.white, fontSize: 18, fontWeight: '700' },
  verdict: { color: scan.lime, fontSize: 28, fontWeight: '800' },
  check: { color: scan.white, fontSize: 15, lineHeight: 21 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: scan.line, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  pillOn: { borderColor: scan.lime, backgroundColor: '#14301F' },
  pillText: { color: scan.muted, fontSize: 12, fontWeight: '800' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '47%', backgroundColor: scan.card, borderRadius: 16, borderWidth: 1, borderColor: scan.line, padding: 12, gap: 4 },
  tileLabel: { color: scan.muted, fontSize: 12, fontWeight: '700' },
  tileValue: { color: scan.white, fontSize: 18, fontWeight: '800' },
  tileExtra: { color: scan.lime, fontSize: 12, fontWeight: '700' },
});
