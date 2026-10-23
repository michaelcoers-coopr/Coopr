import { useEffect, useId, useMemo, useRef, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Pattern, Polygon, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '@coopr/domain';
import { colors, font } from '@coopr/tokens';
import { projectAlongHole, projectPoints } from '@coopr/engine';
import { Muted } from './ui';
import type { HoleMapProps } from './hole-map-props';
import { HOLE_BLEED_PAD, holeFitPoints, projectHoleFill } from './hole-fit';
import { clipPolylineAtOval, DOT_STROKE, ellipseEdge, fittedEllipse, GREEN_DOT, insideEllipse, layoutHoleLabels, leaderEnd, nearestMark } from './map-label-layout';

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

type XY = { x: number; y: number };

function xyString(points: readonly XY[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function pointSig(points: readonly XY[]): string {
  return points.map((point) => `${point.x.toFixed(0)},${point.y.toFixed(0)}`).join(' ');
}

function padInsets(pad: number | { top?: number; right?: number; bottom?: number; left?: number }): { top: number; right: number; bottom: number; left: number } {
  if (typeof pad === 'number') return { top: pad, right: pad, bottom: pad, left: pad };
  return { top: pad.top ?? 0, right: pad.right ?? 0, bottom: pad.bottom ?? 0, left: pad.left ?? 0 };
}

const mapLabelStyle = {
  fontFamily: font.family,
  fontVariant: ['tabular-nums'] as ['tabular-nums'],
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
};

/** SVG text props omit style. The web map needs it so the sans stack and tabular figures survive. */
const MapText = SvgText as unknown as ComponentType<{
  x: number;
  y: number;
  fill: string;
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  fontFeatureSettings: string;
  textAnchor: 'middle';
  style: typeof mapLabelStyle;
  children: string;
}>;

/** True-scale oval. A pattern smaller than the floor is drawn larger, and the sheet states the real yards. */
function drawEllipse(xy: readonly { x: number; y: number }[]) {
  const fit = fittedEllipse(xy);
  if (!fit) return null;
  const { cx, cy, scale } = fit;
  const ring = (factor: number) => xy.map((point) => `${cx + (point.x - cx) * factor},${cy + (point.y - cy) * factor}`).join(' ');
  const halos = scale > 1 ? [1.7, 2.2] : [1.28, 1.55];
  return {
    ...fit,
    solid: ring(scale),
    glow: ring(scale * halos[0]!),
    glowSoft: ring(scale * halos[1]!),
  };
}

/** Open geometry only. Apple satellite is the phone map. This drawing is the same shapes, stood tee-to-green. */
export function HoleMap(props: HoleMapProps) {
  const [width, setWidth] = useState(390);
  const [flightT, setFlightT] = useState(props.reduceMotion ? 1 : 0);
  const [breath, setBreath] = useState(1);
  const [flash, setFlash] = useState<{ id: 'front' | 'center' | 'back'; text: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );
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
  const ovalOn = props.ellipse != null && props.ellipse.length > 2;
  useEffect(() => {
    if (!ovalOn || props.reduceMotion) {
      setBreath(1);
      return;
    }
    const started = performance.now();
    let frame = 0;
    let shown = 1;
    const step = (now: number) => {
      const wave = (Math.sin(((now - started) / 2800) * Math.PI * 2) + 1) / 2;
      const next = 1 + wave * 0.045;
      if (Math.abs(next - shown) >= 0.008) {
        shown = next;
        setBreath(next);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ovalOn, props.reduceMotion]);
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const cloud = [props.line, ...props.fairways, ...props.green, ...props.bunkers, ...props.hazards, ...(props.ellipse ? [props.ellipse] : []), ...props.dispersionLine, ...props.measure].flat();
  const height = props.height ?? 220;
  const pad = props.pad ?? (props.bleed ? HOLE_BLEED_PAD : 12);
  const frame = padInsets(pad);
  const fitPad = props.bleed ? HOLE_BLEED_PAD : pad;
  const shaped = holeFitPoints({
    line: props.line,
    fairways: props.fairways,
    green: props.green,
    bunkers: props.bunkers,
    hazards: props.hazards,
  });
  const fitPoints = shaped.length > 0 ? shaped : cloud;
  const projection =
    fitPoints.length === 0
      ? null
      : props.bleed && props.orient != null
        ? projectHoleFill(fitPoints, width, height, HOLE_BLEED_PAD, props.orient.bearing, props.orient.origin)
        : props.orient != null
          ? projectAlongHole(fitPoints, width, height, fitPad, props.orient.bearing, props.orient.origin)
          : projectPoints(fitPoints, width, height, fitPad);
  const bleed = props.bleed === true;
  const ink = bleed ? '#F4FFF6' : colors.navy;
  const tee = bleed && projection && props.line[0] ? projection.toXY(props.line[0]) : null;
  const pinPoint = bleed && projection && props.line.length > 1 ? props.line[props.line.length - 1] : null;
  const pin = pinPoint && projection ? projection.toXY(pinPoint) : null;
  const ellipsePts = projection && props.ellipse && props.ellipse.length > 2 ? props.ellipse.map((point) => projection.toXY(point)) : [];
  const ellipseDraw = ellipsePts.length > 2 ? drawEllipse(ellipsePts) : null;
  const lineXY = projection ? props.line.map((point) => projection.toXY(point)) : [];
  const flightXY = projection ? (props.flight ?? []).map((point) => projection.toXY(point)) : [];
  const ball = props.flight?.[0] ?? props.line[0];
  const ballXY = ball && projection ? projection.toXY(ball) : null;
  const aimEnd = ellipseDraw && ballXY && !insideEllipse(ballXY, ellipseDraw.cx, ellipseDraw.cy, ellipseDraw.halfW, ellipseDraw.halfH)
    ? ellipseEdge(ballXY, ellipseDraw.cx, ellipseDraw.cy, ellipseDraw.halfW, ellipseDraw.halfH)
    : null;
  const clippedFlight = ellipseDraw ? clipPolylineAtOval(flightXY, ellipseDraw.cx, ellipseDraw.cy, ellipseDraw.halfW, ellipseDraw.halfH) : flightXY;
  const front = projection && props.marks ? projection.toXY(props.marks.front) : null;
  const center = projection && props.marks ? projection.toXY(props.marks.center) : null;
  const back = projection && props.marks ? projection.toXY(props.marks.back) : null;
  const greenPoints = projection ? props.green.flatMap((ring) => ring.map((point) => projection.toXY(point))) : [];
  const mapLabels = projection ? (props.labels ?? []).map((label) => ({ text: label.label, at: projection.toXY(label.at) })) : [];
  const layoutSignature = projection
    ? [
        width,
        height,
        frame.top,
        frame.right,
        frame.bottom,
        frame.left,
        pointSig(lineXY),
        pointSig(greenPoints),
        pointSig([front, center, back].filter((point): point is XY => point != null)),
        mapLabels.map((label) => `${label.text}@${label.at.x.toFixed(0)},${label.at.y.toFixed(0)}`).join('|'),
        ellipsePts.map((point) => `${point.x.toFixed(0)},${point.y.toFixed(0)}`).join('|'),
      ].join(';')
    : '';
  const placed = useMemo(
    () =>
      projection
        ? layoutHoleLabels({
            width,
            height,
            pad: frame,
            line: lineXY,
            front,
            center,
            back,
            greenPoints,
            ellipsePoints: ellipsePts,
            labels: mapLabels,
          })
        : { labels: [], dots: [] },
    // Breath and the flight stroke do not change this signature, so they do not move the labels.
    [layoutSignature],
  );
  const showMark = (id: 'front' | 'center' | 'back') => {
    const readout = props.markReadout?.[id];
    if (!readout || readout === '—') return;
    setFlash({ id, text: readout });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  };
  if (!projection) return <Muted>This hole has no open geometry to draw.</Muted>;
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
          const hit = nearestMark(placed.dots, x, y);
          if (hit && props.markReadout?.[hit] && props.markReadout[hit] !== '—') {
            showMark(hit);
            return;
          }
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
            {ellipseDraw ? (
              <RadialGradient id={`${uid}-ovalfill`} cx="50%" cy="42%" r="68%">
                <Stop offset="0" stopColor={props.ellipseColor ?? '#8AC926'} stopOpacity="0.78" />
                <Stop offset="0.62" stopColor={props.ellipseColor ?? '#8AC926'} stopOpacity="0.34" />
                <Stop offset="1" stopColor={props.ellipseColor ?? '#8AC926'} stopOpacity="0.06" />
              </RadialGradient>
            ) : null}
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
        {ballXY && aimEnd ? (
          <G>
            <Line x1={ballXY.x} y1={ballXY.y} x2={aimEnd.x} y2={aimEnd.y} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={2} strokeLinecap="round" />
            <Circle cx={ballXY.x} cy={ballXY.y} r={5} fill="#FFFFFF" />
          </G>
        ) : null}
        {clippedFlight.length > 1 ? (
          <Polyline
            points={xyString(clippedFlight.slice(0, Math.max(2, Math.ceil(clippedFlight.length * flightT))))}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}
        {ellipseDraw
          ? (() => {
              const ink = props.ellipseColor ?? '#8AC926';
              return (
                <G transform={`translate(${ellipseDraw.cx} ${ellipseDraw.cy}) scale(${breath}) translate(${-ellipseDraw.cx} ${-ellipseDraw.cy})`}>
                  <Polygon points={ellipseDraw.glowSoft} fill={ink} fillOpacity={0.12} stroke="none" />
                  <Polygon points={ellipseDraw.glow} fill={ink} fillOpacity={0.22} stroke="none" />
                  <Polygon points={ellipseDraw.solid} fill={`url(#${uid}-ovalfill)`} stroke={ink} strokeWidth={1.75} />
                  <Polygon points={ellipseDraw.solid} fill={ink} fillOpacity={0.16} stroke="none" />
                </G>
              );
            })()
          : null}
        {placed.dots.map((dot) => (
          <G key={dot.id} accessible={false}>
            <Circle cx={dot.at.x} cy={dot.at.y} r={GREEN_DOT / 2 + DOT_STROKE} fill="#0B1F3A" />
            <Circle cx={dot.at.x} cy={dot.at.y} r={GREEN_DOT / 2} fill="#FFFFFF" />
          </G>
        ))}
        {flash
          ? (() => {
              const dot = placed.dots.find((item) => item.id === flash.id);
              if (!dot) return null;
              const w = Math.max(44, flash.text.length * 12 + 16);
              const x = dot.at.x - w / 2;
              const y = dot.at.y + 12;
              return (
                <G accessible={false}>
                  <Rect x={x} y={y} width={w} height={28} rx={10} fill="rgba(11,31,58,0.92)" />
                  <MapText x={dot.at.x} y={y + 20} fill="#FFFFFF" fontSize={17} fontWeight="700" fontFamily={font.family} fontFeatureSettings='"tnum"' textAnchor="middle" style={mapLabelStyle}>
                    {flash.text}
                  </MapText>
                </G>
              );
            })()
          : null}
        {placed.labels.filter((label) => label.kind === 'pill').map((label) => {
          const end = leaderEnd(label.anchor, label.box);
          return (
            <G key={label.id}>
              {label.leader ? <Line x1={label.anchor.x} y1={label.anchor.y} x2={end.x} y2={end.y} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={1.5} /> : null}
              <Rect x={label.box.x} y={label.box.y} width={label.box.w} height={label.box.h} rx={10} fill="rgba(11,31,58,0.88)" />
              <MapText x={label.at.x} y={label.at.y} fill="#FFFFFF" fontSize={17} fontWeight="700" fontFamily={font.family} fontFeatureSettings='"tnum"' textAnchor="middle" style={mapLabelStyle}>
                {label.text}
              </MapText>
            </G>
          );
        })}
        {props.dispersionLine.length > 1 ? (
          <Polyline points={pointsOf(props.dispersionLine, projection)} fill="none" stroke={bleed ? 'rgba(255,255,255,0.7)' : colors.navy} strokeWidth={4} />
        ) : null}
        {props.measure.length > 1 ? <Polyline points={pointsOf(props.measure, projection)} fill="none" stroke={colors.red} strokeWidth={3} /> : null}
      </Svg>
      <View pointerEvents="box-none" style={styles.dotHits}>
        {placed.dots.map((dot) => (
          <View
            key={dot.id}
            accessible
            accessibilityRole="button"
            accessibilityLabel={props.markAccess?.[dot.id] ?? (dot.id === 'front' ? 'Front' : dot.id === 'center' ? 'Center' : 'Back')}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={() => showMark(dot.id)}
            pointerEvents="none"
            style={[styles.dotHit, { left: dot.at.x - 14, top: dot.at.y - 14 }]}
          />
        ))}
      </View>
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
  dotHits: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  dotHit: { position: 'absolute', width: 28, height: 28 },
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
