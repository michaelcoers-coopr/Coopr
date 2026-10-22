import { router } from 'expo-router';
import { TAGLINE } from '@coopr/tokens';
import { Button, Crest, Muted, Screen, Title } from '../src/ui';

export default function HomeScreen() {
  return (
    <Screen>
      <Crest />
      <Title>COOPR</Title>
      <Muted>{TAGLINE}</Muted>
      <Button label="Play High Cedars" onPress={() => router.push('/play')} />
      <Button label="More" tone="ghost" onPress={() => router.push('/more')} />
    </Screen>
  );
}
