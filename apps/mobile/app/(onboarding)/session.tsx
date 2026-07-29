import { useState } from 'react';
import { ScrollView, View, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Environment } from '@coopr/core';
import { useTheme } from '../../src/theme';
import { Card, H1, H2, Body, Label, Button, Segmented, Divider } from '../../src/ui';
import { getFirstUserId } from '../../src/db/repo';
import { markOnboardingComplete } from '../../src/db/settings';
import { ensureActiveBag, ensureClub, DEFAULT_CLUBS, CATEGORY_LABELS } from '../../src/features/bag-writer';
import { saveBaselineSession, type NewShot } from '../../src/features/session-writer';

type Step = 'pick' | 'walk' | 'saved';

export default function ManualSession() {
  const t = useTheme();
  const router = useRouter();
  const userId = getFirstUserId();

  const [step, setStep] = useState<Step>('pick');
  const [category, setCategory] = useState<string>('irons');
  const [environment, setEnvironment] = useState<Environment>('range');
  const [clubIndex, setClubIndex] = useState(0);
  const [shotsByClub, setShotsByClub] = useState<Record<string, number[]>>({});
  const [input, setInput] = useState('');
  const [savedInfo, setSavedInfo] = useState<{ shots: number; clubs: number } | null>(null);

  const clubs = DEFAULT_CLUBS[category] ?? [];
  const current = clubs[clubIndex];

  const addShot = () => {
    if (!current) return;
    const n = Number.parseFloat(input);
    if (!Number.isFinite(n)) return;
    setShotsByClub((prev) => ({ ...prev, [current.label]: [...(prev[current.label] ?? []), n] }));
    setInput('');
  };

  const removeShot = (label: string, i: number) => {
    setShotsByClub((prev) => ({ ...prev, [label]: (prev[label] ?? []).filter((_, idx) => idx !== i) }));
  };

  const save = () => {
    if (!userId) return;
    const bagId = ensureActiveBag(userId);
    const shots: NewShot[] = [];
    let clubCount = 0;
    for (const c of clubs) {
      const carries = shotsByClub[c.label] ?? [];
      if (carries.length === 0) continue;
      clubCount++;
      const clubId = ensureClub(bagId, { label: c.label, type: c.type, loftDeg: c.loftDeg ?? null });
      for (const carry of carries) {
        shots.push({ clubId, clubLabel: c.label, loftDeg: c.loftDeg ?? null, carryYards: carry, source: 'manual' });
      }
    }
    if (shots.length === 0) return;
    saveBaselineSession({ userId, category, environment, shots });
    setSavedInfo({ shots: shots.length, clubs: clubCount });
    setStep('saved');
  };

  const restartForAnotherCategory = () => {
    setShotsByClub({});
    setClubIndex(0);
    setSavedInfo(null);
    setStep('pick');
  };

  const finish = () => {
    markOnboardingComplete();
    router.replace('/assessment');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }} keyboardShouldPersistTaps="handled">
        {step === 'pick' ? (
          <>
            <Label>New baseline session</Label>
            <H1>What are you hitting?</H1>
            <Body muted>Keep categories separate — pick one group for this session.</Body>
            <Card>
              <Label>Category</Label>
              <Segmented
                options={Object.keys(DEFAULT_CLUBS).map((k) => ({ value: k, label: CATEGORY_LABELS[k] ?? k }))}
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
            </Card>
            <Button title="Start" onPress={() => { setClubIndex(0); setStep('walk'); }} />
          </>
        ) : null}

        {step === 'walk' && current ? (
          <>
            <Label>
              {CATEGORY_LABELS[category]} · club {clubIndex + 1} of {clubs.length}
            </Label>
            <H1>{current.label}</H1>
            <Body muted>Aim for ~10 shots. Enter carry in yards. Mishits count — log them too.</Body>

            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  keyboardType="number-pad"
                  placeholder="carry yд"
                  placeholderTextColor={t.textMuted}
                  onSubmitEditing={addShot}
                  style={{
                    width: 120, color: t.textPrimary, backgroundColor: t.surface, borderColor: t.border,
                    borderWidth: 1, borderRadius: t.radius.sm, paddingHorizontal: t.spacing.md,
                    paddingVertical: t.spacing.sm, fontSize: t.fontSize.md,
                  }}
                />
                <Button title="Add" onPress={addShot} />
              </View>

              <Divider />
              <Label>{(shotsByClub[current.label] ?? []).length} shots logged</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs, marginTop: t.spacing.sm }}>
                {(shotsByClub[current.label] ?? []).map((v, i) => (
                  <Body
                    key={i}
                    onPress={() => removeShot(current.label, i)}
                    style={{
                      color: t.textPrimary, backgroundColor: t.surface, borderColor: t.border,
                      borderWidth: StyleSheet.hairlineWidth, borderRadius: t.radius.pill,
                      paddingVertical: 4, paddingHorizontal: 10, fontSize: t.fontSize.sm,
                    }}
                  >
                    {Math.round(v)} ✕
                  </Body>
                ))}
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              {clubIndex > 0 ? (
                <View style={{ flex: 1 }}>
                  <Button title="Back" kind="ghost" onPress={() => setClubIndex((i) => i - 1)} />
                </View>
              ) : null}
              {clubIndex < clubs.length - 1 ? (
                <View style={{ flex: 1 }}>
                  <Button title="Next club" onPress={() => setClubIndex((i) => i + 1)} />
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <Button title="Review & save" onPress={save} />
                </View>
              )}
            </View>
            <Button title="Save session now" kind="ghost" onPress={save} />
          </>
        ) : null}

        {step === 'saved' && savedInfo ? (
          <>
            <Label>Saved</Label>
            <H1>{CATEGORY_LABELS[category]} baseline logged</H1>
            <Body muted>
              {savedInfo.shots} shots across {savedInfo.clubs} clubs. Your profiles and Golf IQ just updated.
            </Body>
            <View style={{ height: t.spacing.lg }} />
            <Button title="Add another category" kind="ghost" onPress={restartForAnotherCategory} />
            <Button title="Finish & see my Golf IQ" onPress={finish} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
