import { ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { H1, H2, Body, Label, Card, Button } from '../../src/ui';
import { sqlite } from '../../src/db/client';
import { getFirstUserId, listShotsForPlayer } from '../../src/db/repo';

interface SessionRow {
  id: string;
  date: number;
  environment: string;
  validation_required: number;
  shot_count: number;
}

export default function Practice() {
  const t = useTheme();
  const router = useRouter();
  const userId = getFirstUserId();
  const shots = userId ? listShotsForPlayer(userId) : [];
  const sessions = userId
    ? sqlite.getAllSync<SessionRow>(
        `SELECT s.id, s.date, s.environment, s.validation_required,
                (SELECT COUNT(*) FROM shots sh WHERE sh.session_id = s.id AND sh.deleted_at IS NULL) AS shot_count
         FROM sessions s WHERE s.user_id = ? AND s.deleted_at IS NULL ORDER BY s.date DESC;`,
        [userId],
      )
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <Label>Practice</Label>
        <H1>Sessions</H1>
        <Body muted>{shots.length} shots across {sessions.length} sessions.</Body>
        <Body muted style={{ marginTop: t.spacing.xs }}>
          Log ~10 shots per club, keeping categories separate. Imported values are always shown for your confirmation
          before they touch your model.
        </Body>

        <View style={{ height: t.spacing.md }} />
        <Button title="Start a baseline session" onPress={() => router.push('/(onboarding)/session')} />
        <Button title="Import a session (CSV)" kind="ghost" onPress={() => router.push('/(onboarding)/csv')} />

        <View style={{ height: t.spacing.lg }} />
        {sessions.map((s) => (
          <View
            key={s.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: t.spacing.md,
              borderBottomColor: t.border,
              borderBottomWidth: StyleSheet.hairlineWidth,
            }}
          >
            <View>
              <Body style={{ fontWeight: '600' }}>{s.environment}</Body>
              <Body muted style={{ fontSize: t.fontSize.xs }}>
                {new Date(s.date).toISOString().slice(0, 10)}
                {s.validation_required ? ' · ⚠ validate' : ''}
              </Body>
            </View>
            <H2>{s.shot_count}</H2>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
