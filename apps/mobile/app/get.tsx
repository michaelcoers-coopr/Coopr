import { Linking } from 'react-native';
import { router, Stack } from 'expo-router';
import { BigButton, EventFrame, EventTitle, Note } from '../src/events/ui';

const storeUrl = process.env.EXPO_PUBLIC_APP_STORE_URL?.trim();
const storeReady = Boolean(storeUrl && !storeUrl.includes('REPLACE'));

/** The path off the public board. No store link until Mike sets one. */
export default function GetCoopr() {
  return (
    <EventFrame>
      <Stack.Screen options={{ title: 'Get COOPR' }} />
      <EventTitle>Get COOPR</EventTitle>
      <Note>COOPR is the caddie on your phone. The same app that posted today's scores.</Note>
      <BigButton label="Open COOPR" onPress={() => router.push('/')} />
      {storeReady && storeUrl ? <BigButton label="App Store" tone="navy" onPress={() => void Linking.openURL(storeUrl)} /> : <Note>The App Store link is not set yet.</Note>}
    </EventFrame>
  );
}
