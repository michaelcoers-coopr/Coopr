import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useDisplayFace } from '../../../src/design/display-font';
import { loadPublicEvent, POLL_MS } from '../../../src/events/client';
import { contestLine, formatToPar } from '../../../src/events/scoring';
import type { PublicEvent } from '../../../src/events/types';

const navy = '#0B1F3A';
const lime = '#8AC926';
const white = '#FFFFFF';

/** Clubhouse screen. High contrast, auto-scroll, rotating sponsor marks. No tap-through ads. */
export default function TvBoard() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' ? params.code.toUpperCase() : '';
  const display = useDisplayFace();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [logoIndex, setLogoIndex] = useState(0);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (!code) return;
    let stop = false;
    const tick = async () => {
      const next = await loadPublicEvent(code);
      if (!stop && next) setEvent(next);
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [code]);

  const logos = event?.logos.filter((logo) => logo.slot !== 'library') ?? [];
  const rows = event?.rows ?? [];

  useEffect(() => {
    const id = setInterval(() => setLogoIndex((value) => value + 1), 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setShift((value) => value + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const accent = event?.accent ?? lime;
  const title = event?.logos.find((item) => item.slot === 'title') ?? null;
  const closest = contestLine('Closest to the pin', event?.contests.closestToPin ?? []);
  const drive = contestLine('Longest drive', event?.contests.longestDrive ?? []);
  const logo = logos.length > 0 ? logos[logoIndex % logos.length] ?? null : null;
  const start = rows.length > 0 ? shift % rows.length : 0;
  const ordered = rows.length > 0 ? [...rows.slice(start), ...rows.slice(0, start)] : [];

  return (
    <View style={{ flex: 1, backgroundColor: navy }}>
      <Stack.Screen options={{ headerShown: false, title: 'TV' }} />
      <View style={{ padding: 24, gap: 8, backgroundColor: accent }}>
        <Text style={{ color: navy, fontSize: 18, fontWeight: '800', letterSpacing: 1 }}>{event?.charityName ?? 'LIVE'}</Text>
        <Text style={{ color: navy, fontFamily: display, fontSize: 64, lineHeight: 68 }}>{event?.name ?? code}</Text>
        {title ? <Text style={{ color: navy, fontSize: 22, fontWeight: '800' }}>{`Presented by ${title.name}`}</Text> : null}
        {closest ? <Text style={{ color: navy, fontSize: 18, fontWeight: '700' }}>{closest}</Text> : null}
        {drive ? <Text style={{ color: navy, fontSize: 18, fontWeight: '700' }}>{drive}</Text> : null}
        {logo ? <Image accessibilityLabel={logo.name} source={{ uri: logo.dataUrl }} resizeMode="contain" style={{ height: 64, width: 240 }} /> : null}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 8 }}>
        {ordered.map((row) => (
          <View key={row.key} style={{ minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Text style={{ width: 72, color: white, fontFamily: display, fontSize: 48, lineHeight: 52 }}>{row.rank ?? '–'}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={{ color: white, fontSize: 32, lineHeight: 36, fontWeight: '800' }}>{row.name}</Text>
              <Text style={{ color: white, fontSize: 18 }}>{`${row.waitlist ? 'Waitlist' : row.thru === 0 ? 'Not started' : `Thru ${row.thru}`}${row.mulliganCap > 0 ? ` · Mulligans ${row.mulligansUsed}/${row.mulliganCap}` : ''}`}</Text>
            </View>
            <Text style={{ width: 120, textAlign: 'right', color: row.toPar != null && row.toPar > 0 ? '#C8102E' : row.toPar != null && row.toPar < 0 ? accent : white, fontFamily: display, fontSize: 56, lineHeight: 60 }}>{formatToPar(row.toPar)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
