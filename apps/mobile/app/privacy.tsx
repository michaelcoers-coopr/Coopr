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
      <Muted>Scores, putts, penalties, your bag, and marked shots stay on this phone. There is no account. Deleting the app deletes them. This beta does not sync to a cloud and does not use ads or a tracker.</Muted>
      <Muted>A club face photo stays on this phone. This build does not upload it, and it does not read the stamp. Brand and model are what you type.</Muted>
      <Muted>While the app is open, the phone’s location is used to measure distance to the green. That position is not saved as a shot and is not uploaded with your round.</Muted>
      <Muted>A weather request sends the latitude and longitude of the weather point to Open-Meteo for wind and temperature. The elevation call sends the player’s GPS position and the green centre. The phone calls Open-Meteo directly, so that service sees the phone’s IP address. These calls are not a saved history of where you walked.</Muted>
      <Muted>Ask listens on this iPhone. Speech is turned into text on the device, and the audio is not kept. If the phone cannot do that, you type the question instead. The recording is not sent to a server.</Muted>
      <Muted>When a caddie server is set, Ask sends the transcript and a context object. The context includes the bag’s clubs, the selected club, the card line, the distance profiles, the score, the putts, the thru, the persona, prior conversation turns, and the weather numbers, plus the hole and yardages. If that server has an API key and is not in sample mode, it forwards the transcript, the prior turns, and a view of that context to a third-party AI provider. The default address in the server code is OpenAI at https://api.openai.com/v1/chat/completions, model gpt-4o-mini. The distance profiles are in the body the COOPR server receives and are used for its tool calls. The provider prompt includes the clubs and the weather, score, putts, thru, and persona fields, not the raw profile list. If the key is missing or sample mode is on, the server does not call the provider. If no caddie server is set, the phone does not send the turn. In founder mode, with no server, the answer is labeled Sample and is made on the phone.</Muted>
      <Muted>If you use Add from photos and an extract server is set, the picture is sent to that server and is used to read the club details, shots, scores, or distances in the photo. A scorecard photo is read for shots, scores, or distances, not only club details. When the server is in live mode and a vision key is set, it sends the photo on to a third-party AI provider. The default base URL in the extract code is https://api.openai.com/v1, model gpt-4o-mini. If live mode or the key is off, the server returns a sample and does not send the photo to that provider. If no extract server is set, the photo is not sent. You check every number before it is saved. A bag photo you take for the bag stays on this phone. The photo and camera prompts have to say the same thing. This page is still a draft for the lawyer-reviewed privacy policy.</Muted>
      <Muted>Send feedback opens your mail app only after you see the note. The note has the category, what you typed, an optional contact, the app version and build, the phone model, the system version, and the screen name. It does not add your location.</Muted>
    </Screen>
  );
}
