import { router } from 'expo-router';
import { loadHighCedarsPilot } from '@coopr/course';
import { Button, Card, Muted, Screen, Title } from '../../src/ui';

const pilot = loadHighCedarsPilot();

export default function CourseIndex() {
  const withGreen = pilot.quality.filter((hole) => hole.greenPolygons === 1).length;
  const derivable = pilot.quality.filter((hole) => hole.frontCenterBackDerivable).length;
  return (
    <Screen>
      <Title>High Cedars</Title>
      <Muted>Orting, Washington. 18 holes. Open data only. Nothing on this list is admin-verified, so play still uses a manual distance.</Muted>
      <Card>
        <Muted>{`${withGreen} of 18 holes have one green polygon on the end of the mapped hole line. Front, center, and back are derivable on ${derivable}. Bunkers and hazards are not tagged to a hole.`}</Muted>
        <Muted>{pilot.attribution}</Muted>
        <Muted>{`${pilot.osmAttribution}. OpenStreetMap extract ${pilot.osmTimestamp}.`}</Muted>
      </Card>
      {pilot.quality.map((hole) => (
        <Button
          key={hole.holeNumber}
          label={`${hole.holeNumber}. Par ${hole.par ?? '—'} · ${hole.greenPolygons === 1 ? 'green polygon' : 'no green'} · ${hole.verification}`}
          onPress={() => router.push(`/course/${hole.holeNumber}`)}
        />
      ))}
    </Screen>
  );
}
