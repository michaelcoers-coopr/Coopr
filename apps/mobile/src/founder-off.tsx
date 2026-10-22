import { Muted, Screen, Title } from './ui';

/** Public and store builds resolve the founder routes to this screen. */
export default function FounderToolsOff() {
  return (
    <Screen>
      <Title>Founder verification</Title>
      <Muted>Founder tools are off in this build.</Muted>
    </Screen>
  );
}
