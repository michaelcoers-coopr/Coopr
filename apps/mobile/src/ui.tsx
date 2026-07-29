import React from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput, InputAccessoryView, Platform, Keyboard,
  type ViewStyle, type TextStyle,
} from 'react-native';
import { useTheme } from './theme';

// Shared "Done" bar so number-pad keyboards can always be dismissed (iOS has no return
// key on the number pad). Render <DoneAccessory/> once per screen; point NumberFields at
// DONE_ACCESSORY_ID.
export const DONE_ACCESSORY_ID = 'coopr-done';

export function DoneAccessory() {
  const t = useTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
      <View
        style={{
          backgroundColor: t.surfaceRaised, borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth,
          alignItems: 'flex-end', paddingVertical: 6, paddingHorizontal: 12,
        }}
      >
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={12}>
          <Text style={{ color: t.accent, fontWeight: '700', fontSize: t.fontSize.md }}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

export function NumberField({
  value, onChange, width = 120, placeholder, allowNegative,
}: {
  value: string;
  onChange: (v: string) => void;
  width?: number;
  placeholder?: string;
  allowNegative?: boolean;
}) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType={allowNegative ? 'numbers-and-punctuation' : 'number-pad'}
      inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
      placeholder={placeholder}
      placeholderTextColor={t.textMuted}
      returnKeyType="done"
      style={{
        width, color: t.textPrimary, backgroundColor: t.surface, borderColor: t.border, borderWidth: 1,
        borderRadius: t.radius.sm, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm,
        fontSize: t.fontSize.md, marginVertical: t.spacing.xs,
      }}
    />
  );
}

// Minimal neutral-wireframe UI kit. No brand values here — colors come from tokens.

export function Screen({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.ink, padding: t.spacing.lg }}>{children}</View>;
}

// The COOPR wordmark — placeholder rendition (the two linked "O" rings in the accent,
// with a small flagstick nod to the golf hole). Swap for the final brand asset when
// approved. Scales with `size`.
export function Wordmark({ size = 48 }: { size?: number }) {
  const t = useTheme();
  const r = size * 0.8;
  const ring = { width: r, height: r, borderRadius: r / 2, borderWidth: Math.max(2, size * 0.1), borderColor: t.accent };
  const letter = { color: t.white, fontSize: size, fontWeight: '900' as const, letterSpacing: 1 };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={letter}>C</Text>
      <View style={ring} />
      <View style={[ring, { marginLeft: -size * 0.26 }]}>
        <View style={{ position: 'absolute', left: r * 0.46, top: r * 0.14, width: Math.max(1.5, size * 0.04), height: r * 0.46, backgroundColor: t.accent }} />
        <View style={{ position: 'absolute', left: r * 0.5, top: r * 0.14, width: r * 0.22, height: r * 0.14, backgroundColor: t.accent }} />
      </View>
      <Text style={[letter, { marginLeft: size * 0.04 }]}>PR</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surfaceRaised,
          borderColor: t.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: t.radius.md,
          padding: t.spacing.lg,
          marginBottom: t.spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.textPrimary, fontSize: t.fontSize.xl, fontWeight: '800' }}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.textPrimary, fontSize: t.fontSize.lg, fontWeight: '700' }}>{children}</Text>;
}
export function Body({
  children,
  muted,
  style,
  onPress,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: TextStyle;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Text onPress={onPress} style={[{ color: muted ? t.textSecondary : t.textPrimary, fontSize: t.fontSize.md }, style]}>
      {children}
    </Text>
  );
}
export function Label({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.textMuted, fontSize: t.fontSize.xs, textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </Text>
  );
}

export function Button({ title, onPress, kind = 'primary' }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' }) {
  const t = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: primary ? t.accent : 'transparent',
        borderColor: t.accent,
        borderWidth: primary ? 0 : StyleSheet.hairlineWidth,
        borderRadius: t.radius.pill,
        paddingVertical: t.spacing.md,
        paddingHorizontal: t.spacing.xl,
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
        marginVertical: t.spacing.xs,
      })}
    >
      <Text style={{ color: primary ? t.accentOn : t.accent, fontWeight: '700', fontSize: t.fontSize.md }}>{title}</Text>
    </Pressable>
  );
}

// A horizontal single-select. Options are value/label pairs.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs, marginVertical: t.spacing.xs }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              paddingVertical: t.spacing.sm,
              paddingHorizontal: t.spacing.md,
              borderRadius: t.radius.pill,
              backgroundColor: active ? t.accent : t.surface,
              borderColor: active ? t.accent : t.border,
              borderWidth: StyleSheet.hairlineWidth,
            }}
          >
            <Text style={{ color: active ? t.accentOn : t.textSecondary, fontSize: t.fontSize.sm, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RiskPill({ label, level }: { label: string; level: 'low' | 'moderate' | 'elevated' | 'high' }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, marginRight: t.spacing.md, marginTop: t.spacing.xs }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.riskColor[level] }} />
      <Text style={{ color: t.textSecondary, fontSize: t.fontSize.sm }}>
        {label}: <Text style={{ color: t.textPrimary, fontWeight: '600' }}>{level}</Text>
      </Text>
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginVertical: t.spacing.md }} />;
}
