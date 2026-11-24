import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { font, touch } from '@coopr/tokens';
import { eventRequest, loadSession } from '../../src/events/client';
import { SURVEY_CONSENT, SURVEY_PRIVACY } from '../../src/events/survey';
import type { SurveyEase, SurveyUse } from '../../src/events/types';
import { BigButton, Choice, EventFrame, EventTitle, FieldLabel, ink, inputStyle, Note } from '../../src/events/ui';

/**
 * LEGAL REVIEW: SURVEY_PRIVACY and SURVEY_CONSENT are the golfer-facing copy.
 * Counsel should approve them before the Panthers Classic. Skip stores nothing.
 */
export default function EventSurvey() {
  const session = loadSession();
  const [ease, setEase] = useState<SurveyEase | null>(null);
  const [wouldUse, setWouldUse] = useState<SurveyUse | null>(null);
  const [next, setNext] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!session) {
      router.replace('/recap');
      return;
    }
    const result = await eventRequest(`/v1/events/${encodeURIComponent(session.code)}/survey`, {
      method: 'POST',
      guest: session.token,
      body: { ease, wouldUse, next, email, emailConsent: consent },
    });
    if (result.status !== 200) {
      setError(typeof result.body.error === 'string' ? result.body.error : 'Those answers did not save.');
      return;
    }
    router.replace('/recap');
  };

  return (
    <EventFrame>
      <Stack.Screen options={{ title: 'Three questions' }} />
      <EventTitle>Three questions</EventTitle>
      <Note>{SURVEY_PRIVACY}</Note>
      <FieldLabel>How was scoring today?</FieldLabel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Choice label="Easy" on={ease === 'easy'} onPress={() => setEase('easy')} />
        <Choice label="OK" on={ease === 'ok'} onPress={() => setEase('ok')} />
        <Choice label="Hard" on={ease === 'hard'} onPress={() => setEase('hard')} />
      </View>
      <FieldLabel>Would you use COOPR on your own rounds?</FieldLabel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Choice label="Yes" on={wouldUse === 'yes'} onPress={() => setWouldUse('yes')} />
        <Choice label="Maybe" on={wouldUse === 'maybe'} onPress={() => setWouldUse('maybe')} />
        <Choice label="No" on={wouldUse === 'no'} onPress={() => setWouldUse('no')} />
      </View>
      <FieldLabel>What should we build next?</FieldLabel>
      <TextInput accessibilityLabel="What should we build next" value={next} onChangeText={setNext} style={inputStyle} />
      <FieldLabel>Email, if you want a note</FieldLabel>
      <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={inputStyle} />
      <Pressable accessibilityRole="button" accessibilityLabel={SURVEY_CONSENT} onPress={() => setConsent((value) => !value)} style={{ minHeight: touch, justifyContent: 'center' }}>
        <Text style={{ color: ink.navy, fontFamily: font.family, fontSize: 16, fontWeight: '700' }}>{`${consent ? '✓ ' : ''}${SURVEY_CONSENT}`}</Text>
      </Pressable>
      {error ? <Note>{error}</Note> : null}
      <BigButton label="Send" onPress={() => void send()} />
      <BigButton label="Skip" tone="navy" onPress={() => router.replace('/recap')} />
    </EventFrame>
  );
}
