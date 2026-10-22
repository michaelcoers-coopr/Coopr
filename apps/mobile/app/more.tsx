import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Muted, Screen, Title } from '../src/ui';
import { bootDatabase } from '../src/boot-db';
import { useLocalStore } from '../src/local-store';

export default function MoreScreen() {
  const { founderTools, displayName, caddieName, personalityLabel, startNewRound, unit, setUnit, conditions, setConditions } = useLocalStore();
  const [armed, setArmed] = useState(false);
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
      <Title>More</Title>
      <Muted>Setup and the card. The round starts from Play.</Muted>
      <Button label="Game plan" tone="ghost" onPress={() => router.push('/plan')} />
      <Button label="Scorecard" tone="ghost" onPress={() => router.push('/scorecard')} />
      <Button label="Debrief" tone="ghost" onPress={() => router.push('/debrief')} />
      <Button label="Bag" tone="ghost" onPress={() => router.push('/bag')} />
      <Button label="Wedge matrix" tone="ghost" onPress={() => router.push('/wedges')} />
      <Button label="Add from photos" tone="ghost" onPress={() => router.push('/import')} />
      <Button label="Caddie" tone="ghost" onPress={() => router.push('/caddie')} />
      <Button label="Course quality" tone="ghost" onPress={() => router.push('/course')} />
      <Button
        label={conditions.usePlaysLike ? 'Plays-like is on' : 'Plays-like is off'}
        tone="ghost"
        onPress={() => setConditions({ usePlaysLike: !conditions.usePlaysLike })}
      />
      <Button label={unit === 'yd' ? 'Showing yards' : 'Showing meters'} tone="ghost" onPress={() => setUnit(unit === 'yd' ? 'm' : 'yd')} />
      <Card>
        <Muted>High Cedars, Orting, is the only course on this phone. The hole uses the phone position. Wind and temperature come from the course, and plays-like can be switched off here.</Muted>
        <Muted>{dbStatus}</Muted>
        {founderTools ? <Muted>{`${displayName}. Caddie ${caddieName}, ${personalityLabel}.`}</Muted> : <Muted>Public shell.</Muted>}
      </Card>
      {founderTools ? <Button label="Founder verification" tone="ghost" onPress={() => router.push('/founder')} /> : null}
      <Button
        label={armed ? 'Clear scores' : 'New round'}
        tone="ghost"
        onPress={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          startNewRound();
          setArmed(false);
          router.push('/play');
        }}
      />
      {armed ? <Muted>Tap clear scores to wipe the strokes, the putts, the hole, and the marked shots. Wedge carries stay.</Muted> : null}
    </Screen>
  );
}
