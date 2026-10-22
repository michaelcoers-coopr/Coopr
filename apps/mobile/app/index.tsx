import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { TAGLINE } from '@coopr/tokens';
import { Button, Card, Crest, Muted, Screen, Title } from '../src/ui';
import { bootDatabase } from '../src/boot-db';
import { useLocalStore } from '../src/local-store';

export default function HomeScreen() {
  const { founderTools, displayName, caddieName, personalityLabel } = useLocalStore();
  const [dbStatus, setDbStatus] = useState('Opening the on-device course cache…');

  useEffect(() => {
    let cancelled = false;
    bootDatabase()
      .then((status) => {
        if (!cancelled) setDbStatus(status);
      })
      .catch(() => {
        if (!cancelled) setDbStatus('Local database unavailable on this runtime. The round still stays on this device.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen>
      <Crest />
      <Title>COOPR</Title>
      <Muted>{TAGLINE}</Muted>
      <Button label="Play High Cedars" onPress={() => router.push('/play')} />
      <Button label="Game plan" tone="ghost" onPress={() => router.push('/plan')} />
      <Button label="Scorecard" tone="ghost" onPress={() => router.push('/scorecard')} />
      <Button label="Debrief" tone="ghost" onPress={() => router.push('/debrief')} />
      <Button label="Bag" tone="ghost" onPress={() => router.push('/bag')} />
      <Button label="Wedge matrix" tone="ghost" onPress={() => router.push('/wedges')} />
      <Button label="Add from photos" tone="ghost" onPress={() => router.push('/import')} />
      <Button label="Caddie" tone="ghost" onPress={() => router.push('/caddie')} />
      <Button label="Course quality" tone="ghost" onPress={() => router.push('/course')} />
      <Card>
        <Muted>High Cedars, Orting, is the only course on this phone. Greens are not verified, so the big number is the yardage you type until you verify a green.</Muted>
        <Muted>{dbStatus}</Muted>
        {founderTools ? (
          <Muted>{`This phone is signed in as ${displayName}. Caddie ${caddieName}, ${personalityLabel}.`}</Muted>
        ) : (
          <Muted>Public shell. Founder history is not in this build.</Muted>
        )}
      </Card>
      {founderTools ? <Button label="Founder verification" tone="ghost" onPress={() => router.push('/founder')} /> : null}
    </Screen>
  );
}
