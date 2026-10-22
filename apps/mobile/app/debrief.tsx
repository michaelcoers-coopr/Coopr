import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '@coopr/tokens';
import { debriefNote, debriefTarget } from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { useLocalStore } from '../src/local-store';
import { Card, Choice, Muted, Screen, Title } from '../src/ui';

const pilot = loadHighCedarsPilot();

export default function DebriefScreen() {
  const { holes, score, debriefs, setDebrief } = useLocalStore();
  const [grossAtOpen] = useState(score.gross);
  const target = debriefTarget(
    pilot.record.scorecard.map((hole) => ({
      hole: hole.holeNumber,
      strokes: holes[hole.holeNumber - 1] ?? null,
      par: hole.par,
    })),
  );

  return (
    <Screen>
      <Title>Debrief</Title>
      <Muted>One question. About a minute. The gross on the card does not move.</Muted>
      <Card>
        <Text style={styles.gross}>{score.holesEntered === 0 ? 'No strokes entered' : `Gross ${score.gross}`}</Text>
        <Muted>{`Gross when this screen opened: ${score.holesEntered === 0 ? 'no strokes' : grossAtOpen}.`}</Muted>
      </Card>
      {target == null ? (
        <Card>
          <Muted>No hole is over par. A blank hole is not treated as zero, and a number is not invented.</Muted>
        </Card>
      ) : (
        <Card>
          <Text style={styles.question}>{`Hole ${target.hole} was ${target.over} over par (${target.strokes} on a par ${target.par}). Was that the plan or the swing?`}</Text>
          <Choice
            label="The plan"
            selected={debriefs.some((item) => item.choice === 'plan' && item.hole === target.hole)}
            onPress={() => setDebrief({ hole: target.hole, choice: 'plan', note: debriefNote('plan', target) })}
          />
          <Choice
            label="The swing"
            selected={debriefs.some((item) => item.choice === 'swing' && item.hole === target.hole)}
            onPress={() => setDebrief({ hole: target.hole, choice: 'swing', note: debriefNote('swing', target) })}
          />
        </Card>
      )}
      {debriefs.map((item) => (
        <Card key={item.hole}>
          <Muted>{item.note}</Muted>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gross: { color: colors.navy, fontSize: 36, fontWeight: '800' },
  question: { color: colors.navy, fontSize: 22, fontWeight: '800', lineHeight: 30 },
});
