import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { Card, H1, H2, Body, Label, Button, Divider, Wordmark } from '../../src/ui';
import { getFirstUserId, getGolferProfile, getActiveBagId, listClubs, listShotsForPlayer, getSuspectedCalibration } from '../../src/db/repo';
import { getSetting } from '../../src/db/settings';

export default function Home() {
  const t = useTheme();
  const router = useRouter();

  const userId = getFirstUserId();
  const profile = userId ? getGolferProfile(userId) : null;
  const bagId = userId ? getActiveBagId(userId) : null;
  const clubs = bagId ? listClubs(bagId) : [];
  const shots = userId ? listShotsForPlayer(userId) : [];
  const calibration = userId ? getSuspectedCalibration(userId) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <View style={{ marginBottom: t.spacing.md }}>
          <Wordmark size={30} />
        </View>
        <H1>{profile?.name ? `Hi, ${profile.name}` : 'Welcome'}</H1>
        <Body muted>Know your game. Play your game.</Body>
        <DataBanner />

        <View style={{ height: t.spacing.xl }} />
        <Button title="PLAY GOLF" onPress={() => router.push('/scorecard')} />
        <Button title="ASK MY CADDIE" kind="ghost" onPress={() => router.push('/ask')} />
        <Button title="SEE MY GOLF IQ" kind="ghost" onPress={() => router.push('/assessment')} />

        <View style={{ height: t.spacing.xl }} />
        <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <Card style={{ flex: 1 }}>
            <Label>Clubs</Label>
            <H2>{clubs.length}</H2>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label>Shots logged</Label>
            <H2>{shots.length}</H2>
          </Card>
        </View>

        <Card>
          <Label>Quick links</Label>
          <Divider />
          <Body onPress={() => router.push('/bag')} style={{ marginBottom: t.spacing.sm }}>My Bag ›</Body>
          <Body onPress={() => router.push('/practice')} style={{ marginBottom: t.spacing.sm }}>Practice ›</Body>
          <Body onPress={() => router.push('/profile')}>Performance & Profile ›</Body>
        </Card>

        {calibration && calibration.status === 'suspected' ? (
          <Card>
            <Label>Calibration</Label>
            <Body muted>
              A possible {calibration.deltaMinYards}–{calibration.deltaMaxYards} yd simulator-to-outdoor difference is
              noted but unverified. It is never applied automatically to your numbers.
            </Body>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DataBanner() {
  const t = useTheme();
  const kind = getSetting('data_kind');
  const text =
    kind === 'sample'
      ? 'Sample golfer — real TrackMan data.'
      : kind === 'estimate'
        ? 'Estimated from your handicap. Log real shots to make it truly yours.'
        : null;
  if (!text) return null;
  return (
    <View
      style={{
        alignSelf: 'flex-start', marginTop: t.spacing.sm, paddingVertical: 4, paddingHorizontal: t.spacing.md,
        borderRadius: t.radius.pill, borderColor: t.accent, borderWidth: 1,
      }}
    >
      <Body style={{ color: t.accent, fontSize: t.fontSize.xs }}>{text}</Body>
    </View>
  );
}
