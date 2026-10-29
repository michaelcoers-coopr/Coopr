import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useDisplayFace } from '../design/display-font';

export const scan = {
  navy: '#0B1F3A',
  white: '#FFFFFF',
  red: '#C8102E',
  lime: '#8AC926',
  muted: '#C5D0DE',
  /** #C8102E on the card is 2.53:1. This rose is 6.6:1 on the same card. */
  warn: '#FF8A9B',
  line: 'rgba(255,255,255,0.18)',
  card: '#102844',
} as const;

export function ScanScreen({ title, children, footer = null, backTo }: { title: string; children: ReactNode; footer?: ReactNode; backTo?: string }) {
  const [footerHeight, setFooterHeight] = useState(0);
  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen
        options={{
          title,
          headerStyle: { backgroundColor: scan.navy },
          headerTintColor: scan.white,
          headerTitleStyle: { fontWeight: '800', color: scan.white },
          contentStyle: { backgroundColor: scan.navy },
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => {
                // backTo names the screen already under this one. Pop. Replacing it would stack another copy.
                if (backTo) router.back();
                else router.back();
              }}
              style={styles.back}
            >
              <Text style={styles.backMark}>‹</Text>
            </Pressable>
          ),
        }}
      />
      <StatusBar style="light" />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: 24 + footerHeight }]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Numeral({ children, size = 56, color = scan.white }: { children: ReactNode; size?: number; color?: string }) {
  const face = useDisplayFace();
  return <Text style={[styles.numeral, { fontFamily: face, fontSize: size, color }]}>{children}</Text>;
}

export function ScanButton({
  label,
  onPress,
  tone = 'lime',
  disabled = false,
  reason = null,
}: {
  label: string;
  onPress: () => void;
  tone?: 'lime' | 'red' | 'ghost';
  disabled?: boolean;
  /** Why the control is off. Shown under a disabled button, in full contrast. */
  reason?: string | null;
}) {
  return (
    <View style={styles.buttonWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityHint={disabled && reason ? reason : undefined}
        disabled={disabled}
        onPress={onPress}
        style={[styles.button, tone === 'red' && styles.red, tone === 'ghost' && styles.ghost, disabled && tone === 'lime' && styles.disabledFill]}
      >
        <Text style={[styles.buttonText, tone === 'ghost' && styles.ghostText, tone === 'lime' && styles.limeText]}>{label}</Text>
      </Pressable>
      {disabled && reason ? <Text style={styles.reason}>{reason}</Text> : null}
    </View>
  );
}

export function ScanChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={scan.muted}
        style={styles.input}
        autoCapitalize="words"
        autoCorrect={false}
      />
    </View>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function SampleChip() {
  return <Text style={styles.sample}>SAMPLE</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, height: '100%', flexDirection: 'column', backgroundColor: scan.navy, minHeight: 0 },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: 20, paddingTop: 28, paddingRight: 20, paddingBottom: 24, gap: 14 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backMark: { color: scan.white, fontSize: 32, lineHeight: 36, fontWeight: '700' },
  numeral: { color: scan.white, fontVariant: ['tabular-nums'], letterSpacing: 0.5 },
  button: {
    backgroundColor: scan.lime,
    borderRadius: 14,
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  red: { backgroundColor: scan.red },
  ghost: { backgroundColor: 'transparent', borderWidth: 2, borderColor: scan.white },
  buttonWrap: { gap: 8 },
  disabledFill: { backgroundColor: '#B7C4A4' },
  reason: { color: scan.white, fontSize: 16, lineHeight: 22 },
  buttonText: { color: scan.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.4, textAlign: 'center' },
  limeText: { color: scan.navy },
  ghostText: { color: scan.white },
  choice: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: scan.white,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: { backgroundColor: scan.lime, borderColor: scan.lime },
  choiceText: { color: scan.white, fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  choiceTextOn: { color: scan.navy },
  field: { gap: 6 },
  fieldLabel: { color: scan.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  input: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: scan.line,
    color: scan.white,
    paddingHorizontal: 14,
    fontSize: 18,
    backgroundColor: scan.card,
  },
  panel: {
    backgroundColor: scan.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: scan.line,
    padding: 14,
    gap: 8,
  },
  body: { color: scan.white, fontSize: 16, lineHeight: 22 },
  sample: {
    alignSelf: 'flex-start',
    backgroundColor: scan.red,
    color: scan.white,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
    borderRadius: 6,
  },
});
