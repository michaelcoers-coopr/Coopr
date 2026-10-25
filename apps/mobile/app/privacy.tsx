import { Stack } from 'expo-router';
import { Card, Muted, Screen, Title } from '../src/ui';

export default function PrivacyScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Privacy' }} />
      <Title>Privacy</Title>
      <Card warning>
        <Muted>DRAFT for lawyer review. This is not a finished privacy policy.</Muted>
      </Card>
      <Muted>Scores, putts, your bag, and marked shots stay on this phone. There is no account. Deleting the app deletes them. This beta does not sync to a cloud and does not use ads or a tracker.</Muted>
      <Muted>While the app is open, the phone’s location is used to measure distance to the green. That position is not saved as a shot and is not uploaded with your round.</Muted>
      <Muted>A weather request sends the latitude and longitude of your position or the hole to Open-Meteo so the app can show wind and temperature. It is not a saved history of where you walked.</Muted>
      <Muted>Ask listens on this iPhone. Speech is turned into text on the device, and the audio is not kept. If the phone cannot do that, you type the question instead. Nothing in the recording is sent to a server.</Muted>
      <Muted>When a caddie server is set, the question text and the hole context already on screen can be sent there. If no server is set, the answer is labeled Sample and is made on the phone.</Muted>
      <Muted>If you use Add from photos, the picture is sent to a server so numbers can be read. You check every number before it is saved. If no server is set, the photo is not sent.</Muted>
      <Muted>Send feedback opens your mail app only after you see the note. The note has the category, what you typed, an optional contact, the app version and build, the phone model, the system version, and the screen name. It does not add your location.</Muted>
    </Screen>
  );
}