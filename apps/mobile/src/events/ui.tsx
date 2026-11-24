import type { ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, touch } from '@coopr/tokens';
import { useDisplayFace } from '../design/display-font';
import { formatToPar } from './scoring';
import type { BoardRow, Logo, PublicEvent } from './types';

export const ink = {
  bg: '#F7F5F2',
  card: '#FFFFFF',
  navy: '#0B1F3A',
  red: '#C8102E',
  lime: '#8AC926',
  line: '#E4E1DC',
  muted: '#3D4C60',
};

export function EventFrame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: ink.bg }} contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 24, gap: 12 }}>
      {children}
    </ScrollView>
  );
}

export function EventTitle({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function BigButton({ label, onPress, tone = 'red' }: { label: string; onPress: () => void; tone?: 'red' | 'navy' | 'lime' }) {
  const backgroundColor = tone === 'navy' ? ink.navy : tone === 'lime' ? ink.lime : ink.red;
  const color = tone === 'lime' ? ink.navy : '#FFFFFF';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.button, { backgroundColor }]}>
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} style={[styles.choice, on && styles.choiceOn]}>
      <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Note({ children }: { children: string }) {
  return <Text style={styles.note}>{children}</Text>;
}

export function LogoFit({ logo, height = 48 }: { logo: Logo; height?: number }) {
  return <Image accessibilityLabel={logo.name} source={{ uri: logo.dataUrl }} resizeMode="contain" style={{ width: '100%', height, backgroundColor: ink.card }} />;
}

export function LeaderboardTable({ event }: { event: PublicEvent }) {
  const display = useDisplayFace();
  const title = event.logos.find((logo) => logo.slot === 'title') ?? null;
  const board = event.logos.find((logo) => logo.slot === 'leaderboard') ?? null;
  const recap = event.logos.find((logo) => logo.slot === 'recap') ?? null;
  return (
    <View style={styles.card}>
      {title ? <LogoFit logo={title} /> : null}
      <Text style={styles.kicker}>{event.charityName}</Text>
      <Text style={styles.cardTitle}>{event.name}</Text>
      <Text style={styles.note}>{`${event.courseName} · ${event.date} · ${event.format === 'scramble' ? 'Scramble' : 'Stroke play'} · ${event.startStyle === 'shotgun' ? 'Shotgun' : 'Tee times'}`}</Text>
      {board ? <LogoFit logo={board} height={36} /> : null}
      {event.rows.map((row) => (
        <Row key={row.key} row={row} display={display} />
      ))}
      {recap ? <LogoFit logo={recap} height={36} /> : null}
    </View>
  );
}

function Row({ row, display }: { row: BoardRow; display: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rank, { fontFamily: display }]}>{row.rank ?? '–'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{row.name}</Text>
        <Text style={styles.note}>{row.thru === 0 ? 'Not started' : `Thru ${row.thru}`}</Text>
      </View>
      <Text style={[styles.toPar, { fontFamily: display }]}>{formatToPar(row.toPar)}</Text>
    </View>
  );
}

export const inputStyle = {
  minHeight: touch,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: ink.line,
  backgroundColor: ink.card,
  paddingHorizontal: 12,
  color: ink.navy,
  fontFamily: font.family,
  fontSize: 17,
} as const;

const styles = StyleSheet.create({
  title: { color: ink.navy, fontFamily: font.family, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  label: { color: ink.navy, fontFamily: font.family, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  note: { color: ink.muted, fontFamily: font.family, fontSize: 15, lineHeight: 20 },
  button: { minHeight: touch, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontFamily: font.family, fontSize: 17, fontWeight: '800' },
  choice: { minHeight: touch, borderRadius: 14, borderWidth: 1, borderColor: ink.line, backgroundColor: ink.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, flexGrow: 1 },
  choiceOn: { backgroundColor: ink.navy, borderColor: ink.navy },
  choiceText: { color: ink.navy, fontFamily: font.family, fontSize: 16, fontWeight: '700' },
  choiceTextOn: { color: '#FFFFFF' },
  card: { backgroundColor: ink.card, borderRadius: 16, padding: 12, gap: 8 },
  kicker: { color: ink.red, fontFamily: font.family, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  cardTitle: { color: ink.navy, fontFamily: font.family, fontSize: 22, fontWeight: '800' },
  row: { minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: ink.line, paddingTop: 8 },
  rank: { width: 36, color: ink.navy, fontSize: 28, lineHeight: 32 },
  name: { color: ink.navy, fontFamily: font.family, fontSize: 17, fontWeight: '700' },
  toPar: { color: ink.navy, fontSize: 28, lineHeight: 32 },
});
