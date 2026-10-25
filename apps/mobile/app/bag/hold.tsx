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
import { returnFromHold } from '../../src/bag-scan/bag-nav';
import { leaveDraftForShots } from '../../src/bag-scan/play-note';
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
      <Body>No offers on this phone. Nothing else is suggested.</Body>
      <ScanButton
        label="KEEP IT ANYWAY"
        onPress={() => {
          if (sample) {
            state.setNotice('Sample stays off your bag.');
            return;
          }
          state.saveDraft('kept_anyway');
          state.setNotice('Kept anyway. The verdict stays on the card.');
          returnFromHold(router);
        }}
      />
      <ScanButton
        label="LOG SHOTS FIRST"
        tone="ghost"
        onPress={() => {
          if (!sample) leaveDraftForShots(state.draft);
          state.setNotice(sample ? 'Sample stays off your bag. Log shots from the hole.' : 'Shots are logged on the hole. This club stays in Add club until you keep it.');
          router.push('/play');
        }}
      />
    </ScanScreen>
  );
}

const styles = StyleSheet.create({
  headline: { color: scan.white, fontSize: 36, fontWeight: '800', letterSpacing: 0.4 },
  tier: { color: scan.lime, fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  sponsored: { backgroundColor: scan.red, borderRadius: 16, padding: 14, gap: 6 },
  sponsoredLabel: { color: scan.white, fontWeight: '800', letterSpacing: 1.1, fontSize: 13 },
});
