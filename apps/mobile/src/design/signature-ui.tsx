import { useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { font, signal, type } from '@coopr/tokens';

export function ThruBar({ label, pips }: { label: string | null; pips: readonly ('under' | 'even' | 'over' | 'open')[] }) {
  return (
    <View style={styles.thru} accessibilityLabel={label ?? 'No score kept'}>
      <View style={styles.pips}>
        {pips.map((pip, index) => (
          <View
            key={index}
            style={[
              styles.pip,
              pip === 'under' && { backgroundColor: signal.go },
              pip === 'even' && { backgroundColor: '#FFFFFF' },
              pip === 'over' && { backgroundColor: signal.hazard },
              pip === 'open' && styles.pipOpen,
            ]}
          />
        ))}
      </View>
      {label ? <Text style={styles.thruText}>{label}</Text> : null}
    </View>
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
  onIndex,
}: {
  clubs: readonly { id: string; label: string }[];
  index: number | null;
  band: string | null;
  onIndex: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const selected = index != null && index >= 0 && index < clubs.length ? index : null;
  const windowStart = selected == null ? 0 : Math.max(0, Math.min(selected - 1, Math.max(0, clubs.length - 3)));
  const visible = clubs.slice(windowStart, windowStart + 3);
  const pick = (x: number) => {
    if (clubs.length === 0 || width <= 0) return;
    const next = Math.max(0, Math.min(clubs.length - 1, Math.round((x / width) * (clubs.length - 1))));
    onIndex(next);
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
            accessibilityLabel={`Club ${name}`}
            accessibilityState={{ selected: on }}
            onPress={() => onIndex(clubIndex)}
            style={[styles.club, on && styles.clubOn]}
          >
            <Text style={styles.clubText} numberOfLines={1}>
              {name}
            </Text>
            {on && band ? <Text style={styles.band}>{band}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  thru: { gap: 4 },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pip: { width: 8, height: 8, borderRadius: 4 },
  pipOpen: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  thruText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  roundPip: { width: 14, height: 14, borderRadius: 7 },
  roundOn: { backgroundColor: signal.go },
  roundOff: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#FFFFFF' },
  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  club: { flex: 1, minWidth: 72, minHeight: 56, paddingHorizontal: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,31,58,0.46)' },
  clubOn: { backgroundColor: 'rgba(11,31,58,0.82)', borderWidth: 2, borderColor: '#FFFFFF' },
  clubText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
  band: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
