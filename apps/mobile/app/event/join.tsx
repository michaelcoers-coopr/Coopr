import { useEffect, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { TextInput, View } from 'react-native';
import { eventRequest, loadPublicEvent, saveSession, sessionFromJoin } from '../../src/events/client';
import type { PublicEvent } from '../../src/events/types';
import { BigButton, EventFrame, EventTitle, FieldLabel, inputStyle, Note } from '../../src/events/ui';

export default function JoinEvent() {
  const params = useLocalSearchParams<{ code?: string }>();
  const initial = typeof params.code === 'string' ? params.code.toUpperCase() : '';
  const [code, setCode] = useState(initial);
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    let stop = false;
    void loadPublicEvent(initial).then((next) => {
      if (!stop) setEvent(next);
    });
    return () => {
      stop = true;
    };
  }, [initial]);

  const lookup = async () => {
    setError(null);
    const next = await loadPublicEvent(code);
    if (!next) {
      setError('No event with that code.');
      setEvent(null);
      return;
    }
    setEvent(next);
  };

  const enter = async (body: { groupId: string; playerId?: string; name?: string; playerName?: string; teamName?: string }) => {
    const result = await eventRequest(`/v1/events/${encodeURIComponent(event?.code ?? code)}/join`, { method: 'POST', body });
    const session = sessionFromJoin(event?.code ?? code, result.body);
    if (!session) {
      setError(typeof result.body.error === 'string' ? result.body.error : 'Join did not go through.');
      return;
    }
    saveSession(session);
    router.replace('/play');
  };

  return (
    <EventFrame>
      <Stack.Screen options={{ title: 'Join' }} />
      <EventTitle>Join</EventTitle>
      <Note>Your name is enough. No account.</Note>
      <FieldLabel>Code</FieldLabel>
      <TextInput accessibilityLabel="Join code" value={code} onChangeText={(value) => setCode(value.toUpperCase())} autoCapitalize="characters" style={inputStyle} />
      <BigButton label="Find the event" tone="navy" onPress={() => void lookup()} />
      {event ? <Note>{`${event.name} · ${event.charityName}`}</Note> : null}
      {(event?.groups.length ?? 0) > 8 ? event?.groups.map((group) => (
        <BigButton
          key={group.id}
          label={group.nameClaimed ? group.name : `Claim ${group.name}`}
          tone={groupId === group.id ? 'lime' : group.waitlist ? 'navy' : 'red'}
          onPress={() => setGroupId(group.id)}
        />
      )) : event?.groups.map((group) => (
        <View key={group.id} style={{ gap: 8 }}>
          <FieldLabel>{group.name}</FieldLabel>
          {group.players.map((player) => (
            <BigButton
              key={player.id}
              label={player.claimed || player.role !== 'scorer' ? `Watch as ${player.name}` : `Join as ${player.name}`}
              tone={player.role === 'scorer' && !player.claimed ? 'red' : 'navy'}
              onPress={() => void enter({ groupId: group.id, playerId: player.id })}
            />
          ))}
        </View>
      ))}
      {(event?.groups.length ?? 0) > 8 && groupId ? (
        <View style={{ gap: 8 }}>
          {!event?.groups.find((group) => group.id === groupId)?.nameClaimed ? (
            <TextInput accessibilityLabel="Team name" value={teamName} onChangeText={setTeamName} placeholder="Team name" placeholderTextColor="#3D4C60" style={inputStyle} />
          ) : null}
          <TextInput accessibilityLabel="Your name" value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#3D4C60" style={inputStyle} />
          {event?.groups.find((group) => group.id === groupId)?.players.map((player) => (
            <BigButton
              key={player.id}
              label={player.role === 'scorer' && !player.claimed ? 'Be the scorer' : player.claimed ? `Watch as ${player.name}` : `Join as ${player.name === 'Open' ? 'a player' : player.name}`}
              tone={player.role === 'scorer' && !player.claimed ? 'red' : 'navy'}
              onPress={() => void enter({
                groupId,
                playerId: player.id,
                playerName: name || undefined,
                teamName: player.role === 'scorer' ? teamName || undefined : undefined,
              })}
            />
          ))}
        </View>
      ) : null}
      {event && event.groups.length <= 8 ? (
        <View style={{ gap: 8 }}>
          <FieldLabel>Not on the list</FieldLabel>
          <TextInput accessibilityLabel="Your name" value={name} onChangeText={setName} style={inputStyle} />
          {event.groups.map((group) => (
            <BigButton key={`pick-${group.id}`} label={group.name} tone={groupId === group.id ? 'lime' : 'navy'} onPress={() => setGroupId(group.id)} />
          ))}
          <BigButton label="Join and play" onPress={() => {
            if (!groupId) {
              setError('Pick a group.');
              return;
            }
            void enter({ groupId, name });
          }} />
        </View>
      ) : null}
      {error ? <Note>{error}</Note> : null}
    </EventFrame>
  );
}
