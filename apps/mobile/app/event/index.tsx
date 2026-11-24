import { router, Stack } from 'expo-router';
import { BigButton, EventFrame, EventTitle, Note } from '../../src/events/ui';

export default function EventHome() {
  return (
    <EventFrame>
      <Stack.Screen options={{ title: 'Live event' }} />
      <EventTitle>Live event</EventTitle>
      <Note>A charity day. Golfers join with a code. No account.</Note>
      <BigButton label="Create an event" onPress={() => router.push('/event/new')} />
      <BigButton label="Join with a code" tone="navy" onPress={() => router.push('/event/join')} />
      <BigButton label="Open the sample" tone="lime" onPress={() => router.push('/event/SAMPLE')} />
    </EventFrame>
  );
}
