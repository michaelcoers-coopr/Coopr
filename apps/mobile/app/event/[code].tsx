import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { loadPublicEvent, loadSession, POLL_MS } from '../../src/events/client';
import type { PublicEvent } from '../../src/events/types';
import { BigButton, EventFrame, LeaderboardTable, Note } from '../../src/events/ui';
import { WebBoard } from '../../src/events/web-board';

export default function PublicBoard() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' ? params.code.toUpperCase() : '';
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = loadSession();
  const onWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!code) return;
    let stop = false;
    const tick = async () => {
      const next = await loadPublicEvent(code);
      if (stop) return;
      if (next) {
        setEvent(next);
        setError(null);
      } else setError('The board will refresh when the signal is back.');
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [code]);

  return (
    <EventFrame>
      <Stack.Screen options={{ title: event?.name ?? 'Leaderboard', headerShown: onWeb && event?.accent ? false : undefined }} />
      {event && onWeb && event.accent ? <WebBoard event={event} /> : null}
      {event && !(onWeb && event.accent) ? <LeaderboardTable event={event} /> : null}
      {!event ? <Note>{error ?? 'Loading the board.'}</Note> : null}
      {error && event ? <Note>{error}</Note> : null}
      <BigButton label="Join this event" onPress={() => router.push(`/event/join?code=${code}`)} />
      <BigButton label="TV mode" tone="navy" onPress={() => router.push(`/event/${code}/tv`)} />
      {onWeb ? <BigButton label="Share card" tone="navy" onPress={() => router.push(`/event/${code}/card`)} /> : null}
      {onWeb ? <BigButton label="Get COOPR" tone="lime" onPress={() => router.push('/get')} /> : null}
      {session?.code === code ? <BigButton label="Back to the round" tone="lime" onPress={() => router.push('/play')} /> : null}
      {session?.code === code ? <BigButton label="Three questions" tone="navy" onPress={() => router.push('/event/survey')} /> : null}
      {event?.charityUrl ? (
        // LEGAL REVIEW: outbound link only. COOPR does not collect donations.
        <BigButton label="Charity site" tone="navy" onPress={() => void Linking.openURL(event.charityUrl ?? '')} />
      ) : null}
    </EventFrame>
  );
}
