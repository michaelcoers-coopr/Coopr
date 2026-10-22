import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Muted, Screen, Title } from '../src/ui';
import { bootDatabase } from '../src/boot-db';

export default function HomeScreen() {
  const [dbStatus, setDbStatus] = useState('Opening local database…');

  useEffect(() => {
    let cancelled = false;
    bootDatabase()
      .then((status) => {
        if (!cancelled) setDbStatus(status);
      })
      .catch(() => {
        if (!cancelled) setDbStatus('Local database unavailable on this runtime. Play still uses on-device memory.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen>
      <Title>COOPR</Title>
      <Muted>Know your game. Play your game. Numbers stay measured. The caddie does not invent them.</Muted>
      <Button label="PLAY GOLF" onPress={() => router.push('/scorecard')} />
      <Button label="PRACTICE & CALIBRATE" onPress={() => router.push('/practice')} />
      <Button label="Bag" onPress={() => router.push('/bag')} />
      <Button label="Caddie" onPress={() => router.push('/caddie')} />
      <Card>
        <Muted>{dbStatus}</Muted>
        <Muted>This home screen is the public shell. It does not load founder history.</Muted>
      </Card>
      <Button label="Founder verification (private)" onPress={() => router.push('/founder')} />
    </Screen>
  );
}
