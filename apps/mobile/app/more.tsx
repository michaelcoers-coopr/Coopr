import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors } from '@coopr/tokens';
import { Button, Card, Choice, Muted, Screen, Title } from '../src/ui';
import { bootDatabase } from '../src/boot-db';
import { useLocalStore } from '../src/local-store';
import { useTalkPrefs } from '../src/talk-prefs';
import { AERIAL_CREDIT } from '../src/aerial/project';
import { DISCLOSURE } from '@coopr/games';
import { AI_ATTRIBUTION } from '../src/bag-scan/copy';

export default function MoreScreen() {
  const { founderTools, displayName, caddieName, personalityLabel, voice, setVoice, startNewRound, unit, setUnit, conditions, setConditions } = useLocalStore();
  const talk = useTalkPrefs();
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
      <Stack.Screen options={{ headerShown: false, title: 'More' }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Title>More</Title>
      <Muted>The round starts from the course. One filled button. The rest are grouped.</Muted>
      <Text style={styles.group}>Round</Text>
      <Button label="Past rounds" onPress={() => router.push('/rounds')} />
      <Button label="Setup" tone="ghost" onPress={() => router.push('/setup')} />
      <Button label="Scorecard" tone="ghost" onPress={() => router.push('/scorecard')} />
      <Button label="Analysis" tone="ghost" onPress={() => router.push('/analysis')} />
      <Button label="Debrief" tone="ghost" onPress={() => router.push('/debrief')} />
      <Button label="Game plan" tone="ghost" onPress={() => router.push('/plan')} />
      <Text style={styles.group}>Practice</Text>
      <Button label="Bag" tone="ghost" onPress={() => router.push('/bag')} />
      <Button label="Wedge matrix" tone="ghost" onPress={() => router.push('/wedges')} />
      <Button label="Add from photos" tone="ghost" onPress={() => router.push('/import')} />
      <Text style={styles.group}>Caddie</Text>
      <Button label="Caddie" tone="ghost" onPress={() => router.push('/caddie')} />
      <Card>
        <Muted>Caddie voice. Chirpy is the default. Chill keeps the quieter line. Both use the numbers you actually have.</Muted>
        <Choice label="Chirpy" selected={voice === 'chirpy'} onPress={() => setVoice('chirpy')} />
        <Choice label="Chill" selected={voice === 'chill'} onPress={() => setVoice('chill')} />
      </Card>
      <Card>
        <Muted>Hands-free keeps listening after the caddie finishes. Callouts speak one short line at a new tee, or within 30 yards of the last mark. Both stay off until you turn them on, and both use only numbers you already have.</Muted>
        <Choice label={talk.handsFree ? 'Hands-free is on' : 'Hands-free is off'} selected={talk.handsFree} onPress={() => talk.setHandsFree(!talk.handsFree)} />
        <Choice label={talk.callouts ? 'Callouts are on' : 'Callouts are off'} selected={talk.callouts} onPress={() => talk.setCallouts(!talk.callouts)} />
      </Card>
      {founderTools ? <Button label="Course quality" tone="ghost" onPress={() => router.push('/course')} /> : null}
      <Button
        label={conditions.usePlaysLike ? 'Plays-like is on' : 'Plays-like is off'}
        tone="ghost"
        onPress={() => setConditions({ usePlaysLike: !conditions.usePlaysLike })}
      />
      <Button label={unit === 'yd' ? 'Showing yards' : 'Showing meters'} tone="ghost" onPress={() => setUnit(unit === 'yd' ? 'm' : 'yd')} />
      <Text style={styles.group}>About</Text>
      <Card>
        <Muted>{DISCLOSURE}</Muted>
        <Muted>High Cedars, Orting, is the only course on this phone. The hole uses the phone position. Wind and temperature come from the course, and plays-like can be switched off here.</Muted>
        <Muted>{AERIAL_CREDIT}</Muted>
        <Muted>Every hole uses a stylized 2023 aerial. It is not a true-colour photo and not current conditions. Sample numbers stay labeled Sample.</Muted>
        <Muted>{AI_ATTRIBUTION}</Muted>
        <Muted>{dbStatus}</Muted>
        {founderTools ? <Muted>{`${displayName}. Caddie ${caddieName}, ${personalityLabel}.`}</Muted> : <Muted>Public shell.</Muted>}
      </Card>
      <Button label="Send feedback" tone="ghost" onPress={() => router.push('/feedback')} />
      <Button label="Privacy" tone="ghost" onPress={() => router.push('/privacy')} />
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
      {armed ? <Muted>Tap clear scores to wipe the strokes, the putts, the penalties, the hole, and the marked shots. Finished rounds stay in Analysis. Wedge carries stay.</Muted> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minWidth: 44, minHeight: 44, justifyContent: 'center', paddingRight: 12 },
  backText: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  group: { color: colors.navy, fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 8 },
});
