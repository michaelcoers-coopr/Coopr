import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import type { GeometryVerification, LatLon } from '@coopr/domain';
import { resolveHolePlay } from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { readDevicePosition } from '../../src/device-position';
import { useLocalStore } from '../../src/local-store';
import { Button, Card, Lines, Muted, Screen, Title } from '../../src/ui';

const pilot = loadHighCedarsPilot();

function verificationFor(decision: 'verified' | 'rejected' | undefined): GeometryVerification {
  if (decision === 'verified') return 'admin_verified';
  if (decision === 'rejected') return 'admin_rejected';
  return 'unverified';
}

export default function CourseHole() {
  const params = useLocalSearchParams<{ hole: string }>();
  const holeNumber = Number(params.hole);
  const hole = pilot.quality.find((item) => item.holeNumber === holeNumber);
  const { founderTools, courseReviews, setCourseReview } = useLocalStore();
  const [gpsLine, setGpsLine] = useState<string | null>(null);
  const [player, setPlayer] = useState<LatLon | null>(null);

  if (!founderTools) {
    return (
      <Screen>
        <Title>Course quality</Title>
        <Muted>This screen is not in this build.</Muted>
      </Screen>
    );
  }

  if (!hole) {
    return (
      <Screen>
        <Title>Hole</Title>
        <Muted>That hole is not in the High Cedars 18.</Muted>
      </Screen>
    );
  }

  const green = pilot.features.find((feature) => feature.kind === 'green' && feature.osmId === hole.greenOsmId);
  const decision = courseReviews[hole.holeNumber];
  const verification = verificationFor(decision);
  const play = resolveHolePlay({
    verification,
    player,
    greenRing: green?.rings[0] ?? null,
    manualDistanceYards: null,
    attribution: pilot.attribution,
  });

  return (
    <Screen>
      <Title>{`Hole ${hole.holeNumber}`}</Title>
      <Muted>{`Par ${hole.par ?? '—'}. Stroke index ${hole.strokeIndex ?? '—'}. White tee card ${hole.yardagesByTee.white ?? '—'} yards. That card yardage is OpenGolfAPI metadata, not a GPS measurement.`}</Muted>
      <Card>
        <Lines lines={hole.gaps} />
      </Card>
      <Muted>{play.reason}</Muted>
      {play.mode === 'gps' && play.frontYards != null && play.centerYards != null && play.backYards != null ? (
        <Card>
          <Muted>{`Front ${play.frontYards.toFixed(1)} yd. Center ${play.centerYards.toFixed(1)} yd. Back ${play.backYards.toFixed(1)} yd.`}</Muted>
          <Muted>Ground distance to the verified green. Not a shot. Not a carry. The caddie does not read this number unless you type a manual distance.</Muted>
        </Card>
      ) : (
        <Muted>Score the hole on the scorecard. Ask the caddie with a manual distance. GPS stays off until this green is verified.</Muted>
      )}
      {gpsLine ? <Muted>{gpsLine}</Muted> : null}
      {founderTools ? (
        <>
          <Button
            label="Verify this green"
            onPress={() => {
              setCourseReview(hole.holeNumber, 'verified');
              setGpsLine(null);
              setPlayer(null);
            }}
          />
          <Button
            label="Reject this green"
            onPress={() => {
              setCourseReview(hole.holeNumber, 'rejected');
              setPlayer(null);
              setGpsLine('Rejected. The open polygon stays in the cache and is not used for a distance.');
            }}
          />
        </>
      ) : (
        <Muted>Verifying a green is an admin action and is off in this build.</Muted>
      )}
      {verification === 'admin_verified' ? (
        <Button
          label="Measure from this phone"
          onPress={() => {
            void readDevicePosition().then((position) => {
              if (!position) {
                setPlayer(null);
                setGpsLine('Location is unavailable. Use a manual distance.');
                return;
              }
              setPlayer(position);
              setGpsLine(null);
            });
          }}
        />
      ) : null}
      <Muted>{pilot.attribution}</Muted>
      <Muted>{`${pilot.osmAttribution}. Extract ${pilot.osmTimestamp}.`}</Muted>
    </Screen>
  );
}
