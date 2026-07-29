import { useMemo } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ClubStatus } from '@coopr/core';
import { useTheme } from '../src/theme';
import { Card, H1, Body, Label, Divider } from '../src/ui';
import { getFirstUserId } from '../src/db/repo';
import { computeBagIntelligence } from '../src/features/profiles';

const STATUS_LABEL: Record<ClubStatus, string> = {
  keep: 'Keep', test: 'Test', replace: 'Replace', remove: 'Remove', retest: 'Retest', gather_data: 'Log data',
};

export default function EquipmentLab() {
  const t = useTheme();
  const userId = getFirstUserId();
  const bag = useMemo(() => (userId ? computeBagIntelligence(userId, Date.now()) : null), [userId]);

  const statusColor = (s: ClubStatus): string => {
    switch (s) {
      case 'keep': return t.semantic.success;
      case 'test': return t.semantic.warning;
      case 'replace': return t.semantic.danger;
      case 'remove': return t.semantic.danger;
      case 'retest': return '#F1750D';
      case 'gather_data': return t.textMuted;
    }
  };
  const sevColor = (s: 'info' | 'watch' | 'priority') =>
    s === 'priority' ? t.semantic.danger : s === 'watch' ? t.semantic.warning : t.textSecondary;

  if (!bag) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
        <View style={{ padding: t.spacing.lg }}>
          <Body muted>No bag data yet. Log a session to unlock the Equipment Lab.</Body>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <Label>Equipment Lab</Label>
        <H1>Your bag, examined</H1>
        <Body muted>Organic fit from your own data — no brand influence. Suggestions are things to test, not verdicts.</Body>

        <View style={{ height: t.spacing.md }} />
        <Card>
          <Label>What matters most</Label>
          <Divider />
          {bag.insights.length === 0 ? (
            <Body muted>Nothing flagged — log more sessions to sharpen this.</Body>
          ) : (
            bag.insights.map((ins, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: t.spacing.sm, marginVertical: t.spacing.xs }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sevColor(ins.severity), marginTop: 6 }} />
                <Body style={{ flex: 1 }}>{ins.text}</Body>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Label>Club by club</Label>
          <Divider />
          {bag.clubReports.map((r) => (
            <View
              key={r.clubId}
              style={{
                flexDirection: 'row', alignItems: 'flex-start', paddingVertical: t.spacing.sm,
                borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth,
              }}
            >
              <View style={{ width: 52 }}>
                <Body style={{ fontWeight: '700' }}>{r.clubLabel}</Body>
                <Body muted style={{ fontSize: t.fontSize.xs }}>
                  {r.stockYards != null ? `${Math.round(r.stockYards)} yд` : '—'}
                </Body>
              </View>
              <View style={{ flex: 1 }}>
                <Body muted style={{ fontSize: t.fontSize.xs }}>{r.reasons[0]}</Body>
              </View>
              <View
                style={{
                  paddingVertical: 3, paddingHorizontal: t.spacing.sm, borderRadius: t.radius.pill,
                  borderColor: statusColor(r.status), borderWidth: StyleSheet.hairlineWidth,
                }}
              >
                <Body style={{ color: statusColor(r.status), fontSize: t.fontSize.xs, fontWeight: '700' }}>
                  {STATUS_LABEL[r.status]}
                </Body>
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <Label>Ideal bag ({bag.carryCount} clubs)</Label>
          <Body muted style={{ marginBottom: t.spacing.sm }}>Based on your performance, not traditional loft gaps.</Body>
          <Divider />
          {bag.idealBag.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
              <Body style={{ flex: 1 }}>
                {item.clubLabel} <Body muted style={{ fontSize: t.fontSize.xs }}>· {item.role}</Body>
              </Body>
              <Body
                muted
                style={{
                  fontSize: t.fontSize.xs,
                  color: item.action === 'drop' ? t.semantic.danger : item.action === 'test_alternative' ? t.semantic.warning : t.textSecondary,
                }}
              >
                {item.action === 'carry' ? 'carry' : item.action === 'drop' ? 'drop' : 'test alt'}
              </Body>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
