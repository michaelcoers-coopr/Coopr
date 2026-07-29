import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { H1, H2, Body, Label, Card, Divider } from '../../src/ui';
import { getFirstUserId, listClubs, getActiveBagId, getSuspectedCalibration } from '../../src/db/repo';
import { computeClubProfile } from '../../src/features/profiles';

export default function ClubDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = getFirstUserId();
  const bagId = userId ? getActiveBagId(userId) : null;
  const club = (bagId ? listClubs(bagId) : []).find((c) => c.id === id);
  const profile = id ? computeClubProfile(id, Date.now()) : null;
  const calibration = userId ? getSuspectedCalibration(userId) : null;

  const q = profile ? (profile.metric === 'carry' ? profile.carry : profile.total) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <Label>{[club?.manufacturer, club?.model].filter(Boolean).join(' ') || 'Club'}</Label>
        <H1>{club?.label ?? 'Club'}</H1>
        {club?.loftDeg ? <Body muted>{club.loftDeg}° · {club.shaftFlex ?? 'flex ?'} flex</Body> : null}

        {!profile ? (
          <Card>
            <Body muted>No shot data yet for this club.</Body>
          </Card>
        ) : (
          <>
            <Card>
              <Label>Stock distance ({profile.metric})</Label>
              <H1>{Math.round(profile.stockDistanceYards)} yd</H1>
              <Body muted>Median of {profile.sampleSize} shots. Mishits are kept for risk, not averaged in.</Body>
              {q ? (
                <>
                  <Divider />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Stat label="P20 (short)" value={`${Math.round(q.p20)}`} />
                    <Stat label="P50 (stock)" value={`${Math.round(q.p50)}`} />
                    <Stat label="P80 (good)" value={`${Math.round(q.p80)}`} />
                  </View>
                  <Body muted style={{ marginTop: t.spacing.sm }}>
                    A {Math.round(q.p80 - q.p20)} yd spread between your short and good strikes.
                  </Body>
                </>
              ) : null}
            </Card>

            <Card>
              <Label>Reliability</Label>
              <Row label="Short-miss rate" value={pct(profile.shortMissRate)} />
              <Row label="Long-miss rate" value={pct(profile.longMissRate)} />
              <Row label="Mishit rate" value={pct(profile.mishitRate)} />
              <Row label="Dispersion (IQR)" value={`${Math.round(profile.dispersion.iqrYards)} yd`} />
              <Row label="Confidence" value={pct(profile.confidence)} />
              {profile.goodStrikeDistanceYards != null ? (
                <Row
                  label={`Good strike (${profile.goodStrikeSource === 'label' ? 'verified' : 'derived'})`}
                  value={`${Math.round(profile.goodStrikeDistanceYards)} yd`}
                />
              ) : null}
              {profile.validationRequired ? (
                <Body style={{ color: t.semantic.warning, marginTop: t.spacing.sm }}>
                  ⚠ A session for this club is flagged for data validation.
                </Body>
              ) : null}
            </Card>

            {profile.environment === 'simulator' && calibration?.status === 'suspected' && q ? (
              <Card>
                <Label>Possible outdoor range (unverified)</Label>
                <Body muted>
                  Simulator stock {Math.round(profile.stockDistanceYards)} yd. If the suspected{' '}
                  {calibration.deltaMinYards}–{calibration.deltaMaxYards} yd difference holds, outdoor could be roughly{' '}
                  {Math.round(profile.stockDistanceYards + (calibration.deltaMinYards ?? 0))}–
                  {Math.round(profile.stockDistanceYards + (calibration.deltaMaxYards ?? 0))} yd. Not verified; never
                  applied to your numbers.
                </Body>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <H2>{value}</H2>
      <Body muted style={{ fontSize: t.fontSize.xs }}>
        {label}
      </Body>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: t.spacing.xs }}>
      <Body muted>{label}</Body>
      <Body style={{ fontWeight: '600' }}>{value}</Body>
    </View>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
