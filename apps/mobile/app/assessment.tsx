import { useMemo } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { assessGolfIq } from '@coopr/engine';
import { useTheme } from '../src/theme';
import { Card, H1, H2, Body, Label, Button, Divider } from '../src/ui';
import { getFirstUserId, getActiveBagId, listClubs } from '../src/db/repo';
import { computePlayerProfiles } from '../src/features/profiles';

export default function Assessment() {
  const t = useTheme();
  const router = useRouter();
  const userId = getFirstUserId();

  const assessment = useMemo(() => {
    if (!userId) return null;
    const profiles = computePlayerProfiles(userId, Date.now());
    const bagId = getActiveBagId(userId);
    const clubs = bagId ? listClubs(bagId) : [];
    if (profiles.length === 0) return null;
    return assessGolfIq(profiles, clubs);
  }, [userId]);

  if (!assessment) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
        <View style={{ padding: t.spacing.lg }}>
          <Body muted>No baseline yet. Log a session to generate your Golf IQ.</Body>
        </View>
      </SafeAreaView>
    );
  }

  const sevColor = (s: 'info' | 'watch' | 'priority') =>
    s === 'priority' ? t.semantic.danger : s === 'watch' ? t.semantic.warning : t.textSecondary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <Label>Your Golf IQ</Label>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.md }}>
          <Body style={{ fontSize: 64, fontWeight: '800', color: t.textPrimary }}>{assessment.overallScore}</Body>
          <H1>{assessment.grade}</H1>
        </View>
        <Body muted>
          Baseline {Math.round(assessment.baselineCompleteness * 100)}% complete · confidence{' '}
          {Math.round(assessment.confidence * 100)}%
        </Body>

        <View style={{ height: t.spacing.md }} />
        <Card>
          <Label>Breakdown</Label>
          <Divider />
          {assessment.components.map((c) => (
            <View key={c.key} style={{ marginVertical: t.spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Body>{c.label}</Body>
                <Body style={{ fontWeight: '700' }}>{c.score}</Body>
              </View>
              <View style={{ height: 6, backgroundColor: t.surface, borderRadius: 3, marginTop: 4 }}>
                <View style={{ width: `${c.score}%`, height: 6, backgroundColor: t.accent, borderRadius: 3 }} />
              </View>
              <Body muted style={{ fontSize: t.fontSize.xs, marginTop: 2 }}>{c.rationale}</Body>
            </View>
          ))}
        </Card>

        <Card>
          <Label>What matters most</Label>
          <Divider />
          {assessment.insights.map((ins, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: t.spacing.sm, marginVertical: t.spacing.xs }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sevColor(ins.severity), marginTop: 6 }} />
              <Body style={{ flex: 1 }}>{ins.text}</Body>
            </View>
          ))}
        </Card>

        <Card>
          <Label>Practice priorities</Label>
          <Divider />
          {assessment.practicePriorities.map((p) => (
            <View key={p.clubId} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: t.spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '600' }}>{p.clubLabel}</Body>
                <Body muted style={{ fontSize: t.fontSize.xs }}>{p.reason}</Body>
              </View>
              <Body muted>leak {Math.round(p.leakScore * 100)}%</Body>
            </View>
          ))}
        </Card>

        <Card>
          <Label>Baseline coverage</Label>
          <Divider />
          {assessment.coverage.map((c) => (
            <View key={c.category} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: t.spacing.xs }}>
              <Body muted>{c.category.replace('_', ' / ')}</Body>
              <Body style={{ color: c.adequate ? t.semantic.success : t.semantic.warning }}>
                {c.adequate ? 'ready' : `${c.clubsWithData} club(s) — add data`}
              </Body>
            </View>
          ))}
        </Card>

        {assessment.disclaimers.map((d, i) => (
          <Body key={i} muted style={{ fontSize: t.fontSize.xs, marginTop: t.spacing.xs }}>
            • {d}
          </Body>
        ))}

        <View style={{ height: t.spacing.lg }} />
        <Button title="Enter COOPR" onPress={() => router.replace('/home')} />
      </ScrollView>
    </SafeAreaView>
  );
}
