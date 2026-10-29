import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { bagGaps, formatDistance, verdict, type DistanceProfile } from '@coopr/engine';
import { useLocalStore } from '../../src/local-store';
import { AI_ATTRIBUTION, RENDER_FOOTER, VERDICT_LABEL } from '../../src/bag-scan/copy';
import { Body, Field, Numeral, Panel, SampleChip, ScanButton, ScanScreen, scan } from '../../src/bag-scan/chrome';
import { HANDICAP_MAX, HANDICAP_MIN, pickedTypes, profileFromFit, rangedNumber, SPEED_MAX, SPEED_MIN, toFitClub } from '../../src/bag-scan/logic';
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
  const { profiles, clubs, unit, founderTools } = useLocalStore();
  const bag = useBagScan();
  const [tab, setTab] = useState<'in' | 'out'>('in');
  const saved = bag.clubs;
  const seed = saved.length === 0 ? clubs.filter((club) => club.slot === 'in_play') : [];
  const sample = saved.length === 0 && seed.length === 0 && founderTools ? shownSample(bag.sampleProfile) : null;
  const visible = saved.filter((club) => (tab === 'in' ? club.inPlay : !club.inPlay));
  const userBag = saved.map(toFitClub);
  const userGaps = bagGaps(userBag);
  const userPicked = pickedTypes(saved);
  const userProfile = profileFromFit(bag.fit);
  const showRenderFooter =
    saved.some((club) => clubPictureKind(club.photoUri, club.type) === 'render') ||
    (sample?.clubs.some((club) => clubPictureKind(club.photoUri, club.type) === 'render') ?? false);

  return (
    <ScanScreen title="Bag">
      <Text style={styles.kicker}>BAG</Text>
      {saved.length === 0 && seed.length === 0 && !sample ? <Body>No clubs in the bag yet. Nothing was filled in for you.</Body> : null}
      <ScanButton label="Use a starter bag" tone="ghost" onPress={() => bag.useStarterBag()} />
      {bag.notice ? <Body>{bag.notice}</Body> : null}
      <ScanButton
        label="Add to bag"
        onPress={() => {
          bag.startNew();
          router.push('/bag/add');
        }}
      />
      <YourNumbers fit={bag.fit} onSave={bag.saveFit} />
      {saved.length ? (
        <View style={styles.block}>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel="In play" onPress={() => setTab('in')} style={styles.link}>
              <Text style={styles.linkText}>{tab === 'in' ? 'IN PLAY' : 'In play'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Out of play" onPress={() => setTab('out')} style={styles.link}>
              <Text style={styles.linkText}>{tab === 'out' ? 'OUT OF PLAY' : 'Out of play'}</Text>
            </Pressable>
          </View>
          <Text style={styles.heading}>{`${saved.filter((club) => club.inPlay).length} of 14 in play`}</Text>
          <GapPanel
            median={userGaps.median_gap}
            known={userGaps.known_lofts.length}
            flags={userGaps.flags}
            unknown={userGaps.unknown_loft_in_play}
            benched={userGaps.benched}
          />
          {visible.map((club) => {
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
              <View key={club.id} style={styles.clubBlock}>
              {club.source === 'starter' ? <Text style={styles.starter}>Starter</Text> : null}
              {club.estimatedCarry != null ? (
                <View>
                  <Text style={styles.starter}>{`Estimated ${club.estimatedCarry}. ${club.distanceBasis ?? 'All-player average'}`}</Text>
                  <TextInput
                    accessibilityLabel={`Estimated carry for ${club.slot}`}
                    defaultValue={String(club.estimatedCarry)}
                    keyboardType="number-pad"
                    onEndEditing={(event) => {
                      const next = Number(event.nativeEvent.text);
                      bag.setEstimatedCarry(club.id, Number.isFinite(next) ? next : null);
                    }}
                    style={styles.carry}
                  />
                </View>
              ) : null}
              <ClubRow
                key={club.id}
                club={shown}
                verdictLabel={VERDICT_LABEL[result.verdict]}
                quiet={club.source === 'starter'}
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
              </View>
            );
          })}
        </View>
      ) : null}
      {sample ? (
        <View style={styles.block}>
          <SampleChip />
          <Text style={styles.heading}>Sample bag</Text>
          <Body>{`Handicap ${sample.profile.handicap_index} (Sample)`}</Body>
          <Body>{`Driver speed ${sample.profile.driver_speed_mph} mph (Sample)`}</Body>
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
            known={sample.gaps.known_lofts.length}
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
      {showRenderFooter ? <Body>{RENDER_FOOTER}</Body> : null}
      <Body>{AI_ATTRIBUTION}</Body>
      {seed.map((club) => {
        const carry = stock(profiles, club.id, 'carry');
        const total = stock(profiles, club.id, 'total');
        return (
          <Panel key={club.id}>
            <Text style={styles.label}>{club.label.split('·')[0]?.trim() || club.label}</Text>
            <Text style={styles.number}>{`Carry ${carry ? formatDistance(carry.stockYards, unit) : '—'}`}</Text>
            <Text style={styles.number}>{`Total ${total ? formatDistance(total.stockYards, unit) : '—'}`}</Text>
          </Panel>
        );
      })}
      {saved.map((club) => {
        const carry = stock(profiles, club.id, 'carry');
        const total = stock(profiles, club.id, 'total');
        if (!carry && !total) return null;
        return (
          <Panel key={`distance-${club.id}`}>
            <Text style={styles.label}>{club.slot}</Text>
            <Text style={styles.number}>{`Carry ${carry ? formatDistance(carry.stockYards, unit) : '—'}`}</Text>
            <Text style={styles.number}>{`Total ${total ? formatDistance(total.stockYards, unit) : '—'}`}</Text>
          </Panel>
        );
      })}
    </ScanScreen>
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
          const handicap = rangedNumber(handicapText, HANDICAP_MIN, HANDICAP_MAX);
          const speed = rangedNumber(speedText, SPEED_MIN, SPEED_MAX);
          if (handicap.problem || speed.problem) {
            setError(handicap.problem ? `Handicap has to be from ${HANDICAP_MIN} to ${HANDICAP_MAX}. Nothing was saved.` : `Driver speed has to be from ${SPEED_MIN} to ${SPEED_MAX} mph. Nothing was saved.`);
            return;
          }
          setError(null);
          onSave({
            handicapIndex: handicap.value,
            handicapQuality: handicap.value == null ? null : 'user_confirmed',
            driverSpeedMph: speed.value,
            speedQuality: speed.value == null ? null : 'user_confirmed',
          });
        }}
      />
    </Panel>
  );
}

function GapPanel({
  median,
  known,
  flags,
  unknown,
  benched,
}: {
  median: number | null;
  known: number;
  flags: { kind: string; between: string[]; gap: number }[];
  unknown: string[];
  benched: [string, number | null][];
}) {
  return (
    <Panel>
      {median == null ? (
        <Body>{known === 0 ? 'No loft is set, so a gap is not checked.' : 'One known loft. A gap check needs a second loft.'}</Body>
      ) : (
        <View style={styles.gapRow}>
          <Numeral size={42} color={scan.white}>{median}</Numeral>
          <Body>median gap, degrees. A starting point, not a fitting.</Body>
        </View>
      )}
      {flags.map((flag) => (
        <View key={`${flag.kind}-${flag.between.join('-')}`} style={styles.gapRow}>
          <Body>{`${flag.kind === 'overlap' ? 'Overlap' : 'Gap'}: ${flag.between.join(' and ')}`}</Body>
          <Text style={styles.badge}>{`${flag.gap}° APART`}</Text>
        </View>
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
  quiet = false,
}: {
  club: ShownClub;
  verdictLabel: string;
  onOpen: () => void;
  onDetails?: () => void;
  quiet?: boolean;
}) {
  const name = [club.brand, club.model].filter(Boolean).join(' ');
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={styles.club}>
      <ClubPicture photoUri={club.photoUri} type={club.type} size={64} />
      <View style={styles.clubText}>
        {club.sample ? <SampleChip /> : null}
        <Numeral size={28}>{club.slot}</Numeral>
        {name ? <Text style={styles.clubName}>{name}</Text> : quiet ? <Text style={styles.clubMeta}>Starter</Text> : <Text style={styles.clubName}>Name not set</Text>}
        {quiet ? null : <Text style={styles.clubMeta}>{club.loft == null ? 'Loft not set' : `${club.loft}°`}</Text>}
        {quiet ? null : <Text style={styles.clubMeta}>{verdictLabel}</Text>}
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
  kicker: { color: scan.lime, fontWeight: '800', letterSpacing: 1.2, fontSize: 13 },
  heading: { color: scan.white, fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: scan.white, fontWeight: '800', textDecorationLine: 'underline' },
  label: { color: scan.white, fontSize: 28, fontWeight: '800' },
  number: { color: scan.white, fontSize: 22, fontWeight: '800' },
  error: { color: scan.warn, fontWeight: '700' },
  badge: { color: scan.navy, backgroundColor: scan.lime, fontWeight: '800', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clubBlock: { gap: 4 },
  starter: { color: scan.lime, fontSize: 13, fontWeight: '800' },
  carry: { minHeight: 44, color: scan.white, fontSize: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)' },
  club: { flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'center' },
  clubText: { flex: 1, gap: 2 },
  clubName: { color: scan.white, fontSize: 16, fontWeight: '700' },
  clubMeta: { color: scan.muted, fontSize: 14 },
  details: { color: scan.white, fontWeight: '800', textDecorationLine: 'underline', minHeight: 44, paddingVertical: 10 },
});
