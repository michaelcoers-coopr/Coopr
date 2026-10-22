import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { colors } from '@coopr/tokens';
import { orderedLines, scoreRound } from '@coopr/engine';
import { founderFlows, loadFounderDataset } from '@coopr/seed';
import { Card, Lines, Muted, Screen, Title } from '../../src/ui';

const dataset = loadFounderDataset();
const flows = founderFlows(dataset);

export default function FounderDemoScreen() {
  const params = useLocalSearchParams<{ demo: string }>();
  const demo = params.demo;

  if (demo === 'bag') {
    const byClub = new Map<string, string[]>();
    for (const club of dataset.clubs.filter((item) => !item.historicalOnly && item.ownership !== 'not_owned')) {
      const profiles = flows.profiles.filter((profile) => profile.clubId === club.id);
      const lines =
        profiles.length === 0
          ? ['No shot sample. Summary rows are not a stock distance.']
          : profiles.map(
              (profile) =>
                `${profile.metric} median ${profile.stockYards.toFixed(1)} · n=${profile.sampleSize} · ${profile.confidence} · source: founder verbatim, ${profile.environment}`,
            );
      byClub.set(club.label, lines);
    }
    return (
      <Screen>
        <Title>Founder bag</Title>
        <Muted>In-play bag is empty until 14 clubs are chosen. Confidence and source are on each card.</Muted>
        {[...byClub.entries()].map(([label, lines]) => (
          <Card key={label}>
            <Text style={styles.label}>{label}</Text>
            {lines.map((line) => (
              <Muted key={line}>{line}</Muted>
            ))}
          </Card>
        ))}
      </Screen>
    );
  }

  if (demo === 'round') {
    const score = scoreRound(dataset.holeScores.map((hole) => ({ hole: hole.holeNumber, strokes: hole.strokes })));
    return (
      <Screen>
        <Title>High Cedars</Title>
        <Card>
          <Text style={styles.label}>{`${dataset.round.playedOn} · ${dataset.round.teeName} · par ${dataset.round.par}`}</Text>
          <Muted>{`Gross ${score.gross} · Front ${score.front} · Back ${score.back}`}</Muted>
          <Muted>Displayed net 78 is unverified and is not the score.</Muted>
          <Muted>Rating/slope not selected: 69.1/113 or 70.1/115.</Muted>
          <Muted>Handicap: unknown. Not an official GHIN Handicap Index.</Muted>
        </Card>
        {dataset.holeScores.map((hole) => (
          <Muted key={hole.holeNumber}>{`Hole ${hole.holeNumber}: ${hole.strokes}`}</Muted>
        ))}
      </Screen>
    );
  }

  const card = demo === 'a' ? flows.wedge100 : demo === 'b' ? flows.par3Carry174 : demo === 'c' ? flows.pitch41 : null;
  if (card) {
    const title = demo === 'a' ? '100 yard wedge' : demo === 'b' ? '174 yard par 3' : '41 yard pitch';
    return (
      <Screen>
        <Title>{title}</Title>
        <Card>
          <Lines lines={orderedLines(card)} />
        </Card>
        <Muted>{`Posture: ${card.posture}. Aim matches the strategic target. Miss pattern: ${card.mechanicalMissPattern ?? 'none recorded'}.`}</Muted>
      </Screen>
    );
  }

  if (demo === 'd') {
    return (
      <Screen>
        <Title>Which club to replace</Title>
        <Card>
          <Text style={styles.label}>{flows.replace.clubLabel ?? 'No club'}</Text>
          <Muted>{flows.replace.reason}</Muted>
          <Muted>
            {flows.replace.alsoUnreliable.length === 0
              ? 'No other iron is flagged.'
              : `Also unreliable, not a brand list: ${flows.replace.alsoUnreliable.map((item) => item.clubLabel).join(', ')}.`}
          </Muted>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Unknown flow</Title>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
