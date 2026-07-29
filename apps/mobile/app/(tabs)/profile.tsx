import { ScrollView, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { H1, Body, Label, Card, Button, Divider } from '../../src/ui';
import { getFirstUserId, getGolferProfile, listShotsForPlayer, getSuspectedCalibration } from '../../src/db/repo';
import { buildShotsCsv, buildShotsJson } from '../../src/features/export';
import { registry } from '../../src/providers/registry';

export default function Profile() {
  const t = useTheme();
  const userId = getFirstUserId();
  const profile = userId ? getGolferProfile(userId) : null;
  const shots = userId ? listShotsForPlayer(userId) : [];
  const calibration = userId ? getSuspectedCalibration(userId) : null;

  const exportData = (fmt: 'csv' | 'json') => {
    const content = fmt === 'csv' ? buildShotsCsv(shots) : buildShotsJson(shots);
    // File write + share sheet plug in with expo-file-system + expo-sharing.
    Alert.alert(`Export ready (${fmt.toUpperCase()})`, `${shots.length} shots · ${content.length} characters prepared. Sharing hooks in next.`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <Label>Profile</Label>
        <H1>{profile?.name ?? 'Golfer'}</H1>

        <Card>
          <Row label="Handicap" value={profile?.handicap != null ? String(profile.handicap) : '—'} />
          <Row label="Risk preference" value={profile?.risk_preference ?? 'neutral'} />
          {profile?.notes ? (
            <>
              <Divider />
              <Body muted>{profile.notes}</Body>
            </>
          ) : null}
        </Card>

        {calibration ? (
          <Card>
            <Label>Simulator calibration</Label>
            <Body muted>
              Status: {calibration.status}. Suspected difference {calibration.deltaMinYards}–{calibration.deltaMaxYards}{' '}
              yd, confidence {calibration.confidence}. Never applied automatically.
            </Body>
          </Card>
        ) : null}

        <Card>
          <Label>Your data</Label>
          <Body muted>You own your golf history. Export it anytime.</Body>
          <View style={{ height: t.spacing.sm }} />
          <Button title="Export CSV" kind="ghost" onPress={() => exportData('csv')} />
          <Button title="Export JSON" kind="ghost" onPress={() => exportData('json')} />
          <Button
            title="Delete account"
            kind="ghost"
            onPress={() =>
              Alert.alert('Delete account', 'This removes your local data. Continue?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => void registry.auth?.deleteAccount() },
              ])
            }
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
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
