import { useState } from 'react';
import { Linking, StyleSheet, TextInput } from 'react-native';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { colors } from '@coopr/tokens';
import { feedbackEmail } from '../src/extract-client';
import { FEEDBACK_CATEGORIES, feedbackBody, feedbackMailto, type FeedbackCategory } from '../src/feedback-note';
import { rememberedScreen } from '../src/screen-name';
import { Button, Card, Choice, Muted, Screen, Title } from '../src/ui';

function reported(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  return trimmed || fallback;
}

export default function FeedbackScreen() {
  const [category, setCategory] = useState<FeedbackCategory>('Bug');
  const [note, setNote] = useState('');
  const [contact, setContact] = useState('');
  const [trouble, setTrouble] = useState<string | null>(null);
  const email = feedbackEmail();
  const ios = Constants.platform?.ios;
  const facts = {
    version: reported(Constants.expoConfig?.version ?? Constants.nativeAppVersion, '2.0.0'),
    build: reported(Constants.nativeBuildVersion ?? ios?.buildNumber, 'not reported'),
    model: reported(ios?.model, 'not reported'),
    os: ios?.systemVersion ? `iOS ${ios.systemVersion}` : 'not reported',
    screen: rememberedScreen(),
  };
  const body = feedbackBody({ category, note, contact, facts });

  const send = () => {
    if (!email) return;
    setTrouble(null);
    void Linking.openURL(feedbackMailto(email, body)).catch(() => {
      setTrouble('This phone did not open Mail. The text above is the whole note.');
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Feedback' }} />
      <Title>Send feedback</Title>
      <Muted>Bug, idea, wrong data, or something else. You see the whole note before it opens Mail.</Muted>
      {FEEDBACK_CATEGORIES.map((item) => (
        <Choice key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />
      ))}
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="What happened"
        placeholderTextColor={colors.muted}
        style={styles.note}
        accessibilityLabel="Feedback note"
      />
      <TextInput
        value={contact}
        onChangeText={setContact}
        placeholder="Email or phone, optional"
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel="Optional contact"
        autoCapitalize="none"
      />
      <Card>
        <Muted>This is the note that will be sent. It has no location.</Muted>
        <Muted>{body}</Muted>
      </Card>
      {email ? (
        <Button label="Send this note" onPress={send} />
      ) : (
        <Muted>Feedback email is not set for this build. Nothing will be sent. The note above is what a later build would send.</Muted>
      )}
      {trouble ? <Muted>{trouble}</Muted> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    minHeight: 120,
    color: colors.navy,
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    textAlignVertical: 'top',
  },
  input: {
    minHeight: 52,
    color: colors.navy,
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 18,
  },
});
