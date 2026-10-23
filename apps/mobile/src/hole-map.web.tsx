import { useEffect, useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Pattern, Polygon, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import { nudgeLabels, projectAlongHole, projectPoints } from '@coopr/engine';
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
  const [flightT, setFlightT] = useState(props.reduceMotion ? 1 : 0);
  const flightKey = (props.flight ?? []).map((point) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`).join('|');
  useEffect(() => {
    if (!props.flight || props.flight.length < 2) return;
    if (props.reduceMotion) {
      setFlightT(1);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const next = Math.min(1, (now - started) / 700);
      setFlightT(next);
      if (next < 1) frame = requestAnimationFrame(step);
    };
    setFlightT(0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [flightKey, props.reduceMotion]);
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
            <LinearGradient id={`${uid}-fairgrad`} x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#0E4A28" />
              <Stop offset="0.55" stopColor="#1F8A4C" />
              <Stop offset="1" stopColor="#7DDEA0" />
            </LinearGradient>
          </Defs>
        ) : null}
        {bleed ? <Rect x={0} y={0} width={width} height={height} fill={ROUGH} /> : null}
        {props.fairways.map((ring, index) => (
          <Polygon key={`fairway-${index}`} points={pointsOf(ring, projection)} fill={bleed ? FAIRWAY_DARK : 'rgba(255,255,255,0.9)'} stroke={bleed ? '#145C32' : ink} strokeWidth={bleed ? 1.5 : 2} />
        ))}
        {bleed && props.fairways.length > 0 ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-mow)`} clipPath={`url(#${uid}-fair)`} /> : null}
        {bleed && props.fairways.length > 0 ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-fairgrad)`} fillOpacity={0.55} clipPath={`url(#${uid}-fair)`} /> : null}
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
              const nudge = key === 'front' ? { x: -28, y: -16 } : key === 'back' ? { x: 30, y: 18 } : { x: 36, y: -6 };
              return (
                <G key={key}>
                  <Circle cx={xy.x} cy={xy.y} r={radius} fill={primary ? '#FFFFFF' : 'rgba(255,255,255,0.55)'} stroke={markInk} strokeWidth={primary ? 2 : 1} />
                  <SvgText x={xy.x + nudge.x} y={xy.y + nudge.y} fill={markInk} fontSize={primary ? 14 : 11} fontWeight="700">
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
        {(() => {
          const greenPts = props.green.flatMap((ring) => ring.map((point) => projection.toXY(point)));
          const greenBox = greenPts.length
            ? {
                x: Math.min(...greenPts.map((point) => point.x)) - 6,
                y: Math.min(...greenPts.map((point) => point.y)) - 6,
                w: Math.max(...greenPts.map((point) => point.x)) - Math.min(...greenPts.map((point) => point.x)) + 12,
                h: Math.max(...greenPts.map((point) => point.y)) - Math.min(...greenPts.map((point) => point.y)) + 12,
              }
            : null;
          const placed = nudgeLabels(
            (props.labels ?? []).map((label) => {
              const xy = projection.toXY(label.at);
              const boxW = Math.max(44, label.label.length * 12 + 16);
              const box = { ...label, x: xy.x - boxW / 2, y: xy.y - 16, w: boxW, h: 28 };
              if (greenBox) {
                const overlapX = Math.min(box.x + box.w, greenBox.x + greenBox.w) - Math.max(box.x, greenBox.x);
                const overlapY = Math.min(box.y + box.h, greenBox.y + greenBox.h) - Math.max(box.y, greenBox.y);
                if (overlapX > 0 && overlapY > 0) box.x = greenBox.x + greenBox.w + 8;
              }
              return box;
            }),
            8,
            width - 8,
          );
          return placed;
        })().map((label) => (
          <G key={`${label.label}-${label.x.toFixed(0)}`}>
            <Rect x={label.x} y={label.y} width={label.w} height={label.h} rx={10} fill="rgba(11,31,58,0.88)" />
            <SvgText x={label.x + label.w / 2} y={label.y + 20} fill="#FFFFFF" fontSize={17} fontWeight="700" textAnchor="middle">
              {label.label}
            </SvgText>
          </G>
        ))}
        {props.ellipse && props.ellipse.length > 2 ? (
          <Polygon points={pointsOf(props.ellipse, projection)} fill={props.ellipseColor ?? '#8AC926'} fillOpacity={0.38} stroke={props.ellipseColor ?? '#8AC926'} strokeWidth={2.5} />
        ) : null}
        {props.ellipse && props.ellipse.length > 2
          ? (() => {
              const xy = props.ellipse!.map((point) => projection.toXY(point));
              const minX = Math.min(...xy.map((point) => point.x));
              const maxX = Math.max(...xy.map((point) => point.x));
              const minY = Math.min(...xy.map((point) => point.y));
              const maxY = Math.max(...xy.map((point) => point.y));
              const span = Math.max(maxX - minX, maxY - minY, 0.5);
              if (span >= 48) return null;
              const scale = 72 / span;
              const cx = (minX + maxX) / 2;
              const cy = (minY + maxY) / 2;
              const loupeX = Math.min(width - 86, Math.max(86, cx + 78));
              const loupeY = Math.min(height - 150, Math.max(120, cy + 36));
              const magnified = xy.map((point) => `${loupeX + (point.x - cx) * scale},${loupeY + (point.y - cy) * scale}`).join(' ');
              const ink = props.ellipseColor ?? '#8AC926';
              const capW = 210;
              const capX = Math.min(width - capW - 8, Math.max(8, loupeX - capW / 2));
              const capMid = capX + capW / 2;
              return (
                <G>
                  <Circle cx={loupeX} cy={loupeY} r={46} fill="rgba(11,31,58,0.72)" stroke="#FFFFFF" strokeWidth={2} />
                  <Polygon points={magnified} fill={ink} fillOpacity={0.45} stroke={ink} strokeWidth={2} />
                  <Rect x={capX} y={loupeY + 50} width={capW} height={52} rx={14} fill="rgba(11,31,58,0.9)" />
                  <SvgText x={capMid} y={loupeY + 70} fill="#FFFFFF" fontSize={17} fontWeight="700" textAnchor="middle">
                    Larger
                  </SvgText>
                  {props.ellipseNote ? (
                    <SvgText x={capMid} y={loupeY + 90} fill="#FFFFFF" fontSize={17} fontWeight="700" textAnchor="middle">
                      {props.ellipseNote}
                    </SvgText>
                  ) : null}
                </G>
              );
            })()
          : null}
        {props.flight && props.flight.length > 1 ? (
          <Polyline
            points={pointsOf(props.flight.slice(0, Math.max(2, Math.ceil(props.flight.length * flightT))), projection)}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
          />
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
