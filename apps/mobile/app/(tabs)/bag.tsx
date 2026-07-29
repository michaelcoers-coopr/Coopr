import { useMemo } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ClubProfile } from '@coopr/core';
import { useTheme } from '../../src/theme';
import { H1, Body, Label } from '../../src/ui';
import { getFirstUserId, getActiveBagId, listClubs } from '../../src/db/repo';
import { computePlayerProfiles } from '../../src/features/profiles';

export default function Bag() {
  const t = useTheme();
  const router = useRouter();
  const userId = getFirstUserId();
  const bagId = userId ? getActiveBagId(userId) : null;
  const clubs = bagId ? listClubs(bagId) : [];
  const profiles = useMemo(() => (userId ? computePlayerProfiles(userId, Date.now()) : []), [userId]);
  const profileByClub = new Map<string, ClubProfile>(profiles.map((p) => [p.clubId, p]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <Label>Your bag</Label>
        <H1>Clubs</H1>
        <Body muted>Stock distance is the median of your shots — mishits shape risk, not this number.</Body>

        <View style={{ height: t.spacing.lg }} />
        {clubs.map((c) => {
          const p = profileByClub.get(c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => router.push({ pathname: '/club/[id]', params: { id: c.id } })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: t.spacing.md,
                borderBottomColor: t.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              }}
            >
              <View style={{ width: 56 }}>
                <Body style={{ fontWeight: '700' }}>{c.label}</Body>
              </View>
              <View style={{ flex: 1 }}>
                <Body muted>{[c.manufacturer, c.model].filter(Boolean).join(' ') || 'Club'}</Body>
                {p ? (
                  <Body muted style={{ fontSize: t.fontSize.xs }}>
                    {p.metric} · n={p.sampleSize}
                    {p.validationRequired ? ' · ⚠ validate' : ''}
                  </Body>
                ) : (
                  <Body muted style={{ fontSize: t.fontSize.xs }}>
                    no data yet
                  </Body>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', width: 96 }}>
                {p ? (
                  <>
                    <Body style={{ fontWeight: '700' }}>{Math.round(p.stockDistanceYards)} yd</Body>
                    <ConfidenceBar value={p.confidence} />
                  </>
                ) : (
                  <Body muted>—</Body>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const t = useTheme();
  const color = value < 0.35 ? t.semantic.danger : value < 0.55 ? t.semantic.warning : t.semantic.success;
  return (
    <View style={{ width: 80, height: 5, borderRadius: 3, backgroundColor: t.surface, marginTop: 4 }}>
      <View style={{ width: `${Math.round(value * 100)}%`, height: 5, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}
