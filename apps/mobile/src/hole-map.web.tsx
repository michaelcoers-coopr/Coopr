import { useEffect, useId, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Pattern, Polygon, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '@coopr/domain';
import { colors, font } from '@coopr/tokens';
import { projectAlongHole, projectPoints, visibleLabels, type LabelBox } from '@coopr/engine';
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

const OVAL_FLOOR = 14;

function boxesHit(a: LabelBox, b: LabelBox, pad = 4): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

type XY = { x: number; y: number };

function ellipseEdge(from: XY, cx: number, cy: number, halfW: number, halfH: number): XY {
  const vx = from.x - cx;
  const vy = from.y - cy;
  const denom = Math.hypot(vx / Math.max(halfW, 0.5), vy / Math.max(halfH, 0.5));
  if (!Number.isFinite(denom) || denom === 0) return { x: cx, y: cy };
  const t = 1 / denom;
  return { x: cx + vx * t, y: cy + vy * t };
}

function insideEllipse(point: XY, cx: number, cy: number, halfW: number, halfH: number): boolean {
  const dx = (point.x - cx) / Math.max(halfW, 0.5);
  const dy = (point.y - cy) / Math.max(halfH, 0.5);
  return dx * dx + dy * dy <= 1;
}

/** Stop a polyline where it enters the oval so the arc does not paint across the pattern. */
function clipPolylineAtOval(points: readonly XY[], cx: number, cy: number, halfW: number, halfH: number): XY[] {
  const out: XY[] = [];
  for (const point of points) {
    if (insideEllipse(point, cx, cy, halfW, halfH)) {
      const prev = out[out.length - 1];
      if (prev) out.push(ellipseEdge(prev, cx, cy, halfW, halfH));
      break;
    }
    out.push(point);
  }
  return out;
}

function strokeBoxes(points: readonly XY[], pad = 8): LabelBox[] {
  const boxes: LabelBox[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 12));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = start.x + dx * t;
      const y = start.y + dy * t;
      boxes.push({ x: x - pad, y: y - pad, w: pad * 2, h: pad * 2 });
    }
  }
  return boxes;
}

function letterClearance(box: LabelBox, obstacles: readonly LabelBox[]): number {
  let score = 0;
  for (const other of obstacles) {
    if (!boxesHit(box, other, 6)) continue;
    const overlapW = Math.min(box.x + box.w, other.x + other.w) - Math.max(box.x, other.x);
    const overlapH = Math.min(box.y + box.h, other.y + other.h) - Math.max(box.y, other.y);
    score += 1000 + Math.max(0, overlapW) * Math.max(0, overlapH);
  }
  return score;
}

function xyString(points: readonly XY[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function letterBox(spot: XY): LabelBox {
  return { x: spot.x - 12, y: spot.y - 28, w: 24, h: 36 };
}

function padInsets(pad: number | { top?: number; right?: number; bottom?: number; left?: number }): { top: number; right: number; bottom: number; left: number } {
  if (typeof pad === 'number') return { top: pad, right: pad, bottom: pad, left: pad };
  return { top: pad.top ?? 0, right: pad.right ?? 0, bottom: pad.bottom ?? 0, left: pad.left ?? 0 };
}

/** Pull a box into the map area that is not covered by the yardage panel or the sheet. */
function clampInto(box: LabelBox, rect: LabelBox): LabelBox {
  const w = Math.min(box.w, Math.max(1, rect.w));
  const h = Math.min(box.h, Math.max(1, rect.h));
  return {
    ...box,
    w,
    h,
    x: Math.min(Math.max(box.x, rect.x), rect.x + rect.w - w),
    y: Math.min(Math.max(box.y, rect.y), rect.y + rect.h - h),
  };
}

function clampLetter(spot: XY, rect: LabelBox): XY {
  const box = clampInto(letterBox(spot), rect);
  return { x: box.x + 12, y: box.y + 28 };
}

function dist2(a: XY, b: XY): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** Prefer `ideal` when it is on the open map and clear. Otherwise the nearest visible clear spot. */
function chooseSpot(spots: readonly XY[], ideal: XY, obstacles: readonly LabelBox[], rect: LabelBox): XY {
  const clamped = spots.map((spot) => clampLetter(spot, rect));
  const clear = clamped.filter((spot) => letterClearance(letterBox(spot), obstacles) === 0);
  const pool = clear.length > 0 ? clear : clamped;
  return (
    pool.slice().sort((a, b) => {
      if (clear.length === 0) {
        const overlap = letterClearance(letterBox(a), obstacles) - letterClearance(letterBox(b), obstacles);
        if (overlap !== 0) return overlap;
      }
      return dist2(a, ideal) - dist2(b, ideal);
    })[0] ?? clampLetter(ideal, rect)
  );
}

/** Unit vector from the tee toward the pin. Screen y grows downward, so this often points up. */
function playDirection(line: readonly XY[]): XY | null {
  if (line.length < 2) return null;
  const start = line[0]!;
  const end = line[line.length - 1]!;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return null;
  return { x: dx / length, y: dy / length };
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
  const minX = Math.min(...xy.map((point) => point.x));
  const maxX = Math.max(...xy.map((point) => point.x));
  const minY = Math.min(...xy.map((point) => point.y));
  const maxY = Math.max(...xy.map((point) => point.y));
  const short = Math.max(Math.min(maxX - minX, maxY - minY), 0.5);
  const scale = short < OVAL_FLOOR ? OVAL_FLOOR / short : 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const ring = (factor: number) => xy.map((point) => `${cx + (point.x - cx) * factor},${cy + (point.y - cy) * factor}`).join(' ');
  const halos = scale > 1 ? [1.7, 2.2] : [1.28, 1.55];
  return {
    cx,
    cy,
    halfW: ((maxX - minX) * scale) / 2,
    halfH: ((maxY - minY) * scale) / 2,
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
  if (cloud.length === 0) return <Muted>This hole has no open geometry to draw.</Muted>;
  const height = props.height ?? 220;
  const pad = props.pad ?? (props.bleed ? { top: 48, right: 16, bottom: 56, left: 16 } : 12);
  const frame = padInsets(pad);
  const visible: LabelBox = {
    x: frame.left,
    y: frame.top,
    w: Math.max(24, width - frame.left - frame.right),
    h: Math.max(36, height - frame.top - frame.bottom),
  };
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
  const ellipseDraw = props.ellipse && props.ellipse.length > 2 ? drawEllipse(props.ellipse.map((point) => projection.toXY(point))) : null;
  const greenPts = props.green.flatMap((ring) => ring.map((point) => projection.toXY(point)));
  const greenBox: LabelBox | null = greenPts.length
    ? {
        x: Math.min(...greenPts.map((point) => point.x)) - 4,
        y: Math.min(...greenPts.map((point) => point.y)) - 4,
        w: Math.max(...greenPts.map((point) => point.x)) - Math.min(...greenPts.map((point) => point.x)) + 8,
        h: Math.max(...greenPts.map((point) => point.y)) - Math.min(...greenPts.map((point) => point.y)) + 8,
      }
    : null;
  const labelItems = (props.labels ?? []).map((label) => {
    const xy = projection.toXY(label.at);
    const boxW = Math.max(44, label.label.length * 12 + 16);
    const distance = label.label === '150' || label.label === '300' || label.label === '450';
    const item = { ...label, x: xy.x - boxW / 2, y: xy.y - 16, w: boxW, h: 28, priority: distance ? 0 : 2 };
    if (!distance && ellipseDraw) {
      item.x = Math.min(width - item.w - 8, ellipseDraw.cx + ellipseDraw.halfW + 10);
      item.y = ellipseDraw.cy - item.h / 2;
      if (item.x < 8) item.x = 8;
    }
    const placed = clampInto(item, visible);
    return { ...item, x: placed.x, y: placed.y };
  });
  const ovalGuard = ellipseDraw
    ? [
        {
          label: 'pattern',
          priority: 3,
          x: ellipseDraw.cx - ellipseDraw.halfW - 2,
          y: ellipseDraw.cy - ellipseDraw.halfH - 2,
          w: ellipseDraw.halfW * 2 + 4,
          h: ellipseDraw.halfH * 2 + 4,
        },
      ]
    : [];
  const keptLabels = visibleLabels([...ovalGuard, ...labelItems]).filter((item) => item.label !== 'pattern');
  const lineXY = props.line.map((point) => projection.toXY(point));
  const flightXY = (props.flight ?? []).map((point) => projection.toXY(point));
  const ball = props.flight?.[0] ?? props.line[0];
  const ballXY = ball ? projection.toXY(ball) : null;
  const aimEnd = ellipseDraw && ballXY && !insideEllipse(ballXY, ellipseDraw.cx, ellipseDraw.cy, ellipseDraw.halfW, ellipseDraw.halfH)
    ? ellipseEdge(ballXY, ellipseDraw.cx, ellipseDraw.cy, ellipseDraw.halfW, ellipseDraw.halfH)
    : null;
  const clippedFlight = ellipseDraw ? clipPolylineAtOval(flightXY, ellipseDraw.cx, ellipseDraw.cy, ellipseDraw.halfW, ellipseDraw.halfH) : flightXY;
  const aimStroke = ballXY && aimEnd ? strokeBoxes([ballXY, aimEnd], 8) : [];
  const letterObstacles: LabelBox[] = [
    ...keptLabels,
    ...(greenBox ? [greenBox] : []),
    ...(ellipseDraw
      ? [{ x: ellipseDraw.cx - ellipseDraw.halfW, y: ellipseDraw.cy - ellipseDraw.halfH, w: ellipseDraw.halfW * 2, h: ellipseDraw.halfH * 2 }]
      : []),
    ...strokeBoxes(lineXY, 7),
    ...strokeBoxes(clippedFlight, 8),
    ...aimStroke,
    ...(pin ? [{ x: pin.x - 10, y: pin.y - 40, w: 32, h: 46 }] : []),
  ];
  const play = playDirection(lineXY);
  const letters = props.marks
    ? (['front', 'center', 'back'] as const).map((key) => {
        const xy = projection.toXY(props.marks![key]);
        const word = key === 'front' ? 'F' : key === 'center' ? 'C' : 'B';
        const dir = play ?? { x: 0, y: -1 };
        const perp = { x: -dir.y, y: dir.x };
        const beyond = (distance: number, side = 0) => ({
          x: xy.x + dir.x * distance + perp.x * side,
          y: xy.y + dir.y * distance + perp.y * side,
        });
        const spots =
          key === 'front'
            ? [
                { x: xy.x - 36, y: xy.y },
                { x: xy.x - 40, y: xy.y - 22 },
                { x: xy.x - 34, y: xy.y + 24 },
              ]
            : key === 'center'
              ? [
                  { x: xy.x + 36, y: xy.y - 30 },
                  { x: xy.x + 44, y: xy.y + 6 },
                  { x: xy.x + 20, y: xy.y + 36 },
                  { x: xy.x - 6, y: xy.y - 40 },
                ]
              : [
                  beyond(44),
                  beyond(62),
                  beyond(32, 30),
                  beyond(32, -30),
                  beyond(8, 44),
                  beyond(8, -44),
                  beyond(-18, 48),
                  beyond(-18, -48),
                  beyond(-36, 36),
                  beyond(-36, -36),
                ];
        const picked = chooseSpot(spots, spots[0]!, letterObstacles, visible);
        letterObstacles.push(letterBox(picked));
        return { key, word, x: picked.x, y: picked.y };
      })
    : [];
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
        {props.marks
          ? (['front', 'back', 'center'] as const).map((key) => {
              const xy = projection.toXY(props.marks![key]);
              const primary = key === 'center';
              const radius = primary ? 7 : 4.5;
              return (
                <Circle key={key} cx={xy.x} cy={xy.y} r={radius} fill={primary ? '#FFFFFF' : 'rgba(255,255,255,0.55)'} stroke={markInk} strokeWidth={primary ? 2 : 1} />
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
        {keptLabels.map((label) => (
          <G key={`${label.label}-${label.x.toFixed(0)}`}>
            <Rect x={label.x} y={label.y} width={label.w} height={label.h} rx={10} fill="rgba(11,31,58,0.88)" />
            <MapText x={label.x + label.w / 2} y={label.y + 20} fill="#FFFFFF" fontSize={17} fontWeight="700" fontFamily={font.family} fontFeatureSettings='"tnum"' textAnchor="middle" style={mapLabelStyle}>
              {label.label}
            </MapText>
          </G>
        ))}
        {letters.map((letter) => (
          <MapText key={letter.key} x={letter.x} y={letter.y + 5} fill="#FFFFFF" fontSize={17} fontWeight="700" fontFamily={font.family} fontFeatureSettings='"tnum"' textAnchor="middle" style={mapLabelStyle}>
            {letter.word}
          </MapText>
        ))}
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
