import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { font, signal, type } from '@coopr/tokens';
import { select } from '../haptics';
import { useReduceMotion } from './reduce-motion';

export function ThruBar({ label, pips }: { label: string | null; pips: readonly ('under' | 'even' | 'over' | 'open')[] }) {
  return (
    <View style={styles.thru} accessibilityLabel={label ?? 'No score kept'}>
      <View style={styles.bar}>
        {pips.map((pip, index) => (
          <View
            key={index}
            style={[
              styles.seg,
              pip === 'under' && { backgroundColor: signal.go },
              pip === 'even' && { backgroundColor: '#FFFFFF' },
              pip === 'over' && { backgroundColor: signal.hazard },
              pip === 'open' && styles.segOpen,
            ]}
          />
        ))}
      </View>
      {label ? <Text style={styles.thruText}>{label}</Text> : null}
    </View>
  );
}

/** Circular confidence. An unknown sample draws the track only. */
export function ConfidenceRing({ percent }: { percent: number | null }) {
  const size = 44;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const turn = 2 * Math.PI * radius;
  const span = percent == null ? 0 : (Math.max(0, Math.min(100, percent)) / 100) * turn;
  const color = percent == null ? 'transparent' : percent >= 70 ? signal.go : percent >= 50 ? signal.caution : signal.hazard;
  return (
    <Svg width={size} height={size} accessibilityLabel={percent == null ? 'Confidence unknown' : `${percent} percent`}>
      <Circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.28)" strokeWidth={stroke} fill="none" />
      {percent != null ? (
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${span} ${turn - span}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      ) : null}
    </Svg>
  );
}

export function Pips({ filled, total }: { filled: number; total: number }) {
  return (
    <View style={styles.pips} accessibilityLabel={`${filled} of ${total} rounds`}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.roundPip, index < filled ? styles.roundOn : styles.roundOff]} />
      ))}
    </View>
  );
}

export function ClubStrip({
  clubs,
  index,
  band,
  selectedDetail,
  onIndex,
  onOpen,
}: {
  clubs: readonly { id: string; label: string }[];
  index: number | null;
  band: string | null;
  selectedDetail?: string | null;
  onIndex: (index: number) => void;
  onOpen?: () => void;
}) {
  const [width, setWidth] = useState(0);
  const reduce = useReduceMotion();
  const chosen = useRef(index);
  useEffect(() => {
    chosen.current = index;
  }, [index]);
  const selected = index != null && index >= 0 && index < clubs.length ? index : null;
  const windowStart = selected == null ? 0 : Math.max(0, Math.min(selected - 1, Math.max(0, clubs.length - 3)));
  const visible = clubs.slice(windowStart, windowStart + 3);
  const commit = (next: number) => {
    if (chosen.current === next) return;
    chosen.current = next;
    onIndex(next);
    void select();
  };
  const pick = (x: number) => {
    if (clubs.length === 0 || width <= 0) return;
    const next = Math.max(0, Math.min(clubs.length - 1, Math.round((x / width) * (clubs.length - 1))));
    commit(next);
  };
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (event) => pick(event.nativeEvent.locationX),
    onPanResponderRelease: (event) => pick(event.nativeEvent.locationX),
  });
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="Clubs"
      accessibilityHint="Drag sideways to change the club."
      style={styles.strip}
    >
      {visible.map((club) => {
        const clubIndex = clubs.indexOf(club);
        const on = selected === clubIndex;
        const name = club.label.split('·')[0]?.trim() || club.label;
        return (
          <Pressable
            key={club.id}
            accessibilityRole="button"
            accessibilityLabel={on ? `Club ${name}, selected` : `Club ${name}`}
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) onOpen?.();
              else commit(clubIndex);
            }}
            style={({ pressed }) => [styles.club, on && styles.clubOn, pressed && !reduce ? styles.pressed : null]}
          >
            <Text style={[styles.clubText, on && styles.clubTextOn]} numberOfLines={1}>
              {on && selectedDetail ? selectedDetail : name}
            </Text>
            {on && band ? <Text style={styles.band}>{band}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  thru: { gap: 4, alignSelf: 'stretch' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 6 },
  seg: { flex: 1, height: 6, borderRadius: 3 },
  segOpen: { backgroundColor: 'rgba(255,255,255,0.22)' },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  thruText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  roundPip: { width: 14, height: 14, borderRadius: 7 },
  roundOn: { backgroundColor: signal.go },
  roundOff: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#FFFFFF' },
  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  club: { flex: 1, minWidth: 56, minHeight: 56, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  clubOn: { flex: 1.4, minWidth: 88 },
  pressed: { transform: [{ scale: 0.96 }] },
  clubText: { color: 'rgba(255,255,255,0.72)', fontFamily: font.family, fontSize: type.caption, fontWeight: font.semibold },
  clubTextOn: { color: '#FFFFFF', fontSize: type.body, lineHeight: 22, fontWeight: font.bold },
  band: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
});
