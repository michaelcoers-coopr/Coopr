import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { Card, H1, H2, Body, Label, Button, Divider } from '../../src/ui';

// First run: explain the baseline, then pick how to capture the first session.
// Goal — ~10 shots per club, categories kept separate — is what powers the Golf IQ
// assessment.
export default function OnboardingWelcome() {
  const t = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <Label>Welcome to COOPR</Label>
        <H1>Let's build your baseline</H1>
        <Body muted>
          COOPR learns how you actually play. We'll capture about 10 shots per club so your caddie and Golf IQ are built
          on your real numbers — not generic averages.
        </Body>

        <View style={{ height: t.spacing.md }} />
        <Card>
          <Label>How it works</Label>
          <Divider />
          <Body>• ~10 shots per club for a solid read.</Body>
          <Body>• Keep categories in separate sessions — irons, driver, woods/hybrids, and wedges on their own.</Body>
          <Body>• Mishits count. We keep them for risk; they never inflate your stock number.</Body>
          <Body muted style={{ marginTop: t.spacing.sm }}>
            Simulator numbers can read a little short of the course — we track that separately and never apply it
            silently.
          </Body>
        </Card>

        <H2>Add your first session</H2>
        <Card>
          <Button title="Connect TrackMan" kind="ghost" onPress={() => router.push('/onboarding/csv')} />
          <Body muted style={{ fontSize: t.fontSize.xs, marginBottom: t.spacing.sm }}>
            Direct connect is coming — for now, export your session and import the CSV.
          </Body>
          <Button title="Upload a screenshot" kind="ghost" onPress={() => router.push('/onboarding/csv')} />
          <Body muted style={{ fontSize: t.fontSize.xs, marginBottom: t.spacing.sm }}>
            Screenshot reading is coming — extracted values will always be shown for your confirmation first.
          </Body>
          <Button title="Import a CSV" onPress={() => router.push('/onboarding/csv')} />
          <Button title="Enter shots manually" kind="ghost" onPress={() => router.push('/onboarding/session')} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
