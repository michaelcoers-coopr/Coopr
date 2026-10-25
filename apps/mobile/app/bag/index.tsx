import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors } from '@coopr/tokens';
import { bagGaps, formatDistance, verdict, type DistanceProfile } from '@coopr/engine';
import { useLocalStore } from '../../src/local-store';
import { Button, Card, Muted, Screen, Title } from '../../src/ui';
import { AI_ATTRIBUTION, RENDER_FOOTER, VERDICT_LABEL } from '../../src/bag-scan/copy';
import { Body, Field, Numeral, Panel, SampleChip, ScanButton, scan } from '../../src/bag-scan/chrome';
import { parseOptionalNumber, pickedTypes, profileFromFit, toFitClub } from '../../src/bag-scan/logic';
import { clubPictureKind } from '../../src/bag-scan/picture-kind';
import { ClubPicture } from '../../src/bag-scan/picture';
import { fitForShown, shownSample, type ShownClub } from '../../src/bag-scan/resolve';
import { useBagScan } from '../../src/bag-scan/session';
import type { StoredFit } from '../../src/bag-scan/types';

function stock(profiles: readonly DistanceProfile[], clubId: string, metric: 'carry' | 'total'): DistanceProfile | null {
  const rows = profiles.filter((profile) => profile.clubId === clubId && profile.metric === metric);
  return rows.find((profile) => profile.blended) ?? rows[0] ?? null;
}

export default function BagScreen() {
  const { profiles, clubs, unit } = useLocalStore();
  const bag = useBagScan();
  const inPlay = clubs.filter((club) => club.slot === 'in_play');
  const scanInPlay = bag.clubs.filter((club) => club.inPlay);
  const sample = bag.clubs.length === 0 ? shownSample(bag.sampleProfile) : null;
  const nothing = inPlay.length === 0 && scanInPlay.length === 0 && !sample;
  const userBag = bag.clubs.map(toFitClub);
  const userGaps = bagGaps(userBag);
  const userPicked = pickedTypes(bag.clubs);
  const userProfile = profileFromFit(bag.fit);
  const showRenderFooter =
    bag.clubs.some((club) => clubPictureKind(club.photoUri, club.type) === 'render') ||
    (sample?.clubs.some((club) => clubPictureKind(club.photoUri, club.type) === 'render') ?? false);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Bag',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.navy,
          headerTitleStyle: { fontWeight: '800', color: colors.navy },
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <Title>Bag</Title>
      <Muted>{`${inPlay.length} of 14. Carry and total stay apart.`}</Muted>
      {nothing ? <Muted>No clubs in the bag yet. Add one in Setup. Nothing was filled in for you.</Muted> : null}
      {bag.notice ? <Muted>{bag.notice}</Muted> : null}
      <Button
        label="Add to bag"
        onPress={() => {
          bag.startNew();
          router.push('/bag/add');
        }}
      />
      <YourNumbers fit={bag.fit} onSave={bag.saveFit} />
      {bag.clubs.length ? (
        <View style={styles.block}>
          <Text style={styles.heading}>{`${scanInPlay.length} of 14 in play`}</Text>
          <GapPanel
            median={userGaps.median_gap}
            flags={userGaps.flags}
            unknown={userGaps.unknown_loft_in_play}
            benched={userGaps.benched}
          />
          {bag.clubs.map((club) => {
            const shown: ShownClub = {
              id: club.id,
              slot: club.slot,
              inPlay: club.inPlay,
              brand: club.brand,
              model: club.model,
              type: club.type,
              loft: club.loft,
              flex: club.flex,
              ironBuild: club.ironBuild,
              photoUri: club.photoUri,
              clubNumber: club.clubNumber,
              sample: false,
              fitAck: club.fitAck,
              note: null,
            };
            const result = verdict(toFitClub(club), userProfile, userBag, userPicked);
            return (
              <ClubRow
                key={club.id}
                club={shown}
                verdictLabel={VERDICT_LABEL[result.verdict]}
                onOpen={() => {
                  bag.openSaved(club.id);
                  router.push('/bag/card');
                }}
                onDetails={
                  club.brand == null || club.loft == null
                    ? () => {
                        bag.editClub(club);
                        router.push('/bag/details');
                      }
                    : undefined
                }
              />
            );
          })}
        </View>
      ) : null}
      {sample ? (
        <View style={styles.block}>
          <SampleChip />
          <Text style={styles.heading}>Sample bag</Text>
          <Muted>Sample player {bag.sampleProfile} is not your handicap or your driver speed.</Muted>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={() => bag.setSampleProfile('A')} style={styles.link}>
              <Text style={styles.linkText}>Sample player A</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => bag.setSampleProfile('B')} style={styles.link}>
              <Text style={styles.linkText}>Sample player B</Text>
            </Pressable>
          </View>
          <GapPanel
            median={sample.gaps.median_gap}
            flags={sample.gaps.flags}
            unknown={sample.gaps.unknown_loft_in_play}
            benched={sample.gaps.benched}
          />
          {sample.clubs.map((club) => (
            <ClubRow
              key={club.id}
              club={club}
              verdictLabel={VERDICT_LABEL[fitForShown(club, sample.bag, sample.profile, sample.picked).verdict]}
              onOpen={() => {
                bag.openSample(club.id);
                router.push('/bag/card');
              }}
            />
          ))}
        </View>
      ) : null}
      {showRenderFooter ? <Muted>{RENDER_FOOTER}</Muted> : null}
      <Muted>{AI_ATTRIBUTION}</Muted>
      {inPlay.map((club) => {
        const carry = stock(profiles, club.id, 'carry');
        const total = stock(profiles, club.id, 'total');
        return (
          <Card key={club.id}>
            <Text style={styles.label}>{club.label.split('·')[0]?.trim() || club.label}</Text>
            <Text style={styles.number}>{`Carry ${carry ? formatDistance(carry.stockYards, unit) : '—'}`}</Text>
            <Text style={styles.number}>{`Total ${total ? formatDistance(total.stockYards, unit) : '—'}`}</Text>
          </Card>
        );
      })}
      <Button label="Setup" tone="ghost" onPress={() => router.push('/setup')} />
    </Screen>
  );
}

function YourNumbers({ fit, onSave }: { fit: StoredFit; onSave: (fit: StoredFit) => void }) {
  const [handicapText, setHandicapText] = useState(fit.handicapIndex == null ? '' : String(fit.handicapIndex));
  const [speedText, setSpeedText] = useState(fit.driverSpeedMph == null ? '' : String(fit.driverSpeedMph));
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel>
      <Body>Your handicap and driver speed. Leave a box blank if you do not know. Nothing is guessed.</Body>
      <Field label="Handicap index" value={handicapText} onChangeText={setHandicapText} placeholder="Blank" />
      <Field label="Driver speed, mph" value={speedText} onChangeText={setSpeedText} placeholder="Blank" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScanButton
        label="SAVE ON THIS PHONE"
        onPress={() => {
          const handicapBlank = handicapText.trim() === '';
          const speedBlank = speedText.trim() === '';
          const handicap = parseOptionalNumber(handicapText);
          const speed = parseOptionalNumber(speedText);
          if ((!handicapBlank && handicap == null) || (!speedBlank && speed == null)) {
            setError('That is not a number. Nothing was saved.');
            return;
          }
          setError(null);
          onSave({
            handicapIndex: handicap,
            handicapQuality: handicap == null ? null : 'user_confirmed',
            driverSpeedMph: speed,
            speedQuality: speed == null ? null : 'user_confirmed',
          });
        }}
      />
    </Panel>
  );
}

function GapPanel({
  median,
  flags,
  unknown,
  benched,
}: {
  median: number | null;
  flags: { kind: string; between: string[]; gap: number }[];
  unknown: string[];
  benched: [string, number | null][];
}) {
  return (
    <Panel>
      {median == null ? (
        <Body>Not enough known lofts to check a gap.</Body>
      ) : (
        <View style={styles.gapRow}>
          <Numeral size={42} color={scan.white}>{median}</Numeral>
          <Body>median gap, degrees. A starting point, not a fitting.</Body>
        </View>
      )}
      {flags.map((flag) => (
        <Body key={`${flag.kind}-${flag.between.join('-')}`}>
          {`${flag.kind === 'overlap' ? 'Overlap' : 'Gap'}: ${flag.between.join(' and ')} are ${flag.gap}° apart.`}
        </Body>
      ))}
      {unknown.length ? <Body>{`Unchecked, loft not set: ${unknown.join(', ')}.`}</Body> : null}
      {benched.length ? (
        <Body>{`Out of play: ${benched.map(([slot, loft]) => (loft == null ? slot : `${slot} ${loft}°`)).join(', ')}.`}</Body>
      ) : null}
    </Panel>
  );
}

function ClubRow({
  club,
  verdictLabel,
  onOpen,
  onDetails,
}: {
  club: ShownClub;
  verdictLabel: string;
  onOpen: () => void;
  onDetails?: () => void;
}) {
  const name = [club.brand, club.model].filter(Boolean).join(' ');
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={styles.club}>
      <ClubPicture photoUri={club.photoUri} type={club.type} size={64} />
      <View style={styles.clubText}>
        {club.sample ? <SampleChip /> : null}
        <Numeral size={28} color={colors.navy}>{club.slot}</Numeral>
        <Text style={styles.clubName}>{name || 'Name not set'}</Text>
        <Text style={styles.clubMeta}>{club.loft == null ? 'Loft not set' : `${club.loft}°`}</Text>
        <Text style={styles.clubMeta}>{verdictLabel}</Text>
        {!club.inPlay ? <Text style={styles.clubMeta}>Out of play</Text> : null}
        {onDetails ? (
          <Pressable accessibilityRole="button" onPress={onDetails}>
            <Text style={styles.details}>Add details</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  heading: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.navy, fontWeight: '800', textDecorationLine: 'underline' },
  label: { color: colors.navy, fontSize: 28, fontWeight: '800' },
  number: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  error: { color: '#C8102E', fontWeight: '700' },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  club: { flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'center' },
  clubText: { flex: 1, gap: 2 },
  clubName: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  clubMeta: { color: colors.muted, fontSize: 14 },
  details: { color: colors.navy, fontWeight: '800', textDecorationLine: 'underline', paddingVertical: 6 },
});
