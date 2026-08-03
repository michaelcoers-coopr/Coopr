import { useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CADDIE_PRESETS, type CaddiePreset } from '@coopr/core';
import { useTheme } from '../src/theme';
import { H1, Body, Label, Button, Card } from '../src/ui';
import { getFirstUserId, getCaddieRow } from '../src/db/repo';
import { saveCaddieProfile } from '../src/features/caddie-writer';

export default function CaddieProfile() {
  const t = useTheme();
  const router = useRouter();
  const userId = getFirstUserId();
  const existing = userId ? getCaddieRow(userId) : null;

  const initialPreset = CADDIE_PRESETS.find((p) => p.label === existing?.personality) ?? CADDIE_PRESETS[0]!;
  const [name, setName] = useState(existing?.name ?? initialPreset.name);
  const [preset, setPreset] = useState<CaddiePreset>(initialPreset);

  const save = () => {
    if (!userId) return;
    saveCaddieProfile(userId, name.trim() || preset.name, preset);
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }} keyboardShouldPersistTaps="handled">
        <Label>Your Caddie</Label>
        <H1>Give it a name and a voice</H1>
        <Body muted>The personality shapes how your caddie talks. It never changes the golf math — your numbers stay the numbers.</Body>

        <Card>
          <Label>Name</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={preset.name}
            placeholderTextColor={t.textMuted}
            style={{
              color: t.textPrimary, backgroundColor: t.surface, borderColor: t.border, borderWidth: 1,
              borderRadius: t.radius.sm, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm,
              fontSize: t.fontSize.lg, marginTop: t.spacing.xs,
            }}
          />
        </Card>

        <Label>Personality</Label>
        {CADDIE_PRESETS.map((p) => {
          const active = p.key === preset.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => setPreset(p)}
              style={{
                backgroundColor: active ? t.surfaceRaised : t.surface,
                borderColor: active ? t.accent : t.border,
                borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                borderRadius: t.radius.md, padding: t.spacing.md, marginVertical: t.spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Body style={{ fontWeight: '700', color: active ? t.accent : t.textPrimary }}>{p.label}</Body>
                {active ? <Body style={{ color: t.accent }}>✓</Body> : null}
              </View>
              <Body muted style={{ fontSize: t.fontSize.sm, marginTop: 2 }}>{p.blurb}</Body>
            </Pressable>
          );
        })}

        <View style={{ height: t.spacing.md }} />
        <Button title="Save caddie" onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}
