import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { font, touch } from '@coopr/tokens';
import { eventRequest, saveOrganizerToken } from '../../src/events/client';
import type { EventFormat, GuestRole, StartStyle } from '../../src/events/types';
import { BigButton, Choice, EventFrame, EventTitle, FieldLabel, ink, inputStyle, Note } from '../../src/events/ui';

interface DraftPlayer {
  name: string;
  role: GuestRole;
}

interface DraftGroup {
  name: string;
  players: DraftPlayer[];
}

const today = () => new Date().toISOString().slice(0, 10);

export default function NewEvent() {
  const [name, setName] = useState('');
  const [charityName, setCharityName] = useState('');
  const [charityUrl, setCharityUrl] = useState('');
  const [date, setDate] = useState(today());
  const [format, setFormat] = useState<EventFormat>('scramble');
  const [startStyle, setStartStyle] = useState<StartStyle>('shotgun');
  const [groups, setGroups] = useState<DraftGroup[]>([{ name: 'Group 1', players: [{ name: '', role: 'scorer' }] }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    const result = await eventRequest('/v1/events', {
      method: 'POST',
      body: {
        name,
        charityName,
        charityUrl: charityUrl.trim() || null,
        date,
        format,
        startStyle,
        groups,
      },
    });
    setBusy(false);
    const event = result.body.event as { code?: string } | undefined;
    const token = result.body.organizerToken;
    if (result.status !== 201 || !event?.code || typeof token !== 'string') {
      setError(typeof result.body.error === 'string' ? result.body.error : 'The event did not save.');
      return;
    }
    saveOrganizerToken(event.code, token);
    router.replace(`/event/manage?code=${event.code}`);
  };

  return (
    <EventFrame>
      <Stack.Screen options={{ title: 'New event' }} />
      <EventTitle>New event</EventTitle>
      <Note>High Cedars. One scorer posts for each group.</Note>
      <FieldLabel>Event name</FieldLabel>
      <TextInput accessibilityLabel="Event name" value={name} onChangeText={setName} style={inputStyle} />
      <FieldLabel>Charity</FieldLabel>
      <TextInput accessibilityLabel="Charity name" value={charityName} onChangeText={setCharityName} style={inputStyle} />
      <FieldLabel>Date</FieldLabel>
      <TextInput accessibilityLabel="Event date" value={date} onChangeText={setDate} autoCapitalize="none" style={inputStyle} />
      <FieldLabel>Format</FieldLabel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Choice label="Scramble" on={format === 'scramble'} onPress={() => setFormat('scramble')} />
        <Choice label="Stroke play" on={format === 'stroke'} onPress={() => setFormat('stroke')} />
      </View>
      <FieldLabel>Start</FieldLabel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Choice label="Shotgun" on={startStyle === 'shotgun'} onPress={() => setStartStyle('shotgun')} />
        <Choice label="Tee times" on={startStyle === 'tee-times'} onPress={() => setStartStyle('tee-times')} />
      </View>
      <FieldLabel>Charity link</FieldLabel>
      {/* LEGAL REVIEW: outbound link only. COOPR does not collect donations. */}
      <TextInput accessibilityLabel="Charity link" value={charityUrl} onChangeText={setCharityUrl} autoCapitalize="none" autoCorrect={false} placeholder="https://" placeholderTextColor={ink.muted} style={inputStyle} />
      <Note>LEGAL REVIEW: this link leaves COOPR. We do not take donations here.</Note>
      {groups.map((group, groupIndex) => (
        <View key={groupIndex} style={{ gap: 8 }}>
          <FieldLabel>{`Group ${groupIndex + 1}`}</FieldLabel>
          <TextInput
            accessibilityLabel={`Group ${groupIndex + 1} name`}
            value={group.name}
            onChangeText={(value) => setGroups((current) => current.map((item, index) => index === groupIndex ? { ...item, name: value } : item))}
            style={inputStyle}
          />
          {group.players.map((player, playerIndex) => (
            <TextInput
              key={playerIndex}
              accessibilityLabel={player.role === 'scorer' ? `Scorer in group ${groupIndex + 1}` : `Player in group ${groupIndex + 1}`}
              value={player.name}
              placeholder={player.role === 'scorer' ? 'Scorer' : 'Watching'}
              placeholderTextColor={ink.muted}
              onChangeText={(value) => setGroups((current) => current.map((item, index) => {
                if (index !== groupIndex) return item;
                return { ...item, players: item.players.map((entry, entryIndex) => entryIndex === playerIndex ? { ...entry, name: value } : entry) };
              }))}
              style={inputStyle}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add a player to group ${groupIndex + 1}`}
            onPress={() => setGroups((current) => current.map((item, index) => index === groupIndex ? { ...item, players: [...item.players, { name: '', role: 'viewer' }] } : item))}
            style={{ minHeight: touch, justifyContent: 'center' }}
          >
            <Text style={{ color: ink.navy, fontFamily: font.family, fontWeight: '700' }}>Add a player</Text>
          </Pressable>
        </View>
      ))}
      <BigButton
        label="Add a group"
        tone="navy"
        onPress={() => setGroups((current) => [...current, { name: `Group ${current.length + 1}`, players: [{ name: '', role: 'scorer' }] }])}
      />
      {error ? <Note>{error}</Note> : null}
      <BigButton label={busy ? 'Saving' : 'Create event'} onPress={() => void create()} />
    </EventFrame>
  );
}
