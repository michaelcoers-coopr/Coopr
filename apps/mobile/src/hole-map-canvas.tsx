import { useEffect, useId, useMemo, useRef, useState, type ComponentType } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Pattern, Polygon, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '@coopr/domain';
import { colors, font, signal } from '@coopr/tokens';
import { projectAlongHole, projectPoints } from '@coopr/engine';
import { Muted } from './ui';
import type { HoleMapProps } from './hole-map-props';
import { useDisplayFace } from './design/display-font';
import { HOLE_BLEED_PAD, holeFitPoints, playingWidthMeters, projectHoleFill, projectPlayFrame } from './hole-fit';
import { tileSourceDrawsVectors } from './tile-source';
import { AERIAL_CREDIT, aerialScreenProjection, aerialView } from './aerial/project';
import { boundsBox, clipPolylineAtOval, DOT_STROKE, ellipseEdge, fittedEllipse, GREEN_DOT, insideEllipse, layoutHoleLabels, leaderEnd, nearestMark, sampleCaptionAt, sampleCaptionBox } from './map-label-layout';

const SURROUND = '#143524';
const TREE = '#0C2418';
const TREE_MID = '#1E5234';
const ROUGH = '#A9D48C';
const FAIRWAY_DARK = '#1E7A3C';
const FAIRWAY_LIGHT = '#3EAE58';
const GREEN = '#D8FFB4';
const SAND = '#E4C98A';
const SAND_GRAIN = '#C6A86C';

function pxPerMeter(projection: { toXY: (point: LatLon) => { x: number; y: number } }, origin: LatLon): number {
  const start = projection.toXY(origin);
  const shifted = projection.toXY({
    lat: origin.lat + (20 / 6_371_000) * (180 / Math.PI),
    lon: origin.lon,
  });
  return Math.hypot(shifted.x - start.x, shifted.y - start.y) / 20;
}

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
  textAnchor: 'middle' | 'start' | 'end';
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
  const displayFace = useDisplayFace();
  const aerial = props.aerial === true && tileSourceDrawsVectors(props.imagery);
  const pillFace = aerial ? displayFace : font.family;
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
  const around = [...fitPoints, ...(props.ellipse ?? []), ...(props.flight ?? [])];
  const plate = props.plate ?? null;
  const photo = plate != null;
  const photoFrame = plate
    ? aerialView({
        imageWidth: plate.georef.widthPx,
        imageHeight: plate.georef.heightPx,
        viewWidth: width,
        viewHeight: height,
        focus: props.camera?.kind ?? 'hole',
        tee: { x: plate.georef.teePx[0], y: plate.georef.teePx[1] },
        green: { x: plate.georef.greenPx[0], y: plate.georef.greenPx[1] },
      })
    : null;
  const projection =
    plate && photoFrame
      ? aerialScreenProjection(plate.georef, photoFrame)
      : fitPoints.length === 0
        ? null
        : props.camera && props.orient != null
          ? projectPlayFrame({
              line: props.line,
              around,
              fairway: props.fairways.flat(),
              width,
              height,
              view: frame,
              bearing: props.orient.bearing,
              origin: props.orient.origin,
              kind: props.camera.kind,
              reachYards: props.camera.reachYards,
              from: props.camera.from,
            })
          : props.bleed && props.orient != null
            ? projectHoleFill(fitPoints, width, height, HOLE_BLEED_PAD, props.orient.bearing, props.orient.origin)
            : props.orient != null
              ? projectAlongHole(fitPoints, width, height, fitPad, props.orient.bearing, props.orient.origin)
              : projectPoints(fitPoints, width, height, fitPad);
  const photoBox =
    plate && photoFrame
      ? {
          left: photoFrame.originX,
          top: photoFrame.originY,
          width: plate.georef.widthPx * photoFrame.scale,
          height: plate.georef.heightPx * photoFrame.scale,
        }
      : null;
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
      style={[styles.frame, bleed && styles.bleed, bleed && { height }, photo && styles.photo]}
      onLayout={(event) => setWidth(Math.max(1, Math.round(event.nativeEvent.layout.width)))}
    >
      {photoBox && plate ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image accessible={false} source={plate.placeholder} fadeDuration={0} resizeMode="stretch" style={[styles.photoImage, photoBox]} />
          <Image
            accessible
            accessibilityLabel="Stylized aerial of this hole. Not current conditions."
            source={plate.image}
            fadeDuration={0}
            resizeMode="stretch"
            style={[styles.photoImage, photoBox]}
          />
        </View>
      ) : null}
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
            <Pattern id={`${uid}-mow`} width={width} height={18} patternUnits="userSpaceOnUse">
              <Rect x={0} y={0} width={width} height={9} fill={FAIRWAY_DARK} />
              <Rect x={0} y={9} width={width} height={9} fill={FAIRWAY_LIGHT} />
            </Pattern>
            <Pattern id={`${uid}-trees`} width={72} height={72} patternUnits="userSpaceOnUse">
              <Circle cx={14} cy={18} r={8} fill={TREE} />
              <Circle cx={18} cy={16} r={4} fill={TREE_MID} />
              <Circle cx={48} cy={46} r={10} fill={TREE} />
              <Circle cx={52} cy={42} r={5} fill={TREE_MID} />
              <Circle cx={30} cy={8} r={4} fill={TREE} />
              <Circle cx={8} cy={52} r={5} fill={TREE_MID} />
              <Circle cx={62} cy={14} r={3.5} fill={TREE} />
            </Pattern>
            <Pattern id={`${uid}-grain`} width={10} height={10} patternUnits="userSpaceOnUse">
              <Rect width={10} height={10} fill={SAND} />
              <Circle cx={2} cy={3} r={0.7} fill={SAND_GRAIN} />
              <Circle cx={7} cy={7} r={0.55} fill="#F3E0B0" />
              <Circle cx={5} cy={2} r={0.4} fill={SAND_GRAIN} />
            </Pattern>
            {aerial ? (
              <LinearGradient id={`${uid}-ground`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#07140E" />
                <Stop offset="0.42" stopColor="#123222" />
                <Stop offset="1" stopColor="#06110C" />
              </LinearGradient>
            ) : null}
            {aerial ? (
              <LinearGradient id={`${uid}-water`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#7ED0D6" stopOpacity="0.55" />
                <Stop offset="0.35" stopColor="#146068" />
                <Stop offset="1" stopColor="#06282C" />
              </LinearGradient>
            ) : null}
            <RadialGradient id={`${uid}-shine`} cx="50%" cy="42%" r="58%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.72" />
              <Stop offset="0.55" stopColor={GREEN} stopOpacity="0.2" />
              <Stop offset="1" stopColor={GREEN} stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id={`${uid}-fairgrad`} x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#146B32" />
              <Stop offset="0.5" stopColor="#2E9A4C" />
              <Stop offset="1" stopColor="#8FE7A4" />
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
        {bleed && !photo ? <Rect x={0} y={0} width={width} height={height} fill={aerial ? `url(#${uid}-ground)` : SURROUND} /> : null}
        {bleed && !photo ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-trees)`} /> : null}
        {aerial && !photo ? (
          <G opacity={0.4} transform="translate(5 7)">
            <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-trees)`} />
          </G>
        ) : null}
        {bleed && !photo && lineXY.length > 1
          ? (() => {
              const playing = props.orient ? playingWidthMeters(props.fairways.flat(), props.orient.bearing, props.orient.origin) : null;
              const ppm = props.orient ? pxPerMeter(projection, props.orient.origin) : 0;
              const fairwayPx = playing && ppm ? playing * ppm : 0;
              const roughPx = Math.min(width * 0.72, Math.max(width * 0.3, fairwayPx > 0 ? fairwayPx * 1.85 : width * 0.42));
              return (
                <Polyline
                  points={xyString(lineXY)}
                  fill="none"
                  stroke={ROUGH}
                  strokeWidth={roughPx}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })()
          : null}
        {!photo
          ? props.fairways.map((ring, index) => (
              <Polygon key={`fairway-${index}`} points={pointsOf(ring, projection)} fill={bleed ? FAIRWAY_DARK : 'rgba(255,255,255,0.9)'} stroke={bleed ? '#145C32' : ink} strokeWidth={bleed ? 1.5 : 2} />
            ))
          : null}
        {bleed && !photo && props.fairways.length > 0 ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-mow)`} clipPath={`url(#${uid}-fair)`} /> : null}
        {bleed && !photo && props.fairways.length > 0 ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-fairgrad)`} fillOpacity={0.28} clipPath={`url(#${uid}-fair)`} /> : null}
        {!photo
          ? props.bunkers.map((ring, index) => (
              <Polygon key={`bunker-${index}`} points={pointsOf(ring, projection)} fill={bleed ? (aerial ? '#F3D48A' : SAND) : colors.white} stroke={bleed ? '#FFF6DE' : ink} strokeWidth={aerial ? 2 : 1.5} />
            ))
          : null}
        {bleed && !photo && props.bunkers.length > 0 ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-grain)`} clipPath={`url(#${uid}-sand)`} /> : null}
        {!photo
          ? props.hazards.map((ring, index) => (
              <Polygon
                key={`hazard-${index}`}
                points={pointsOf(ring, projection)}
                fill={aerial ? `url(#${uid}-water)` : colors.red}
                fillOpacity={bleed ? 0.92 : 0.72}
                stroke={aerial ? '#D7F4F6' : bleed ? '#FFD5DC' : colors.red}
                strokeWidth={bleed ? 2 : 3}
              />
            ))
          : null}
        {!photo
          ? props.green.map((ring, index) => (
              <Polygon key={`green-${index}`} points={pointsOf(ring, projection)} fill={bleed ? GREEN : colors.white} stroke={bleed ? '#FFFFFF' : ink} strokeWidth={2} />
            ))
          : null}
        {bleed && !photo && props.green.length > 0 ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-shine)`} clipPath={`url(#${uid}-green)`} /> : null}
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
        {tee ? <Rect x={tee.x - 14} y={tee.y - 5} width={28} height={10} rx={2} fill="#FFFFFF" stroke={photo ? '#06140E' : 'none'} strokeWidth={photo ? 1.5 : 0} /> : null}
        {pin ? (
          <G>
            <Line x1={pin.x} y1={pin.y} x2={pin.x} y2={pin.y - 30} stroke="#F7F5F2" strokeWidth={2} />
            <Polygon points={`${pin.x},${pin.y - 30} ${pin.x + 16},${pin.y - 23} ${pin.x},${pin.y - 16}`} fill={colors.red} />
          </G>
        ) : null}
        {ballXY && aimEnd ? (
          <G>
            <Line x1={ballXY.x} y1={ballXY.y} x2={aimEnd.x} y2={aimEnd.y} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" />
            <Circle cx={ballXY.x} cy={ballXY.y} r={5} fill="#FFFFFF" />
          </G>
        ) : null}
        {clippedFlight.length > 1 ? (
          <Polyline
            points={xyString(clippedFlight.slice(0, Math.max(2, Math.ceil(clippedFlight.length * flightT))))}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.9}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : null}
        {flightXY.length > 1
          ? (() => {
              const end = flightXY[flightXY.length - 1]!;
              return (
                <G>
                  <Circle cx={end.x} cy={end.y} r={12} fill={signal.go} fillOpacity={0.4} />
                  <Circle cx={end.x} cy={end.y} r={4.5} fill="#FFFFFF" stroke={signal.go} strokeWidth={2} />
                </G>
              );
            })()
          : null}
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
              <Rect x={label.box.x} y={label.box.y} width={label.box.w} height={label.box.h} rx={10} fill={aerial ? 'rgba(4,10,24,0.92)' : 'rgba(11,31,58,0.88)'} />
              <MapText x={label.at.x} y={label.at.y} fill="#FFFFFF" fontSize={17} fontWeight="700" fontFamily={pillFace} fontFeatureSettings='"tnum"' textAnchor="middle" style={mapLabelStyle}>
                {label.text}
              </MapText>
            </G>
          );
        })}
        {props.ellipseCaption && ellipseDraw
          ? (() => {
              const view = {
                x: frame.left,
                y: frame.top,
                w: Math.max(0, width - frame.left - frame.right),
                h: Math.max(0, height - frame.top - frame.bottom),
              };
              const blocked = [
                ...placed.labels.map((label) => label.box),
                ...(frame.top > 0 ? [{ x: 0, y: 0, w: width, h: frame.top }] : []),
                ...(frame.bottom > 0 ? [{ x: 0, y: height - frame.bottom, w: width, h: frame.bottom }] : []),
              ];
              const caption = sampleCaptionAt(ellipseDraw, pin, blocked, boundsBox(greenPoints, 8), view);
              if (!caption) return null;
              const chip = sampleCaptionBox(caption);
              const textX = chip.x + chip.w / 2;
              const textY = chip.y + chip.h / 2 + 5;
              return (
                <G>
                  <Rect x={chip.x} y={chip.y} width={chip.w} height={chip.h} rx={14} fill="rgba(6,16,28,0.96)" stroke="#FFFFFF" strokeWidth={1.75} />
                  <MapText
                    x={textX}
                    y={textY}
                    fill="#FFFFFF"
                    fontSize={15}
                    fontWeight="700"
                    fontFamily={font.family}
                    fontFeatureSettings='"tnum"'
                    textAnchor="middle"
                    style={mapLabelStyle}
                  >
                    {props.ellipseCaption}
                  </MapText>
                </G>
              );
            })()
          : null}
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
      {photo ? (
        <View pointerEvents="none" style={[styles.creditWrap, { bottom: frame.bottom + 8 }]}>
          <Text style={styles.credit}>{AERIAL_CREDIT}</Text>
        </View>
      ) : null}
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
  bleed: { width: '100%', borderRadius: 0, borderWidth: 0, backgroundColor: SURROUND },
  photo: { backgroundColor: '#06140E' },
  photoImage: { position: 'absolute' },
  creditWrap: { position: 'absolute', left: 12, right: 72 },
  credit: {
    alignSelf: 'flex-start',
    color: '#F4FFF6',
    backgroundColor: 'rgba(4,10,24,0.78)',
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
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
