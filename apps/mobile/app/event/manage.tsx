import { useCallback, useEffect, useState } from 'react';
import { Share, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { eventRequest, joinLink, loadOrganizerToken, loadPublicEvent } from '../../src/events/client';
import { pickLogoFile } from '../../src/events/pick-logo';
import { JoinQr } from '../../src/events/qr';
import type { PublicEvent } from '../../src/events/types';
import { BigButton, EventFrame, EventTitle, FieldLabel, ink, inputStyle, LeaderboardTable, LogoFit, Note } from '../../src/events/ui';

export default function ManageEvent() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' ? params.code.toUpperCase() : '';
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [sponsor, setSponsor] = useState('Sample Sponsor');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [hole, setHole] = useState('1');
  const [strokes, setStrokes] = useState('4');
  const [error, setError] = useState<string | null>(null);
  const token = code ? loadOrganizerToken(code) : null;
  const link = code ? joinLink(code) : '';

  const refresh = useCallback(async () => {
    if (!code) return;
    const next = await loadPublicEvent(code);
    setEvent(next);
    const first = next?.groups[0];
    if (first && !groupId) {
      setGroupId(first.id);
      setPlayerId(first.players[0]?.id ?? null);
    }
  }, [code, groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const assign = async (id: string, slot: string, holeNumber: number | null) => {
    const result = await eventRequest(`/v1/events/${encodeURIComponent(code)}/logos`, {
      method: 'PATCH',
      token,
      body: { id, slot, hole: holeNumber },
    });
    if (result.status !== 200) setError(typeof result.body.error === 'string' ? result.body.error : 'The logo did not move.');
    await refresh();
  };

  const upload = async () => {
    const file = await pickLogoFile();
    if (!file) return;
    const result = await eventRequest(`/v1/events/${encodeURIComponent(code)}/logos`, {
      method: 'POST',
      token,
      body: { name: sponsor.trim() || file.name, dataUrl: file.dataUrl },
    });
    if (result.status !== 201) setError(typeof result.body.error === 'string' ? result.body.error : 'The logo did not save.');
    await refresh();
  };

  const postScore = async () => {
    const group = event?.groups.find((item) => item.id === groupId);
    const player = group?.players.find((item) => item.id === playerId) ?? group?.players[0];
    if (!group || !player) return;
    const result = await eventRequest(`/v1/events/${encodeURIComponent(code)}/score`, {
      method: 'POST',
      token,
      body: {
        groupId: group.id,
        playerId: player.id,
        hole: Number(hole),
        strokes: Number(strokes),
        clientSeq: Date.now(),
        idempotencyKey: `org-${code}-${group.id}-${player.id}-${hole}-${Date.now()}`,
      },
    });
    if (result.status !== 200) setError(typeof result.body.error === 'string' ? result.body.error : 'The score did not save.');
    await refresh();
  };

  return (
    <EventFrame>
      <Stack.Screen options={{ title: 'Your event' }} />
      <EventTitle>{event?.name ?? 'Your event'}</EventTitle>
      <Text accessibilityLabel={`Join code ${code}`} style={{ color: ink.navy, fontSize: 56, lineHeight: 64, fontWeight: '800', letterSpacing: 2 }}>{code}</Text>
      {link ? <JoinQr value={link} size={180} /> : null}
      <Note>{link}</Note>
      <BigButton
        label="Share the join link"
        onPress={() => void Share.share({ message: `${event?.name ?? 'Live event'}\n${link}\nCode ${code}` })}
      />
      <BigButton label="Open the board" tone="navy" onPress={() => router.push(`/event/${code}`)} />
      <BigButton label="TV mode" tone="lime" onPress={() => router.push(`/event/${code}/tv`)} />
      {event ? <LeaderboardTable event={event} /> : null}
      <FieldLabel>Sponsor logos</FieldLabel>
      <Note>PNG, JPG, or SVG. 512 KB. The mark fits inside its frame. No full-screen ads.</Note>
      <TextInput accessibilityLabel="Sponsor name" value={sponsor} onChangeText={setSponsor} style={inputStyle} />
      <BigButton label="Upload a logo" tone="navy" onPress={() => void upload()} />
      {event?.logos.map((logo) => (
        <View key={logo.id} style={{ gap: 8 }}>
          <LogoFit logo={logo} />
          <Note>{`${logo.name} · ${logo.slot === 'hole' ? `Hole ${logo.hole}` : logo.slot}`}</Note>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <BigButton label="Title" tone="navy" onPress={() => void assign(logo.id, 'title', null)} />
            <BigButton label="Leaderboard" tone="navy" onPress={() => void assign(logo.id, 'leaderboard', null)} />
            <BigButton label="Share card" tone="navy" onPress={() => void assign(logo.id, 'recap', null)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: 18 }, (_, index) => (
              <BigButton key={index + 1} label={`Hole ${index + 1}`} tone={logo.slot === 'hole' && logo.hole === index + 1 ? 'lime' : 'navy'} onPress={() => void assign(logo.id, 'hole', index + 1)} />
            ))}
          </View>
        </View>
      ))}
      <FieldLabel>Fix a score</FieldLabel>
      {event?.groups.map((group) => (
        <BigButton key={group.id} label={group.name} tone={groupId === group.id ? 'lime' : 'navy'} onPress={() => { setGroupId(group.id); setPlayerId(group.players[0]?.id ?? null); }} />
      ))}
      {event?.format === 'stroke' ? event.groups.find((group) => group.id === groupId)?.players.map((player) => (
        <BigButton key={player.id} label={player.name} tone={playerId === player.id ? 'lime' : 'navy'} onPress={() => setPlayerId(player.id)} />
      )) : null}
      <TextInput accessibilityLabel="Hole number" value={hole} onChangeText={setHole} keyboardType="number-pad" style={inputStyle} />
      <TextInput accessibilityLabel="Strokes" value={strokes} onChangeText={setStrokes} keyboardType="number-pad" style={inputStyle} />
      <BigButton label="Save score" onPress={() => void postScore()} />
      {error ? <Note>{error}</Note> : null}
    </EventFrame>
  );
}
