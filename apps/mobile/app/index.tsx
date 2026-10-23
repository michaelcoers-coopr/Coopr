import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, space, TAGLINE, touch, type } from '@coopr/tokens';
import { bagGlance, resumeLine } from '../src/design/home-copy';
import { useLocalStore } from '../src/local-store';
import { Crest } from '../src/ui';

export default function HomeScreen() {
  const { currentHole, score, clubs } = useLocalStore();
  const inPlay = clubs.filter((club) => club.slot === 'in_play').length;
  const resume = resumeLine({
    hole: currentHole,
    holesEntered: score.holesEntered,
    gross: score.holesEntered > 0 ? score.gross : null,
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Crest size={112} />
        <Text style={styles.word}>COOPR</Text>
        <View style={styles.rule} />
        <Text style={styles.tag}>{TAGLINE}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Play High Cedars" onPress={() => router.push('/play')} style={styles.play}>
          <Text style={styles.kicker}>High Cedars</Text>
          <Text style={styles.playTitle}>{resume.title}</Text>
          <Text style={styles.playDetail}>{resume.detail}</Text>
        </Pressable>
        <View style={styles.glance}>
          <Glance label="In the bag" value={bagGlance(inPlay)} />
          <Glance label="Gross" value={score.holesEntered > 0 ? String(score.gross) : '—'} />
          <Glance label="Handicap" value="—" note="Unknown" />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/more')} style={styles.more}>
          <Text style={styles.moreText}>More</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Glance({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statMain}>
        <Text style={styles.statValue}>{value}</Text>
        {note ? <Text style={styles.statNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space[3], paddingBottom: space[4], gap: space[2] },
  word: {
    color: colors.navy,
    fontFamily: font.family,
    fontSize: type.title,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  rule: { alignSelf: 'center', width: 36, height: 3, borderRadius: 2, backgroundColor: colors.red, marginTop: -8 },
  tag: { color: colors.muted, fontFamily: font.family, fontSize: type.body, lineHeight: 24, textAlign: 'center' },
  play: {
    backgroundColor: colors.navy,
    borderRadius: radius.card,
    minHeight: 132,
    padding: space[3],
    gap: 6,
    justifyContent: 'center',
    borderLeftWidth: 4,
    borderLeftColor: colors.red,
    shadowColor: colors.navy,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  kicker: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: font.family,
    fontSize: type.caption,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  playTitle: { color: colors.white, fontFamily: font.family, fontSize: type.title, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  playDetail: { color: 'rgba(255,255,255,0.82)', fontFamily: font.family, fontSize: type.body, lineHeight: 24 },
  glance: { gap: space[1], marginTop: space[1] },
  stat: {
    backgroundColor: colors.white,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: touch,
    paddingHorizontal: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  statLabel: { color: colors.muted, fontFamily: font.family, fontSize: type.body, fontWeight: '600' },
  statMain: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  statValue: { color: colors.navy, fontFamily: font.family, fontSize: type.club, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statNote: { color: colors.muted, fontFamily: font.family, fontSize: type.caption },
  more: { minHeight: touch, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.navy, fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
});
