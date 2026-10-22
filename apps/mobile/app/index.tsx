import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, TAGLINE, touch } from '@coopr/tokens';
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
        <Crest size={168} />
        <Text style={styles.word}>COOPR</Text>
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
      <Text style={styles.statValue}>{value}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 8 },
  word: { color: colors.navy, fontFamily: font.family, fontSize: 40, fontWeight: '700', letterSpacing: -1, textAlign: 'center' },
  tag: { color: colors.muted, fontFamily: font.family, fontSize: 16, lineHeight: 22, textAlign: 'center', marginBottom: 8 },
  play: {
    backgroundColor: colors.navy,
    borderRadius: radius.card,
    minHeight: 148,
    padding: 24,
    gap: 6,
    justifyContent: 'center',
    shadowColor: colors.navy,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  kicker: { color: 'rgba(255,255,255,0.72)', fontFamily: font.family, fontSize: 13, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  playTitle: { color: colors.white, fontFamily: font.family, fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  playDetail: { color: 'rgba(255,255,255,0.82)', fontFamily: font.family, fontSize: 16 },
  glance: { flexDirection: 'row', gap: 8, marginTop: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 16,
    paddingHorizontal: 10,
    minHeight: touch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statLabel: { color: colors.muted, fontFamily: font.family, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  statValue: { color: colors.navy, fontFamily: font.family, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statNote: { color: colors.muted, fontFamily: font.family, fontSize: 11 },
  more: { minHeight: touch, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  moreText: { color: colors.navy, fontFamily: font.family, fontSize: 17, fontWeight: '700' },
});
