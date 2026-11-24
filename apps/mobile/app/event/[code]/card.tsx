import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useDisplayFace } from '../../../src/design/display-font';
import { loadPublicEvent } from '../../../src/events/client';
import { contestLine, formatToPar } from '../../../src/events/scoring';
import type { PublicEvent } from '../../../src/events/types';
import { BigButton, EventFrame, Note } from '../../../src/events/ui';

/** Recap card for a share. Placeholder art until a sponsor sends a real file. */
export default function ShareCard() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' ? params.code.toUpperCase() : '';
  const display = useDisplayFace();
  const [event, setEvent] = useState<PublicEvent | null>(null);

  useEffect(() => {
    if (!code) return;
    let stop = false;
    void loadPublicEvent(code).then((next) => {
      if (!stop) setEvent(next);
    });
    return () => {
      stop = true;
    };
  }, [code]);

  const accent = event?.accent ?? '#0B1F3A';
  const recap = event?.logos.find((logo) => logo.slot === 'recap') ?? null;
  const partner = event?.logos.find((logo) => logo.slot === 'prize-partner') ?? null;
  const cup = event?.logos.find((logo) => logo.slot === 'winning-prize') ?? null;
  const leader = event?.rows.find((row) => row.rank === 1) ?? null;
  const closest = contestLine('Closest to the pin', event?.contests.closestToPin ?? []);
  const drive = contestLine('Longest drive', event?.contests.longestDrive ?? []);

  return (
    <EventFrame>
      <Stack.Screen options={{ title: 'Share card' }} />
      <View style={{ backgroundColor: '#0B1F3A', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: accent, fontSize: 13, fontWeight: '800' }}>{event?.charityName ?? 'COOPR'}</Text>
        <Text style={{ color: '#FFFFFF', fontFamily: display, fontSize: 40, lineHeight: 44 }}>{event?.name ?? 'Live event'}</Text>
        {recap ? <Image accessibilityLabel={recap.name} source={{ uri: recap.dataUrl }} resizeMode="contain" style={{ height: 56, width: 200 }} /> : null}
        {leader ? <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>{`${leader.name} · ${formatToPar(leader.toPar)}`}</Text> : <Note>The card fills in as scores come in.</Note>}
        {cup ? <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{`Panther Cup presented by ${cup.name}`}</Text> : null}
        {partner ? <Text style={{ color: accent, fontSize: 16, fontWeight: '700' }}>{`Prize partner · ${partner.name}`}</Text> : null}
        {closest ? <Text style={{ color: '#FFFFFF' }}>{closest}</Text> : null}
        {drive ? <Text style={{ color: '#FFFFFF' }}>{drive}</Text> : null}
      </View>
      <BigButton label="Get COOPR" onPress={() => router.push('/get')} />
      <BigButton label="Back to the board" tone="navy" onPress={() => router.push(`/event/${code}`)} />
    </EventFrame>
  );
}
