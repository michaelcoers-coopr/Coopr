import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '@coopr/domain';
import { colors, play } from '@coopr/tokens';
import { projectPoints } from '@coopr/engine';
import { Muted } from './ui';
import type { HoleMapProps } from './hole-map-props';

function pointsOf(ring: readonly LatLon[], projection: ReturnType<typeof projectPoints>): string {
  return ring.map((point) => {
    const xy = projection.toXY(point);
    return `${xy.x},${xy.y}`;
  }).join(' ');
}

/** Open geometry only. Apple satellite is the phone map. This drawing is the same shapes, in course colors. */
export function HoleMap(props: HoleMapProps) {
  const [width, setWidth] = useState(390);
  const cloud = [props.line, ...props.fairways, ...props.green, ...props.bunkers, ...props.hazards, ...(props.ellipse ? [props.ellipse] : []), ...props.dispersionLine, ...props.measure].flat();
  if (cloud.length === 0) return <Muted>This hole has no open geometry to draw.</Muted>;
  const height = props.height ?? 220;
  const projection = projectPoints(cloud, width, height, props.pad ?? (props.bleed ? { top: 28, right: 20, bottom: 28, left: 20 } : 12));
  const bleed = props.bleed === true;
  const ink = bleed ? '#F4FFF6' : colors.navy;
  const fairwayFill = bleed ? '#1F8A4C' : 'rgba(255,255,255,0.9)';
  const markInk = bleed ? '#F4F7FB' : colors.navy;
  return (
    <View
      style={[styles.frame, bleed && styles.bleed, bleed && { height }]}
      onLayout={(event) => setWidth(Math.max(1, Math.round(event.nativeEvent.layout.width)))}
    >
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onPress={(event) => {
          const x = event.nativeEvent.locationX;
          const y = event.nativeEvent.locationY;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          props.onTap(projection.toLatLon(x, y));
        }}
      >
        {bleed ? <Rect x={0} y={0} width={width} height={height} fill="#0C2418" /> : null}
        {props.fairways.map((ring, index) => (
          <Polygon key={`fairway-${index}`} points={pointsOf(ring, projection)} fill={fairwayFill} stroke={ink} strokeWidth={bleed ? 2.5 : 2} />
        ))}
        {props.bunkers.map((ring, index) => (
          <Polygon key={`bunker-${index}`} points={pointsOf(ring, projection)} fill={bleed ? '#E4C98A' : colors.white} stroke={bleed ? '#F8E7C0' : ink} strokeWidth={1.5} />
        ))}
        {props.hazards.map((ring, index) => (
          <Polygon key={`hazard-${index}`} points={pointsOf(ring, projection)} fill={colors.red} fillOpacity={bleed ? 0.94 : 0.72} stroke={bleed ? '#FFD5DC' : colors.red} strokeWidth={bleed ? 2 : 3} />
        ))}
        {props.green.map((ring, index) => (
          <Polygon key={`green-${index}`} points={pointsOf(ring, projection)} fill={bleed ? '#B6F2A2' : colors.white} stroke={bleed ? '#FFFFFF' : ink} strokeWidth={2.5} />
        ))}
        {props.marks
          ? (['front', 'back', 'center'] as const).map((key) => {
              const xy = projection.toXY(props.marks![key]);
              const primary = key === 'center';
              const label = key === 'front' ? 'F' : key === 'back' ? 'B' : 'C';
              const radius = primary ? 7 : 4.5;
              return (
                <G key={key}>
                  <Circle
                    cx={xy.x}
                    cy={xy.y}
                    r={radius}
                    fill={primary ? '#FFFFFF' : 'rgba(255,255,255,0.55)'}
                    stroke={primary ? play.live : markInk}
                    strokeWidth={primary ? 2.5 : 1}
                  />
                  <SvgText x={xy.x + radius + 3} y={xy.y + 4} fill={markInk} fontSize={primary ? 14 : 11} fontWeight="700">
                    {label}
                  </SvgText>
                </G>
              );
            })
          : null}
        {props.line.length > 1 ? <Polyline points={pointsOf(props.line, projection)} fill="none" stroke={bleed ? 'rgba(255,255,255,0.88)' : colors.navy} strokeWidth={3} /> : null}
        {props.ellipse && props.ellipse.length > 2 ? (
          <Polygon points={pointsOf(props.ellipse, projection)} fill="rgba(11,31,58,0.18)" stroke={colors.navy} strokeWidth={2} />
        ) : null}
        {props.dispersionLine.length > 1 ? (
          <Polyline points={pointsOf(props.dispersionLine, projection)} fill="none" stroke={bleed ? play.live : colors.navy} strokeWidth={4} />
        ) : null}
        {props.measure.length > 1 ? <Polyline points={pointsOf(props.measure, projection)} fill="none" stroke={colors.red} strokeWidth={3} /> : null}
      </Svg>
      {bleed ? null : <View pointerEvents="none" style={[styles.float, { top: height - 74 }]}>
        <View>
          <Text style={styles.kicker}>Shot</Text>
          <Text style={styles.raw}>{props.rawLabel}</Text>
        </View>
        <View>
          <Text style={styles.kicker}>Plays like</Text>
          <Text style={styles.plays}>{props.playsLabel}</Text>
        </View>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: '#F7F5F2', backgroundColor: colors.bg },
  bleed: { width: '100%', borderRadius: 0, borderWidth: 0, backgroundColor: play.bg },
  float: {
    position: 'absolute',
    left: 12,
    right: 12,
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
