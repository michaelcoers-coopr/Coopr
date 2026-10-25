import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  COMMISSION_BLIND,
  FITS_EMPTY,
  HOLD_HEADLINE,
  NOT_A_FITTING,
  SPONSORED_EMPTY,
  STARTING_POINT,
  VERDICT_LABEL,
} from '../../src/bag-scan/copy';
import { holdBody, sameFlexIrons, shaftNudge } from '../../src/bag-scan/logic';
import { ClubPicture } from '../../src/bag-scan/picture';
import { shownForFocus } from '../../src/bag-scan/resolve';
import { Body, Panel, ScanButton, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { useBagScan } from '../../src/bag-scan/session';

export default function HoldScreen() {
  const state = useBagScan();
  const shown = shownForFocus(state);
  if (!shown || shown.verdict.verdict !== 'PROBABLY_NOT') {
    return (
      <ScanScreen title="Hold up">
        <Body>This note is for a club that is probably not yours yet.</Body>
        <ScanButton label="BACK" tone="ghost" onPress={() => router.back()} />
      </ScanScreen>
    );
  }
  const mates = shown.club.sample
    ? shown.bag.filter((club) => club.in_play && club.type === 'iron' && club.flex === shown.club.flex).length
    : sameFlexIrons(state.clubs, shown.club.flex as 'L' | 'A' | 'R' | 'S' | 'X' | null);
  const speed = shown.profile.driver_speed_mph;
  const body = holdBody({
    type: shown.club.type,
    flex: shown.club.flex,
    verdict: shown.verdict,
    speed,
    speedQuality: shown.profile.speed_quality,
    ironMates: mates,
  });
  const shaft = shaftNudge(shown.club.flex, speed);
  const sample = shown.club.sample;
  return (
    <ScanScreen title="Hold up">
      <ClubPicture photoUri={shown.club.photoUri} type={shown.club.type} size={96} />
      <Text style={styles.headline}>{HOLD_HEADLINE}</Text>
      {state.notice ? <Body>{state.notice}</Body> : null}
      <Body>{body}</Body>
      <Body>{`Verdict stays ${VERDICT_LABEL.PROBABLY_NOT}.`}</Body>
      <Panel>
        <Text style={styles.tier}>GOOD</Text>
        <Body>{FITS_EMPTY}</Body>
        <Text style={styles.tier}>GREAT</Text>
        <Body>{FITS_EMPTY}</Body>
        <Text style={styles.tier}>BEST</Text>
        <Body>{FITS_EMPTY}</Body>
      </Panel>
      <View style={styles.sponsored}>
        <Text style={styles.sponsoredLabel}>SPONSORED</Text>
        <Body>{SPONSORED_EMPTY}</Body>
      </View>
      <Body>{COMMISSION_BLIND}</Body>
      {shaft ? <Body>{shaft}</Body> : null}
      <Body>{STARTING_POINT}</Body>
      <Body>{NOT_A_FITTING}</Body>
      <ScanButton
        label="SHOW ME WHAT FITS BETTER"
        tone="ghost"
        onPress={() => state.setNotice(FITS_EMPTY)}
      />
      <ScanButton
        label="LOG SHOTS FIRST"
        onPress={() => {
          if (sample) {
            state.setNotice('Sample stays off your bag. Log shots on a club you add yourself.');
            return;
          }
          state.saveDraft(null);
          state.setNotice('This club is in the bag. Measured shots are not on this screen yet, so the verdict stays.');
          router.replace('/bag');
        }}
      />
      <ScanButton
        label="KEEP IT ANYWAY"
        tone="ghost"
        onPress={() => {
          if (sample) {
            state.setNotice('Sample stays off your bag.');
            return;
          }
          state.saveDraft('kept_anyway');
          state.setNotice('Kept anyway. The verdict stays on the card.');
          router.replace('/bag');
        }}
      />
    </ScanScreen>
  );
}

const styles = StyleSheet.create({
  headline: { color: scan.white, fontSize: 36, fontWeight: '800', letterSpacing: 0.4 },
  tier: { color: scan.lime, fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  sponsored: { borderWidth: 2, borderColor: scan.red, borderRadius: 16, padding: 14, gap: 6 },
  sponsoredLabel: { color: scan.red, fontWeight: '800', letterSpacing: 1.1, fontSize: 13 },
});
