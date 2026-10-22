import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@coopr/tokens';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <View style={[styles.card, warning && styles.cardWarning]}>{children}</View>;
}

export function Button({ label, onPress, tone = 'navy' }: { label: string; onPress: () => void; tone?: 'navy' | 'red' | 'ghost' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.button, tone === 'red' && styles.buttonRed, tone === 'ghost' && styles.buttonGhost]}
    >
      <Text style={[styles.buttonText, tone === 'ghost' && styles.buttonGhostText]}>{label}</Text>
    </Pressable>
  );
}

export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.choice, selected && styles.choiceOn]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <View>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function Crest() {
  return (
    <View accessibilityLabel="Navy Fill crest, stand-in mark" style={styles.crestWrap}>
      <View style={styles.shield}>
        <Text style={styles.crestLetters}>NF</Text>
        <View style={styles.crestBar} />
      </View>
      <Text style={styles.crestName}>Navy Fill</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 36, gap: 14 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.4 },
  muted: { color: colors.muted, fontSize: 18, lineHeight: 26 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardWarning: { borderColor: colors.red },
  button: {
    backgroundColor: colors.navy,
    borderRadius: 14,
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRed: { backgroundColor: colors.red },
  buttonGhost: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navy },
  buttonText: { color: colors.onAccent, fontWeight: '800', fontSize: 18, letterSpacing: 0.2, textAlign: 'center' },
  buttonGhostText: { color: colors.navy },
  choice: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.navy,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: { backgroundColor: colors.navy },
  choiceText: { color: colors.navy, fontSize: 18, fontWeight: '700' },
  choiceTextOn: { color: colors.white },
  line: { color: colors.text, fontSize: 18, lineHeight: 26 },
  crestWrap: { alignItems: 'center', gap: 8, paddingTop: 8 },
  shield: {
    width: 84,
    height: 96,
    backgroundColor: colors.navy,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  crestLetters: { color: colors.white, fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  crestBar: { width: 36, height: 6, backgroundColor: colors.red, borderRadius: 3 },
  crestName: { color: colors.navy, fontSize: 16, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
});
