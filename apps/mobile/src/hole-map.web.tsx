import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import type { LatLon } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import { projectPoints } from '@coopr/engine';
import { Muted } from './ui';
import type { HoleMapProps } from './hole-map-props';

const WIDTH = 350;
const HEIGHT = 320;

function pointsOf(ring: readonly LatLon[], projection: ReturnType<typeof projectPoints>): string {
  return ring.map((point) => {
    const xy = projection.toXY(point);
    return `${xy.x},${xy.y}`;
  }).join(' ');
}

/** Open geometry only. Apple satellite is the phone map. This drawing is the same shapes. */
export function HoleMap(props: HoleMapProps) {
  const cloud = [props.line, ...props.fairways, ...props.green, ...props.bunkers, ...props.hazards, ...(props.ellipse ? [props.ellipse] : []), ...props.dispersionLine, ...props.measure].flat();
  if (cloud.length === 0) return <Muted>This hole has no open geometry to draw.</Muted>;
  const projection = projectPoints(cloud, WIDTH, HEIGHT, 18);
  return (
    <View style={styles.frame}>
      <Svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onPress={(event) => {
          const x = event.nativeEvent.locationX;
          const y = event.nativeEvent.locationY;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          props.onTap(projection.toLatLon(x, y));
        }}
      >
        {props.fairways.map((ring, index) => (
          <Polygon key={`fairway-${index}`} points={pointsOf(ring, projection)} fill="rgba(255,255,255,0.9)" stroke={colors.navy} strokeWidth={2} />
        ))}
        {props.bunkers.map((ring, index) => (
          <Polygon key={`bunker-${index}`} points={pointsOf(ring, projection)} fill={colors.white} stroke={colors.navy} strokeWidth={1.5} />
        ))}
        {props.hazards.map((ring, index) => (
          <Polygon key={`hazard-${index}`} points={pointsOf(ring, projection)} fill={colors.red} fillOpacity={0.72} stroke={colors.red} strokeWidth={3} />
        ))}
        {props.green.map((ring, index) => (
          <Polygon key={`green-${index}`} points={pointsOf(ring, projection)} fill={colors.white} stroke={colors.navy} strokeWidth={2.5} />
        ))}
        {props.line.length > 1 ? <Polyline points={pointsOf(props.line, projection)} fill="none" stroke={colors.navy} strokeWidth={3} /> : null}
        {props.ellipse && props.ellipse.length > 2 ? (
          <Polygon points={pointsOf(props.ellipse, projection)} fill="rgba(11,31,58,0.18)" stroke={colors.navy} strokeWidth={2} />
        ) : null}
        {props.dispersionLine.length > 1 ? (
          <Polyline points={pointsOf(props.dispersionLine, projection)} fill="none" stroke={colors.navy} strokeWidth={4} />
        ) : null}
        {props.measure.length > 1 ? <Polyline points={pointsOf(props.measure, projection)} fill="none" stroke={colors.red} strokeWidth={3} /> : null}
      </Svg>
      <View pointerEvents="none" style={styles.float}>
        <View>
          <Text style={styles.kicker}>Raw</Text>
          <Text style={styles.raw}>{props.rawLabel}</Text>
        </View>
        <View>
          <Text style={styles.kicker}>Plays like</Text>
          <Text style={styles.plays}>{props.playsLabel}</Text>
        </View>
      </View>
      <Muted>Open geometry. Satellite imagery is on the iPhone. A tap is a map distance, not a shot.</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: colors.navy, backgroundColor: colors.bg },
  float: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 248,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.navy,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  raw: { color: colors.navy, fontSize: 42, fontWeight: '800', lineHeight: 46 },
  plays: { color: colors.navy, fontSize: 42, fontWeight: '800', lineHeight: 46, textAlign: 'right' },
});
