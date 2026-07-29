import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from './theme';

// Minimal neutral-wireframe UI kit. No brand values here — colors come from tokens.

export function Screen({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.ink, padding: t.spacing.lg }}>{children}</View>;
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
