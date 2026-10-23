import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Pattern, Polygon, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import { projectAlongHole, projectPoints } from '@coopr/engine';
import { Muted } from './ui';
import type { HoleMapProps } from './hole-map-props';

const ROUGH = '#0E3320';
const FAIRWAY_DARK = '#176B3A';
const FAIRWAY_LIGHT = '#228848';
const GREEN = '#C6F5B4';
const SAND = '#E4C98A';
const SAND_GRAIN = '#C6A86C';

function pointsOf(ring: readonly LatLon[], projection: ReturnType<typeof projectPoints>): string {
  return ring
    .map((point) => {
      const xy = projection.toXY(point);
      return `${xy.x},${xy.y}`;
    })
    .join(' ');
}

/** Open geometry only. Apple satellite is the phone map. This drawing is the same shapes, stood tee-to-green. */
export function HoleMap(props: HoleMapProps) {
  const [width, setWidth] = useState(390);
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const cloud = [props.line, ...props.fairways, ...props.green, ...props.bunkers, ...props.hazards, ...(props.ellipse ? [props.ellipse] : []), ...props.dispersionLine, ...props.measure].flat();
  if (cloud.length === 0) return <Muted>This hole has no open geometry to draw.</Muted>;
  const height = props.height ?? 220;
  const pad = props.pad ?? (props.bleed ? { top: 48, right: 16, bottom: 56, left: 16 } : 12);
  const projection =
    props.orient != null
      ? projectAlongHole(cloud, width, height, pad, props.orient.bearing, props.orient.origin)
      : projectPoints(cloud, width, height, pad);
  const bleed = props.bleed === true;
  const ink = bleed ? '#F4FFF6' : colors.navy;
  const markInk = bleed ? '#F4F7FB' : colors.navy;
  const tee = bleed && props.line[0] ? projection.toXY(props.line[0]) : null;
  const pinPoint = bleed && props.line.length > 1 ? props.line[props.line.length - 1] : null;
  const pin = pinPoint ? projection.toXY(pinPoint) : null;
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
        {bleed ? (
          <Defs>
            <ClipPath id={`${uid}-fair`}>
              {props.fairways.map((ring, index) => (
                <Polygon key={`clip-fair-${index}`} points={pointsOf(ring, projection)} />
              ))}
            </ClipPath>
            <ClipPath id={`${uid}-green`}>
              {props.green.map((ring, index) => (
                <Polygon key={`clip-green-${index}`} points={pointsOf(ring, projection)} />
              ))}
            </ClipPath>
            <ClipPath id={`${uid}-sand`}>
              {props.bunkers.map((ring, index) => (
                <Polygon key={`clip-sand-${index}`} points={pointsOf(ring, projection)} />
              ))}
            </ClipPath>
            <Pattern id={`${uid}-mow`} width={width} height={16} patternUnits="userSpaceOnUse">
              <Rect x={0} y={0} width={width} height={8} fill={FAIRWAY_DARK} />
              <Rect x={0} y={8} width={width} height={8} fill={FAIRWAY_LIGHT} />
            </Pattern>
            <Pattern id={`${uid}-grain`} width={10} height={10} patternUnits="userSpaceOnUse">
              <Rect width={10} height={10} fill={SAND} />
              <Circle cx={2} cy={3} r={0.7} fill={SAND_GRAIN} />
              <Circle cx={7} cy={7} r={0.55} fill="#F3E0B0" />
              <Circle cx={5} cy={2} r={0.4} fill={SAND_GRAIN} />
            </Pattern>
            <RadialGradient id={`${uid}-shine`} cx="50%" cy="42%" r="58%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.72" />
              <Stop offset="0.55" stopColor={GREEN} stopOpacity="0.2" />
              <Stop offset="1" stopColor={GREEN} stopOpacity="0" />
            </RadialGradient>
          </Defs>
        ) : null}
        {bleed ? <Rect x={0} y={0} width={width} height={height} fill={ROUGH} /> : null}
        {props.fairways.map((ring, index) => (
          <Polygon key={`fairway-${index}`} points={pointsOf(ring, projection)} fill={bleed ? FAIRWAY_DARK : 'rgba(255,255,255,0.9)'} stroke={bleed ? '#145C32' : ink} strokeWidth={bleed ? 1.5 : 2} />
        ))}
        {bleed && props.fairways.length > 0 ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-mow)`} clipPath={`url(#${uid}-fair)`} /> : null}
        {props.bunkers.map((ring, index) => (
          <Polygon key={`bunker-${index}`} points={pointsOf(ring, projection)} fill={bleed ? SAND : colors.white} stroke={bleed ? '#F8E7C0' : ink} strokeWidth={1.5} />
        ))}
        {bleed && props.bunkers.length > 0 ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-grain)`} clipPath={`url(#${uid}-sand)`} /> : null}
        {props.hazards.map((ring, index) => (
          <Polygon key={`hazard-${index}`} points={pointsOf(ring, projection)} fill={colors.red} fillOpacity={bleed ? 0.92 : 0.72} stroke={bleed ? '#FFD5DC' : colors.red} strokeWidth={bleed ? 2 : 3} />
        ))}
        {props.green.map((ring, index) => (
          <Polygon key={`green-${index}`} points={pointsOf(ring, projection)} fill={bleed ? GREEN : colors.white} stroke={bleed ? '#FFFFFF' : ink} strokeWidth={2} />
        ))}
        {bleed && props.green.length > 0 ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-shine)`} clipPath={`url(#${uid}-green)`} /> : null}
        {props.marks
          ? (['front', 'back', 'center'] as const).map((key) => {
              const xy = projection.toXY(props.marks![key]);
              const primary = key === 'center';
              const label = key === 'front' ? 'F' : key === 'back' ? 'B' : 'C';
              const radius = primary ? 7 : 4.5;
              return (
                <G key={key}>
                  <Circle cx={xy.x} cy={xy.y} r={radius} fill={primary ? '#FFFFFF' : 'rgba(255,255,255,0.55)'} stroke={markInk} strokeWidth={primary ? 2 : 1} />
                  <SvgText x={xy.x + radius + 3} y={xy.y + 4} fill={markInk} fontSize={primary ? 14 : 11} fontWeight="700">
                    {label}
                  </SvgText>
                </G>
              );
            })
          : null}
        {props.line.length > 1 ? (
          <Polyline
            points={pointsOf(props.line, projection)}
            fill="none"
            stroke={bleed ? 'rgba(255,255,255,0.92)' : colors.navy}
            strokeWidth={bleed ? 2.5 : 3}
            strokeDasharray={bleed ? '8 8' : undefined}
            strokeLinecap="round"
          />
        ) : null}
        {tee ? <Rect x={tee.x - 14} y={tee.y - 5} width={28} height={10} rx={2} fill="#FFFFFF" /> : null}
        {pin ? (
          <G>
            <Line x1={pin.x} y1={pin.y} x2={pin.x} y2={pin.y - 30} stroke="#F7F5F2" strokeWidth={2} />
            <Polygon points={`${pin.x},${pin.y - 30} ${pin.x + 16},${pin.y - 23} ${pin.x},${pin.y - 16}`} fill={colors.red} />
          </G>
        ) : null}
        {(props.labels ?? []).map((label) => {
          const xy = projection.toXY(label.at);
          const boxW = Math.max(44, label.label.length * 12 + 16);
          return (
            <G key={`${label.label}-${xy.x.toFixed(0)}`}>
              <Rect x={xy.x - boxW / 2} y={xy.y - 16} width={boxW} height={28} rx={10} fill="rgba(11,31,58,0.88)" />
              <SvgText x={xy.x} y={xy.y + 4} fill="#FFFFFF" fontSize={17} fontWeight="700" textAnchor="middle">
                {label.label}
              </SvgText>
            </G>
          );
        })}
        {props.ellipse && props.ellipse.length > 2 ? (
          <Polygon points={pointsOf(props.ellipse, projection)} fill="rgba(11,31,58,0.18)" stroke={colors.navy} strokeWidth={2} />
        ) : null}
        {props.dispersionLine.length > 1 ? (
          <Polyline points={pointsOf(props.dispersionLine, projection)} fill="none" stroke={bleed ? 'rgba(255,255,255,0.7)' : colors.navy} strokeWidth={4} />
        ) : null}
        {props.measure.length > 1 ? <Polyline points={pointsOf(props.measure, projection)} fill="none" stroke={colors.red} strokeWidth={3} /> : null}
      </Svg>
      {bleed ? null : (
        <View pointerEvents="none" style={[styles.float, { top: height - 74 }]}>
          <View>
            <Text style={styles.kicker}>Shot</Text>
            <Text style={styles.raw}>{props.rawLabel}</Text>
          </View>
          <View>
            <Text style={styles.kicker}>Plays like</Text>
            <Text style={styles.plays}>{props.playsLabel}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: '#F7F5F2', backgroundColor: colors.bg },
  bleed: { width: '100%', borderRadius: 0, borderWidth: 0, backgroundColor: ROUGH },
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
