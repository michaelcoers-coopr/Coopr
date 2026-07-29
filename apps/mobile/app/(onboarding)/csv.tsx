import { useState } from 'react';
import { ScrollView, View, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Environment, ClubType } from '@coopr/core';
import { useTheme } from '../../src/theme';
import { Card, H1, H2, Body, Label, Button, Segmented, Divider } from '../../src/ui';
import { getFirstUserId } from '../../src/db/repo';
import { markOnboardingComplete } from '../../src/db/settings';
import { ensureActiveBag, ensureClub, CATEGORY_LABELS } from '../../src/features/bag-writer';
import { saveBaselineSession, type NewShot } from '../../src/features/session-writer';
import { parseSessionCsv, type ParsedCsv } from '../../src/features/import-csv';

function inferType(label: string): ClubType {
  const l = label.toLowerCase();
  if (l.includes('driver')) return 'driver';
  if (l.includes('w')) return 'wood';
  if (l.includes('h')) return 'hybrid';
  if (l.includes('°') || l.includes('wedge') || /\b(48|50|52|54|56|58|60)\b/.test(l)) return 'wedge';
  return 'iron';
}

export default function CsvImport() {
  const t = useTheme();
  const router = useRouter();
  const userId = getFirstUserId();

  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [category, setCategory] = useState('irons');
  const [environment, setEnvironment] = useState<Environment>('simulator');
  const [singleClub, setSingleClub] = useState('7i');
  const [imported, setImported] = useState<number | null>(null);

  const usableRows = parsed?.rows.filter((r) => r.carryYards != null || r.totalYards != null) ?? [];
  const hasClubColumn = parsed?.recognized.clubLabel != null;

  const doParse = () => setParsed(parseSessionCsv(raw));

  const confirmImport = () => {
    if (!userId || !parsed) return;
    const bagId = ensureActiveBag(userId);
    const shots: NewShot[] = [];
    for (const r of usableRows) {
      const label = (hasClubColumn && r.clubLabel ? r.clubLabel : singleClub).trim();
      const clubId = ensureClub(bagId, { label, type: inferType(label) });
      shots.push({
        clubId, clubLabel: label, carryYards: r.carryYards, totalYards: r.totalYards,
        ballSpeedMph: r.ballSpeedMph, clubSpeedMph: r.clubSpeedMph, spinRateRpm: r.spinRateRpm,
        launchAngleDeg: r.launchAngleDeg, source: 'csv',
      });
    }
    if (shots.length === 0) return;
    saveBaselineSession({ userId, category, environment, shots });
    setImported(shots.length);
  };

  const finish = () => {
    markOnboardingComplete();
    router.replace('/assessment');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }} keyboardShouldPersistTaps="handled">
        {imported == null ? (
          <>
            <Label>Import a session</Label>
            <H1>Paste your launch-monitor CSV</H1>
            <Body muted>
              We recognize common columns (carry, total, ball/club speed, spin, launch). Nothing is saved until you
              confirm what we read.
            </Body>

            <Card>
              <TextInput
                value={raw}
                onChangeText={setRaw}
                multiline
                placeholder="Club,Carry,Total,Ball Speed...\n7i,158,166,118..."
                placeholderTextColor={t.textMuted}
                style={{
                  minHeight: 120, color: t.textPrimary, backgroundColor: t.surface, borderColor: t.border,
                  borderWidth: 1, borderRadius: t.radius.sm, padding: t.spacing.md, fontSize: t.fontSize.sm,
                  textAlignVertical: 'top',
                }}
              />
              <Button title="Read CSV" onPress={doParse} />
              <Body muted style={{ fontSize: t.fontSize.xs }}>
                File and screenshot import plug in here next (with the same confirmation step).
              </Body>
            </Card>

            {parsed ? (
              <Card>
                <Label>What we read</Label>
                <Body muted>
                  Recognized: {Object.entries(parsed.recognized).map(([k, v]) => `${k}=${v}`).join(', ') || 'nothing — check headers'}
                </Body>
                <Body style={{ marginTop: t.spacing.sm }}>{usableRows.length} shots with a distance value.</Body>
                <Divider />
                {usableRows.slice(0, 5).map((r, i) => (
                  <Body key={i} muted style={{ fontSize: t.fontSize.xs }}>
                    {(hasClubColumn && r.clubLabel) || '(club below)'} · carry {r.carryYards ?? '—'} · total {r.totalYards ?? '—'}
                  </Body>
                ))}
                {usableRows.length > 5 ? <Body muted style={{ fontSize: t.fontSize.xs }}>…</Body> : null}

                <Divider />
                <Label>Category</Label>
                <Segmented
                  options={Object.keys(CATEGORY_LABELS).map((k) => ({ value: k, label: CATEGORY_LABELS[k] ?? k }))}
                  value={category}
                  onChange={setCategory}
                />
                <Label>Where</Label>
                <Segmented
                  options={[
                    { value: 'simulator', label: 'Simulator' },
                    { value: 'range', label: 'Range' },
                    { value: 'outdoor_launch_monitor', label: 'Outdoor LM' },
                  ]}
                  value={environment}
                  onChange={setEnvironment}
                />
                {!hasClubColumn ? (
                  <>
                    <Label>Club (no club column found)</Label>
                    <TextInput
                      value={singleClub}
                      onChangeText={setSingleClub}
                      placeholder="7i"
                      placeholderTextColor={t.textMuted}
                      style={{
                        color: t.textPrimary, backgroundColor: t.surface, borderColor: t.border, borderWidth: 1,
                        borderRadius: t.radius.sm, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm,
                        fontSize: t.fontSize.md, width: 120, marginVertical: t.spacing.xs,
                      }}
                    />
                  </>
                ) : null}

                <Button title="Confirm & import" onPress={confirmImport} />
              </Card>
            ) : null}
          </>
        ) : (
          <>
            <Label>Imported</Label>
            <H1>{imported} shots added</H1>
            <Body muted>Your profiles and Golf IQ just updated with the confirmed data.</Body>
            <View style={{ height: t.spacing.lg }} />
            <Button title="Import another session" kind="ghost" onPress={() => { setImported(null); setParsed(null); setRaw(''); }} />
            <Button title="Finish & see my Golf IQ" onPress={finish} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
