import type { ComponentRef, Ref } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { dayLine, DISCLOSURE, fmt, type FoursomeSave, type RoundScore } from '@coopr/games';
import { font } from '@coopr/tokens';
import { dayAmount, DOWN_TEXT, stablefordLine, wolfPointsTable } from './present';

/** Navy ground, lime bar, Bebas numerals, and the supplied Navy Fill crest. */
export function RecapCard({
  save,
  score,
  showNets,
  showHandicaps,
  display,
  cardRef,
  accessibilityLabel,
}: {
  save: FoursomeSave
  score: RoundScore
  showNets: boolean
  showHandicaps: boolean
  display: string
  cardRef: Ref<ComponentRef<typeof View>>
  accessibilityLabel: string
}) {
  const names = save.players.map((player) => player.name)
  const stable = score.games.find((game) => game.kind === 'stableford' || game.kind === 'modified')
  const stableLine = stablefordLine(names, stable?.points ?? null)
  const wolf = score.games.find((game) => game.kind === 'wolf')
  const wolfRows = wolf?.points ? wolfPointsTable(names, wolf.points) : []
  const amount = dayAmount(score.nets)
  return (
    <View ref={cardRef} collapsable={false} accessibilityLabel={accessibilityLabel} style={styles.card}>
      <View style={styles.bar} />
      <Image
        accessibilityLabel="Navy Fill crest"
        source={require('../../assets/coopr-crest-navy-fill.jpg')}
        style={styles.crest}
        resizeMode="contain"
      />
      <Text style={[styles.word, { fontFamily: display }]}>COOPR</Text>
      <Text accessibilityLabel="Round winner" style={[styles.hero, { fontFamily: display }]}>{dayLine(names, score.nets)}</Text>
      {amount ? <Text style={[styles.amount, { fontFamily: display }]}>{amount}</Text> : null}
      {stableLine ? <Text style={styles.copy}>{stableLine}</Text> : null}
      {wolfRows.map((row) => (
        <Text key={row} style={[styles.numeral, { fontFamily: display }]}>{`Wolf ${row}`}</Text>
      ))}
      {showNets
        ? save.players.map((player, index) => {
            const net = score.nets[index] ?? 0
            return (
              <Text key={player.id} style={[styles.numeral, { fontFamily: display, color: net < 0 ? DOWN_TEXT : '#FFFFFF' }]}>
                {`${player.name} ${fmt(net, undefined, true)}`}
              </Text>
            )
          })
        : null}
      {showHandicaps
        ? save.players.map((player) =>
            player.courseHandicap == null ? null : (
              <Text key={`${player.id}-hcp`} style={styles.copy}>{`${player.name} handicap ${player.courseHandicap}`}</Text>
            ),
          )
        : null}
      {score.settle.map((line) => (
        <Text key={line.line} style={[styles.numeral, { fontFamily: display }]}>{line.line}</Text>
      ))}
      <Text accessibilityLabel="Birdie Bucks" style={styles.disclosure}>{DISCLOSURE}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0B1F3A', borderRadius: 16, padding: 16, gap: 8, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: '#8AC926', marginHorizontal: -16, marginTop: -16 },
  crest: { width: 72, height: 72, alignSelf: 'center' },
  word: { color: '#FFFFFF', fontSize: 22, letterSpacing: 2, textAlign: 'center' },
  hero: { color: '#FFFFFF', fontSize: 40, lineHeight: 44, textAlign: 'center' },
  amount: { color: '#8AC926', fontSize: 48, lineHeight: 52, textAlign: 'center' },
  numeral: { color: '#FFFFFF', fontSize: 28, lineHeight: 32 },
  copy: { color: '#FFFFFF', fontFamily: font.family, fontSize: 16, lineHeight: 22 },
  disclosure: { color: '#FFFFFF', fontFamily: font.family, fontSize: 13, lineHeight: 18 },
})
