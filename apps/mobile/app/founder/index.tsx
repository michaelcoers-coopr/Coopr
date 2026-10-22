import { router } from 'expo-router';
import { Button, Card, Muted, Screen, Title } from '../../src/ui';

const FLOWS = [
  ['a', 'A · 100 yard wedge'],
  ['b', 'B · 174 yard par 3'],
  ['c', 'C · 41 yard 54° pitch'],
  ['d', 'D · which club to replace'],
  ['bag', 'Founder bag'],
  ['round', 'High Cedars scorecard'],
] as const;

export default function FounderIndex() {
  return (
    <Screen>
      <Title>Founder verification</Title>
      <Card>
        <Muted>Private. This is not a public demo. Founder history stays on this route.</Muted>
      </Card>
      {FLOWS.map(([id, label]) => (
        <Button key={id} label={label} onPress={() => router.push(`/founder/${id}`)} />
      ))}
    </Screen>
  );
}
