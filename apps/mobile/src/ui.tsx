import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@coopr/tokens';

/** Scrolls the body. A footer stays pinned, so Save and Done remain on a short phone. */
export function Screen({ children, footer = null }: { children: ReactNode; footer?: ReactNode }) {
  const window = useWindowDimensions();
  const landscape = window.width > window.height;
  const [footerHeight, setFooterHeight] = useState(footer ? 72 : 0);
  const scrollMax = Math.max(120, window.height - footerHeight);
  return (
    <SafeAreaView style={[styles.screen, { height: window.height }]} edges={['bottom']}>
      <ScrollView style={[styles.scroll, { maxHeight: scrollMax }]} contentContainerStyle={[styles.content, { paddingBottom: footerHeight + 28 }]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? (
        <View onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)} style={[styles.footer, landscape && styles.footerRow]}>
          {footer}
        </View>
      ) : null}
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
  const window = useWindowDimensions();
  const landscape = window.width > window.height;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.button, landscape && styles.buttonLandscape, tone === 'red' && styles.buttonRed, tone === 'ghost' && styles.buttonGhost]}
    >
      <Text style={[styles.buttonText, tone === 'ghost' && styles.buttonGhostText]}>{label}</Text>
    </Pressable>
  );
}

export function Choice({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={[styles.choice, selected && styles.choiceOn]}>
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

export function Crest({ size = 176 }: { size?: number }) {
  return (
    <Image
      accessibilityLabel="Navy Fill crest"
      source={require('../assets/coopr-crest-navy-fill.jpg')}
      style={{ width: size, height: size, alignSelf: 'center' }}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, height: '100%', flexDirection: 'column', backgroundColor: colors.bg, minHeight: 0 },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: 20, paddingBottom: 24, gap: 14 },
  footer: { flexShrink: 0, paddingHorizontal: 20, paddingBottom: 12, gap: 8, zIndex: 5 },
  footerRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'stretch' },
  title: { color: colors.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.6 },
  muted: { color: colors.muted, fontSize: 17, lineHeight: 24 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 8,
    shadowColor: colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
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
  buttonLandscape: { flexGrow: 1, flexBasis: 0, minWidth: 44, minHeight: 48, paddingVertical: 8, paddingHorizontal: 8 },
  buttonRed: { backgroundColor: colors.red },
  buttonGhost: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navy },
  buttonText: { color: colors.onAccent, fontWeight: '800', fontSize: 18, letterSpacing: 0.2, textAlign: 'center' },
  buttonGhostText: { color: colors.navy },
  choice: {
    minHeight: 56,
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
});
